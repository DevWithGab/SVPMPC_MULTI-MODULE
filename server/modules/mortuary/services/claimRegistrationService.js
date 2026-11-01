const { createHash, randomUUID } = require('node:crypto');
const { parseCsvDate } = require('../../../shared/utils/csvDate');
const fail = (status, message) => Object.assign(new Error(message), { status });

function createClaimRegistrationService({ Claim, Member, Beneficiary, AuditLog, now = () => new Date(), logger = console }) {
  function normalize(input) {
    if (typeof input.memberId !== 'string' || !input.memberId.trim() ||
        typeof input.beneficiaryId !== 'string' || !input.beneficiaryId.trim() || typeof input.dateOfDeath !== 'string') {
      throw fail(400, 'Member, beneficiary, and date of death are required');
    }
    const date = parseCsvDate(input.dateOfDeath.split('T')[0]);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now());
    if (date.error || !Number.isFinite(new Date(input.dateOfDeath).getTime()) || date.value > today) {
      throw fail(400, 'Enter a valid date of death that is today or earlier.');
    }
    for (const key of ['causeOfDeath', 'remarks']) {
      if (input[key] != null && typeof input[key] !== 'string') throw fail(400, 'Claim notes must be text.');
    }
    return { memberId: input.memberId.trim(), beneficiaryId: input.beneficiaryId.trim(),
      dateOfDeath: date.value, causeOfDeath: input.causeOfDeath?.trim() || '', remarks: input.remarks?.trim() || '' };
  }

  async function audit(claim) {
    if (claim.registration.auditedAt) return;
    const journal = claim.registration;
    try {
      // Stable ID makes concurrent finishers and audit recovery idempotent.
      await AuditLog.updateOne({ logId: 'CLAIM-CREATED-' + claim.claimId }, { $setOnInsert: {
        logId: 'CLAIM-CREATED-' + claim.claimId,
        userId: journal.userId, userName: journal.userName, userRole: journal.userRole,
        action: 'claim_created', module: 'mortuary', entityType: 'claim', entityId: claim.claimId,
        entityName: claim.memberName,
        description: `Claim filed for ${claim.memberName}, beneficiary ${claim.beneficiaryName}`,
        changes: { before: null, after: claim.toObject() }, status: 'success',
        ipAddress: journal.ipAddress, userAgent: journal.userAgent, timestamp: journal.completedAt || claim.dateFiled,
      } }, { upsert: true, runValidators: true });
      await Claim.updateOne({ claimId: claim.claimId, 'registration.requestKey': journal.requestKey },
        { $set: { 'registration.auditedAt': now() } });
    } catch (error) {
      // A ready claim remains successful; the recovery worker retries this
      // durable audit task without repeating registration or its member write.
      logger.error('Claim registration audit needs retry:', error.message);
    }
  }

  async function finish(claim) {
    if (!claim.registration?.requestKey) throw fail(409, 'This claim has no pending registration.');
    let completed = false;
    if (claim.status === 'filing') {
      await Claim.updateOne({ claimId: claim.claimId, status: 'filing' }, { $set: { 'registration.lastAttemptAt': now() } });
      // Targeted, idempotent member update: never resave a stale whole profile.
      const updated = await Member.updateOne({ memberId: claim.memberId }, { $set: { status: 'deceased', qrCodeActive: false } }, { runValidators: true });
      if (!updated.matchedCount) throw fail(409, 'The member no longer exists. Registration needs review.');
      const completedAt = now();
      const ready = await Claim.findOneAndUpdate({ claimId: claim.claimId, status: 'filing' }, {
        $set: { status: 'pending_requirements', 'registration.completedAt': completedAt },
        $push: { statusHistory: { status: 'pending_requirements', changedBy: claim.createdBy,
          changedAt: completedAt, notes: 'Claim filed; member marked deceased' } },
      }, { returnDocument: 'after', runValidators: true });
      completed = Boolean(ready);
      claim = ready || await Claim.findOne({ claimId: claim.claimId });
      if (!claim || claim.status === 'filing') throw fail(503, 'Registration is still pending. Retry with the same details.');
    }
    await audit(claim);
    return { claim, created: completed };
  }

  async function register(input, actor) {
    const entry = normalize(input || {});
    const member = await Member.findOne({ memberId: entry.memberId });
    if (!member) throw fail(404, 'Member not found');
    const requestKey = createHash('sha256').update(JSON.stringify([
      entry.memberId, entry.beneficiaryId, entry.dateOfDeath, entry.causeOfDeath, entry.remarks,
      actor.userId || actor.userName,
    ])).digest('hex');
    const resume = claim => {
      if (claim.registration?.requestKey !== requestKey) {
        throw fail(409, 'This member already has a non-rejected claim. Open the existing claim before filing another one.');
      }
      return finish(claim);
    };
    const existing = await Claim.findOne({ memberId: entry.memberId, status: { $ne: 'rejected' } });
    if (existing) return resume(existing);

    const beneficiary = await Beneficiary.findOne({ beneficiaryId: entry.beneficiaryId, memberId: entry.memberId, isActive: true });
    if (!beneficiary || beneficiary.isActive !== true) throw fail(404, 'A current active beneficiary for this member is required.');
    const startedAt = now();
    const claim = new Claim({
      ...entry, claimId: randomUUID(), memberName: member.memberName,
      beneficiaryName: beneficiary.beneficiaryName, beneficiaryRelationship: beneficiary.relationship,
      beneficiaryContact: beneficiary.contactNumber, dateOfDeath: new Date(entry.dateOfDeath), dateFiled: startedAt,
      createdBy: actor.userName, status: 'filing', requirements: new Map(),
      registration: { requestKey, ...actor, startedAt },
      statusHistory: [{ status: 'filing', changedBy: actor.userName, changedAt: startedAt, notes: 'Claim registration started' }],
    });
    try { await claim.save(); }
    catch (error) {
      if (error.code !== 11000) throw error;
      const winner = await Claim.findOne({ memberId: entry.memberId, status: { $ne: 'rejected' } });
      if (!winner) throw error;
      return resume(winner);
    }
    return finish(claim);
  }

  async function recover(limit = 100) {
    const claims = await Claim.find({ $or: [
      { status: 'filing' },
      { 'registration.requestKey': { $type: 'string' }, 'registration.auditedAt': null },
    ] }).sort({ 'registration.lastAttemptAt': 1, dateFiled: 1 }).limit(limit);
    for (const claim of claims) {
      try { await finish(claim); }
      catch (error) { logger.error('Claim registration needs retry:', claim.claimId, error.message); }
    }
  }
  return { register, recover };
}

function startClaimRegistrationRecovery(recover, intervalMs = 30000, logger = console) {
  let running;
  const timer = setInterval(() => {
    if (running) return;
    running = recover().catch(error => logger.error('Unable to recover claim registrations:', error.message))
      .finally(() => { running = null; });
  }, intervalMs);
  timer.unref();
  return { async stop() { clearInterval(timer); if (running) await running; } };
}

module.exports = { createClaimRegistrationService, startClaimRegistrationRecovery };
