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
const { getPaginationParams, buildPaginatedResponse } = require('../../../shared/utils/pagination');
const { getMemberBalanceSnapshots } = require('./deductionController');
const { createAuditLog } = require('../../../shared/services/auditLoggingService');
const { safeErrorMessage } = require('../../../middleware/errorHandler');
const { actorName } = require('../../../shared/utils/actorName');

const round2 = (n) => Math.round(n * 100) / 100;

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
      referenceNumber: claim.referenceNumber,
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
    const notReady = claimIds.filter((id) => !claims.some((c) => c.claimId === id && c.status === 'pending_deduction'));
    if (notReady.length) {
      return res.status(400).json({
        success: false,
        message: `These claims are no longer pending deduction: ${notReady.join(', ')}. Refresh the list and try again.`,
      });
    }

    const { amount: rate } = await resolveDeductionRate();
    if (isNaN(rate) || rate <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid deduction amount' });
    }

    const { members } = await getMemberBalanceSnapshots();
    res.status(200).json({ success: true, data: summarizeBatch(claims, rate, members) });
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
  try {
    const processedBy = actorName(req.user, 'treasurer');
    const claimIds = parseClaimIds(req.body.claimIds);

    if (!claimIds) {
      return res.status(400).json({ success: false, message: INVALID_CLAIM_IDS });
    }

    /* Isa-isang kinukuha ang exclusive lock ng bawat claim (pending_deduction ->
    deduction_processing, atomic per document). Kung may isang claim na hindi
    makuha - naproseso na, nasa ibang batch na sabay na tumatakbo, o wala - ibabalik
    ang mga nakuha na at irereject ang buong batch, para walang member na
    masisingil para sa kalahating batch o dalawang beses para sa iisang claim. */
    const locked = [];
    const releaseLocks = () => Claim.updateMany(
      { claimId: { $in: locked.map((c) => c.claimId) }, status: 'deduction_processing' },
      { $set: { status: 'pending_deduction' } }
    );
    for (const claimId of claimIds) {
      const claim = await Claim.findOneAndUpdate(
        { claimId, status: 'pending_deduction' },
        { $set: { status: 'deduction_processing' } },
        { new: true }
      );
      if (!claim) {
        if (locked.length) await releaseLocks();
        const existing = await Claim.findOne({ claimId });
        if (!existing) {
          return res.status(404).json({ success: false, message: `Claim ${claimId} not found` });
        }
        return res.status(400).json({
          success: false,
          message: `Claim ${claimId} cannot be processed for deduction from status "${existing.status}"`,
        });
      }
      locked.push(claim);
    }

    if (locked.some(claim => !claim.referenceNumber?.trim())) {
      await releaseLocks();
      return res.status(400).json({ success: false, message: `Missing saved reference for: ${locked.filter(claim => !claim.referenceNumber?.trim()).map(claim => claim.memberName || claim.claimId).join(', ')}. Ask the Claim Officer to open each claim, enter the reference, and click Save verification and reference.` });
    }
    const batchId = uuidv4();
    let summary;
    const befores = new Map();

    try {
      const { amount: rate, settingId: deductionSettingId } = await resolveDeductionRate();
      if (isNaN(rate) || rate <= 0) {
        throw Object.assign(new Error('Invalid deduction amount'), { statusCode: 400 });
      }

      const { members } = await getMemberBalanceSnapshots();

      /* Isang ledger row bawat claim para hiwalay ang reference at halaga ng bawat
      death sa ledger ng member. Kapag pumalya ang isang row, binubura ang mga
      naisulat na para sa member na iyon para buo o wala ang singil sa kanya. */
      const charged = [];
      for (const member of members) {
        const savedIds = [];
        try {
          let balance = member.balance || 0;
          for (const claim of locked) {
            balance = round2(balance - rate);
            const ledgerEntry = new Ledger({
              ledgerId: uuidv4(),
              memberId: member.memberId,
              transactionType: 'automatic_deduction',
              description: `Death fund assessment for ${claim.memberName}`,
              debit: rate,
              credit: 0,
              balance,
              referenceId: claim.referenceNumber,
              // Petsa ng pag-file ng claim ang ipinapakita sa ledger, hindi ang araw ng deduction.
              transactionDate: claim.dateFiled || new Date(),
              recordedBy: processedBy,
            });
            await ledgerEntry.save();
            savedIds.push(ledgerEntry.ledgerId);
          }
          charged.push(member);
        } catch (memberError) {
          console.error(`Error processing deduction for member ${member.memberId}:`, memberError);
          if (savedIds.length) await Ledger.deleteMany({ ledgerId: { $in: savedIds } });
        }
      }

      summary = summarizeBatch(locked, rate, charged);
      const now = new Date();
      for (const claim of locked) {
        befores.set(claim.claimId, claim.toObject());
        claim.status = 'deduction_processed';
        claim.deduction = {
          deductionSettingId,
          jvNumber: claim.referenceNumber,
          batchId,
          claimsInBatch: locked.length,
          amountPerMember: rate,
          membersCharged: summary.membersCharged,
          totalCollected: summary.collectedPerClaim,
          processedBy,
          processedAt: now,
        };
        claim.statusHistory.push({
          status: 'deduction_processed',
          changedBy: processedBy,
          changedAt: now,
          notes: `JV ${claim.referenceNumber}: batch of ${locked.length} claims - charged ${summary.membersCharged} active members ₱${rate} for this claim (₱${summary.collectedPerClaim} collected)`,
        });
        await claim.save();
      }
    } catch (error) {
      /* Ibabalik ang locks para hindi matagalang tigil ang claims sa
      "deduction_processing" kapag nagfail sa gitna ang rate lookup, member snapshot,
      o final save - para puwedeng i-retry ng Treasurer mula sa pending_deduction. */
      await releaseLocks();
      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      throw error;
    }

    for (const claim of locked) {
      await createAuditLog({
        userId: req.user?.userId,
        userName: processedBy,
        userRole: req.user?.role || 'treasurer',
        action: 'claim_deduction_processed',
        module: 'mortuary',
        entityType: 'claim',
        entityId: claim.claimId,
        entityName: claim.memberName,
        description: `JV ${claim.referenceNumber}: batch of ${locked.length} claims - charged ${summary.membersCharged} active members ₱${summary.ratePerClaim} for claim ${claim.claimId} (₱${summary.collectedPerClaim} collected)`,
        changes: { before: befores.get(claim.claimId), after: claim.toObject() },
        status: 'success',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    }

    res.status(200).json({
      success: true,
      message: `Deduction processed for ${locked.length} claims and ${summary.membersCharged} members`,
      data: { ...summary, batchId, processedBy, processedAt: locked[0].deduction.processedAt },
    });
  } catch (error) {
    console.error('Error processing deduction batch:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing deduction batch',
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
