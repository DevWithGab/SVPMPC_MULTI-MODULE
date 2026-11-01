/* Treasurer-side claim processing.

Hiniwalay ito sa sarili nitong file, bukod sa deductionController.js, para manatiling
klaro at distinct sa codebase yung money flow na dulot ng isang claim:
  - Flow A (collection/assessment): sisingilin ang bawat ibang active member ng maliit
    na fixed amount papunta sa sari-sariling ledger nila kapag namatay ang isang
    member. Dati pa itong existing bilang blanket, manually-triggered action
    (processAutomaticDeduction); ang processDeductionBatch sa baba ay parehong
    mekanismo, tumatakbo lang para sa mga piniling claim (hal. lahat ng death claim
    ng buwan), gamit ang configurable DeductionSetting rate at reference per death.

Ang deduction na ang huling hakbang ng claim - wala nang release/disbursement step
sa system, kaya kolekta lang ang tina-track dito. */
const Claim = require('../models/Claim');
const DeductionSetting = require('../models/DeductionSetting');
const Ledger = require('../models/Ledger');
const { Member } = require('../../../shared/models');
const { v4: uuidv4 } = require('uuid');
const { createHash } = require('node:crypto');
const { createLedgerPostingService } = require('../services/ledgerPostingService');
const { postLedgerEntry } = createLedgerPostingService({ Ledger });
const { getPaginationParams, buildPaginatedResponse } = require('../../../shared/utils/pagination');
const { getMemberBalanceSnapshots } = require('./deductionController');
const { createAuditLog } = require('../../../shared/services/auditLoggingService');
const { safeErrorMessage } = require('../../../middleware/errorHandler');
const { actorName } = require('../../../shared/utils/actorName');

const round2 = (n) => Math.round(n * 100) / 100;
const deductionLedgerId = (claimId, memberId) =>
  `CLAIM-DEDUCTION-${createHash('sha256').update(JSON.stringify([claimId, memberId])).digest('hex')}`;
const hasDeductionPlan = claim => Boolean(claim.deduction?.batchId &&
  claim.deduction.claimIds?.length && Array.isArray(claim.deduction.memberIds));
const compatiblePlan = (claim, plan) => !hasDeductionPlan(claim) ||
  (claim.deduction.batchId === plan.batchId && claim.deduction.amountPerMember === plan.amountPerMember &&
    JSON.stringify([...claim.deduction.claimIds].sort()) === JSON.stringify([...plan.claimIds].sort()) &&
    JSON.stringify([...claim.deduction.memberIds].sort()) === JSON.stringify([...plan.memberIds].sort()));

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* Tumutugma ito sa DEFAULT_DEDUCTION_AMOUNT sa deductionSettingController - ginagamit
lang kung walang rate row pa (auto-seeds ang Admin screen ng isa sa first view). */
const FALLBACK_DEDUCTION_AMOUNT = 25;

/* Ang per-member deduction ay naka-set ng Admin sa Deduction Settings at hindi
pagpipilian ng Treasurer, kaya parehong preview at real run ay rito rinesolve imbes
na umasa sa kung ano man galing sa request. Dahil dito, siguradong yung amount na
napreview ay yung talagang sisingilin. */
const resolveDeductionRate = async () => {
  const setting = await DeductionSetting.findOne({ status: 'active' });
  return {
    amount: setting?.amount ?? FALLBACK_DEDUCTION_AMOUNT,
    settingId: setting?.settingId,
  };
};

/* Lahat ng claim kahit anong status - ito ang backing ng Claims Report at
Deductions & Payouts tabs ng Reports screen, na kailangan ng buong list imbes na
isang lifecycle stage lang gaya ng mga method sa baba. Mirror ito ng
claimController.getAllClaims (Admin equivalent), pero scoped sa authenticated route
ng Treasurer. */
const listAllClaims = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const { status, search } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }
    if (search) {
      const regex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [
        { claimId: regex },
        { memberName: regex },
        { beneficiaryName: regex },
      ];
    }

    const total = await Claim.countDocuments(query);
    const claims = await Claim.find(query).sort({ dateFiled: -1 }).skip(skip).limit(limit);

    res.status(200).json(buildPaginatedResponse(claims, total, page, limit));
  } catch (error) {
    console.error('Error fetching all claims:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching claims',
      error: safeErrorMessage(error),
    });
  }
};

/* Ang claim na naka-"pending_deduction" ay mismong notification na sa Treasurer -
walang generic in-app notification system ang codebase na ito para sa claims, kaya
live query ang pragmatic mechanism dito. */
const listPendingDeduction = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const query = { status: 'pending_deduction' };
    if (req.query.search?.trim()) {
      const regex = new RegExp(escapeRegex(req.query.search.trim()), 'i');
      query.$or = [{ claimId: regex }, { memberName: regex }, { beneficiaryName: regex }];
    }

    const total = await Claim.countDocuments(query);
    const claims = await Claim.find(query).sort({ dateFiled: 1 }).skip(skip).limit(limit);

    res.status(200).json(buildPaginatedResponse(claims, total, page, limit));
  } catch (error) {
    console.error('Error fetching pending-deduction claims:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending-deduction claims',
      error: safeErrorMessage(error),
    });
  }
};

/* Ang Deduction Summary - isang month-end record per buwan (Philippine time), kasama
ang bawat claim na na-deduct sa buwan na iyon at ang detalye nito. Ang batches ay
binibilang gamit ang deduction.batchId; ang mga lumang claim na naproseso bago
nagkaroon ng batches ay tig-isang batch ang turing. */
const DEDUCTION_TIMEZONE = 'Asia/Manila';

const listDeductionSummary = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    // Optional "YYYY-MM": only that month (used by the month detail page).
    const month = typeof req.query.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.month) ? req.query.month : null;

    // Claims that never reached a deduction have no money to report on.
    const query = { 'deduction.totalCollected': { $gt: 0 } };
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ claimId: regex }, { memberName: regex }, { beneficiaryName: regex }, { 'deduction.jvNumber': regex }];
    }

    const months = await Claim.aggregate([
      { $match: query },
      { $sort: { 'deduction.processedAt': 1, claimId: 1 } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$deduction.processedAt', timezone: DEDUCTION_TIMEZONE } },
          batches: { $addToSet: { $ifNull: ['$deduction.batchId', '$claimId'] } },
          claimCount: { $sum: 1 },
          totalCollected: { $sum: '$deduction.totalCollected' },
          claims: {
            $push: {
              claimId: '$claimId',
              memberName: '$memberName',
              beneficiaryName: '$beneficiaryName',
              beneficiaryRelationship: '$beneficiaryRelationship',
              dateOfDeath: '$dateOfDeath',
              dateFiled: '$dateFiled',
              approvedBy: '$approval.approvedBy',
              approvedAt: '$approval.approvedAt',
              status: '$status',
              batchId: '$deduction.batchId',
              jvNumber: '$deduction.jvNumber',
              processedAt: '$deduction.processedAt',
              processedBy: '$deduction.processedBy',
              ratePerClaim: '$deduction.amountPerMember',
              membersCharged: '$deduction.membersCharged',
              totalCollected: '$deduction.totalCollected',
            },
          },
        },
      },
      { $match: month ? { _id: month } : { _id: { $ne: null } } },
      { $sort: { _id: -1 } },
    ]);

    const monthly = months.map(({ _id, batches, ...month }) => ({
      month: _id,
      batchCount: batches.length,
      ...month,
      totalCollected: round2(month.totalCollected || 0),
    }));

    res.status(200).json({
      success: true,
      data: monthly,
      totals: {
        totalCollected: round2(monthly.reduce((sum, m) => sum + m.totalCollected, 0)),
        claimCount: monthly.reduce((sum, m) => sum + m.claimCount, 0),
        batchCount: monthly.reduce((sum, m) => sum + m.batchCount, 0),
      },
    });
  } catch (error) {
    console.error('Error fetching deduction summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching deduction summary',
      error: safeErrorMessage(error),
    });
  }
};

const getClaimById = async (req, res) => {
  try {
    const { claimId } = req.params;

    const claim = await Claim.findOne({ claimId });
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }

    const member = await Member.findOne({ memberId: claim.memberId });

    res.status(200).json({ success: true, data: { claim, member } });
  } catch (error) {
    console.error('Error fetching claim:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching claim',
      error: safeErrorMessage(error),
    });
  }
};

/* Kinukuha at vina-validate ang listahan ng claimIds galing sa request body - string
lang ang tinatanggap (hindi object na puwedeng gawing NoSQL operator), walang duplicate,
at may limit para hindi masyadong malaki ang isang batch. */
const MAX_BATCH_CLAIMS = 100;
const parseClaimIds = (value) => {
  if (!Array.isArray(value)) return null;
  const ids = [...new Set(value.filter((id) => typeof id === 'string').map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0 || ids.length !== value.length || ids.length > MAX_BATCH_CLAIMS) return null;
  return ids;
};
const INVALID_CLAIM_IDS = `Select between 1 and ${MAX_BATCH_CLAIMS} claims to process.`;


/* Pinagsasama ang computation ng preview at ng totoong batch para siguradong yung
napreview ay yung talagang sisingilin: bawat active member ay sisingilin ng rate x
bilang ng claims, isang ledger row bawat claim. */
const summarizeBatch = (claims, rate, members) => {
  const claimCount = claims.length;
  const amountPerMember = round2(rate * claimCount);
  const membersCharged = members.length;
  return {
    claimCount,
    ratePerClaim: rate,
    amountPerMember,
    membersCharged,
    collectedPerClaim: round2(rate * membersCharged),
    totalCollected: round2(amountPerMember * membersCharged),
    membersGoingNegative: members.filter((m) => (m.balance || 0) - amountPerMember < 0).length,
    claims: claims.map((claim) => ({
      claimId: claim.claimId,
      memberName: claim.memberName,
      beneficiaryName: claim.beneficiaryName,
      referenceNumber: hasDeductionPlan(claim) ? claim.deduction.jvNumber : claim.referenceNumber,
    })),
  };
};

/* Read-only dry run ng batch deduction - para makita ng Treasurer kung ilang claim,
ilang member, at magkano ang sisingilin bago ito icommit. Parehong member snapshot na
ginagamit ng processDeductionBatch, wala lang itong isusulat. */
const previewDeductionBatch = async (req, res) => {
  try {
    const claimIds = parseClaimIds(req.body.claimIds);
    if (!claimIds) {
      return res.status(400).json({ success: false, message: INVALID_CLAIM_IDS });
    }

    const claims = await Claim.find({ claimId: { $in: claimIds } }).sort({ dateFiled: 1 });
    const notReady = claimIds.filter((id) => !claims.some((c) => c.claimId === id &&
      (c.status === 'pending_deduction' || c.status === 'deduction_processed' && hasDeductionPlan(c))));
    if (notReady.length) {
      return res.status(400).json({
        success: false,
        message: `These claims are no longer pending deduction: ${notReady.join(', ')}. Refresh the list and try again.`,
      });
    }

    const plan = claims.find(hasDeductionPlan)?.deduction;
    if (plan && (claimIds.some(id => !plan.claimIds.includes(id)) || claims.some(claim => !compatiblePlan(claim, plan)))) {
      return res.status(409).json({ success: false, message: 'Retry unfinished claims from their original deduction batch separately.' });
    }
    const rate = plan ? plan.amountPerMember : (await resolveDeductionRate()).amount;
    if (!Number.isFinite(rate) || rate <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid deduction amount' });
    }

    const { members: snapshots } = await getMemberBalanceSnapshots(plan ? { includeAllStatuses: true } : {});
    const members = plan ? plan.memberIds.map(memberId => snapshots.find(member => member.memberId === memberId) || { memberId, balance: 0 }) : snapshots;
    const summary = summarizeBatch(claims, rate, members);
    if (plan) {
      const ids = members.flatMap(member => claims.map(claim => deductionLedgerId(claim.claimId, member.memberId)));
      const saved = new Set((ids.length ? await Ledger.find({ ledgerId: { $in: ids } }) : []).map(row => row.ledgerId));
      summary.membersGoingNegative = members.filter(member => (member.balance || 0) - rate *
        claims.filter(claim => !saved.has(deductionLedgerId(claim.claimId, member.memberId))).length < 0).length;
    }
    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    console.error('Error previewing deduction batch:', error);
    res.status(500).json({
      success: false,
      message: 'Error previewing deduction batch',
      error: safeErrorMessage(error),
    });
  }
};

/* Flow A, isang batch (hal. lahat ng death claim ng buwan): sisingilin ang bawat
active member ng rate x bilang ng claims, isang ledger row bawat claim na may
sariling reference ng Claim Officer. Bawat claim ay may sariling
deduction record (rate, members charged, kolekta para sa claim na iyon) at batchId
para makita kung aling claims ang sabay na naproseso. */
const processDeductionBatch = async (req, res) => {
  const locked = [];
  const releaseLocks = () => Claim.updateMany(
    { claimId: { $in: locked.map(claim => claim.claimId) }, status: 'deduction_processing' },
    { $set: { status: 'pending_deduction' } }
  );
  try {
    const actor = actorName(req.user, 'treasurer');
    const claimIds = parseClaimIds(req.body.claimIds);
    if (!claimIds) return res.status(400).json({ success: false, message: INVALID_CLAIM_IDS });

    // Claim-level compare-and-set prevents two requests posting the same claim.
    // Completed claims from this resumable batch may accompany pending claims.
    const claims = [];
    for (const claimId of claimIds) {
      const claim = await Claim.findOneAndUpdate(
        { claimId, status: 'pending_deduction' },
        { $set: { status: 'deduction_processing' } }, { new: true }
      );
      if (claim) {
        locked.push(claim);
        claims.push(claim);
        continue;
      }
      const existing = await Claim.findOne({ claimId });
      if (!existing) throw Object.assign(new Error('Claim ' + claimId + ' not found'), { statusCode: 404 });
      if (existing.status === 'deduction_processed' && hasDeductionPlan(existing)) {
        claims.push(existing);
        continue;
      }
      throw Object.assign(new Error('Claim ' + claimId + ' cannot be processed for deduction from status "' + existing.status + '"'), { statusCode: 400 });
    }

    const planned = claims.find(hasDeductionPlan);
    let plan = planned?.deduction;
    if (plan && (claimIds.some(id => !plan.claimIds.includes(id)) || claims.some(claim => !compatiblePlan(claim, plan)))) {
      throw Object.assign(new Error('These claims belong to different deduction batches. Retry the unfinished claims from their original batch separately.'), { statusCode: 409 });
    }
    if (claims.some(claim => !(hasDeductionPlan(claim) ? claim.deduction.jvNumber : claim.referenceNumber)?.trim())) {
      throw Object.assign(new Error('Missing saved reference. Ask the Claim Officer to save a reference for each death before processing.'), { statusCode: 400 });
    }

    // Snapshot the rate and eligible roster once, before any money is posted.
    // Resumes include original members even if their status has since changed.
    const { members: snapshots } = await getMemberBalanceSnapshots(plan ? { includeAllStatuses: true } : {});
    if (!plan) {
      // Older failed batches used random IDs and left no resumable plan. Do
      // not reinterpret those postings or silently debit the same death again.
      const legacyPosting = await Ledger.findOne({
        transactionType: 'automatic_deduction',
        $or: claims.map(claim => ({ referenceId: claim.referenceNumber, description: 'Death fund assessment for ' + claim.memberName })),
      });
      if (legacyPosting) throw Object.assign(new Error('Assessment entries already exist for this death without a saved deduction plan. Review the existing ledger before processing this legacy batch.'), { statusCode: 409 });
      const { amount: rate, settingId } = await resolveDeductionRate();
      if (!Number.isFinite(rate) || rate <= 0) throw Object.assign(new Error('Invalid deduction amount'), { statusCode: 400 });
      plan = {
        batchId: uuidv4(), claimIds, memberIds: snapshots.map(member => member.memberId),
        amountPerMember: rate, deductionSettingId: settingId,
        claimsInBatch: claimIds.length, processedBy: actor, startedAt: new Date(),
      };
    }
    const rate = plan.amountPerMember;
    const befores = new Map(locked.map(claim => [claim.claimId, claim.toObject()]));
    for (const claim of locked) {
      if (hasDeductionPlan(claim)) continue;
      claim.deduction = {
        batchId: plan.batchId, claimIds: [...plan.claimIds], memberIds: [...plan.memberIds],
        amountPerMember: rate, deductionSettingId: plan.deductionSettingId,
        claimsInBatch: plan.claimsInBatch, processedBy: plan.processedBy, startedAt: plan.startedAt,
        jvNumber: claim.referenceNumber,
      };
      await claim.save();
    }

    const ledgerIds = plan.memberIds.flatMap(memberId => claims.map(claim => deductionLedgerId(claim.claimId, memberId)));
    const existingRows = ledgerIds.length ? await Ledger.find({ ledgerId: { $in: ledgerIds } }) : [];
    const saved = new Map(existingRows.map(row => [row.ledgerId, row]));
    const byMember = new Map(snapshots.map(member => [member.memberId, member]));
    const members = plan.memberIds.map(memberId => byMember.get(memberId) || { memberId, balance: 0 });
    const summary = summarizeBatch(claims, rate, members);
    summary.membersGoingNegative = members.filter(member => {
      const remaining = claims.filter(claim => !saved.has(deductionLedgerId(claim.claimId, member.memberId))).length;
      return (member.balance || 0) - rate * remaining < 0;
    }).length;

    const validateSaved = (row, claim, memberId) => {
      if (!row || row.memberId !== memberId || row.transactionType !== 'automatic_deduction' ||
          row.debit !== rate || row.credit !== 0 || row.referenceId !== claim.deduction.jvNumber) {
        throw new Error('Saved deduction does not match its original plan; review is required.');
      }
    };
    for (const memberId of plan.memberIds) {
      for (const claim of claims) {
        const ledgerId = deductionLedgerId(claim.claimId, memberId);
        if (saved.has(ledgerId)) {
          validateSaved(saved.get(ledgerId), claim, memberId);
          continue;
        }
        if (claim.status === 'deduction_processed') throw new Error('A completed claim is missing a saved deduction; review is required.');
        if (!byMember.has(memberId)) throw new Error('An original member is no longer available; review is required.');
        const { ledger } = await postLedgerEntry({
          ledgerId, memberId, transactionType: 'automatic_deduction',
          description: 'Death fund assessment for ' + claim.memberName,
          debit: rate, credit: 0, referenceId: claim.deduction.jvNumber,
          transactionDate: claim.dateFiled || new Date(), recordedBy: plan.processedBy,
        });
        validateSaved(ledger, claim, memberId);
        saved.set(ledgerId, ledger);
      }
    }

    // Never delete acknowledged postings on failure. The stable ledgerId's
    // unique index and saved plan make both partial writes and lost replies safe
    // to retry, including failure after some claims were already completed.
    const now = new Date();
    for (const claim of locked) {
      claim.status = 'deduction_processed';
      claim.deduction.membersCharged = plan.memberIds.length;
      claim.deduction.totalCollected = round2(rate * plan.memberIds.length);
      claim.deduction.processedAt = now;
      claim.statusHistory.push({
        status: 'deduction_processed', changedBy: actor, changedAt: now,
        notes: 'JV ' + claim.deduction.jvNumber + ': charged ' + plan.memberIds.length + ' members PHP ' + rate + ' for this claim',
      });
      await claim.save();
      await createAuditLog({
        userId: req.user?.userId, userName: actor, userRole: req.user?.role || 'treasurer',
        action: 'claim_deduction_processed', module: 'mortuary', entityType: 'claim',
        entityId: claim.claimId, entityName: claim.memberName,
        description: 'JV ' + claim.deduction.jvNumber + ': charged ' + plan.memberIds.length + ' members PHP ' + rate + ' for claim ' + claim.claimId,
        changes: { before: befores.get(claim.claimId), after: claim.toObject() },
        status: 'success', ipAddress: req.ip, userAgent: req.get('user-agent'),
      });
    }
    return res.status(200).json({
      success: true, message: 'Deduction processed for ' + claims.length + ' claims and ' + plan.memberIds.length + ' members',
      data: { ...summary, batchId: plan.batchId, processedBy: plan.processedBy, processedAt: claims[0].deduction.processedAt },
    });
  } catch (error) {
    if (locked.length) {
      try { await releaseLocks(); }
      catch (releaseError) { console.error('Unable to release deduction locks:', releaseError); }
    }
    console.error('Error processing deduction batch:', error);
    return res.status(error.statusCode || error.status || 500).json({
      success: false,
      message: error.statusCode || error.status ? error.message : 'Deduction could not finish. Retry the same claims; saved charges will not be deducted again.',
      error: safeErrorMessage(error),
    });
  }
};

module.exports = {
  listAllClaims,
  listPendingDeduction,
  listDeductionSummary,
  getClaimById,
  previewDeductionBatch,
  processDeductionBatch,
};
