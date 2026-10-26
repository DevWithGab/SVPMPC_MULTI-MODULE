/* Treasurer-side claim processing.

Hiniwalay ito sa sarili nitong file, bukod sa deductionController.js, para manatiling
klaro at distinct sa codebase yung money flow na dulot ng isang claim:
  - Flow A (collection/assessment): sisingilin ang bawat ibang active member ng maliit
    na fixed amount papunta sa sari-sariling ledger nila kapag namatay ang isang
    member. Dati pa itong existing bilang blanket, manually-triggered action
    (processAutomaticDeduction); ang processDeductionBatch sa baba ay parehong
    mekanismo, tumatakbo lang para sa mga piniling claim (hal. lahat ng death claim
    ng buwan), gamit ang configurable DeductionSetting rate at iisang JV number.

Ang deduction na ang huling hakbang ng claim - wala nang release/disbursement step
sa system, kaya kolekta lang ang tina-track dito. */
const Claim = require('../models/Claim');
const DeductionSetting = require('../models/DeductionSetting');
const Ledger = require('../models/Ledger');
const { Member } = require('../../../shared/models');
const { v4: uuidv4 } = require('uuid');
const { getPaginationParams, buildPaginatedResponse } = require('../../../shared/utils/pagination');
const { getMemberBalanceSnapshots } = require('./deductionController');
const { getClaimFinancialTotals } = require('./dashboardController');
const { createAuditLog } = require('../../../shared/services/auditLoggingService');
const { safeErrorMessage } = require('../../../middleware/errorHandler');
const { actorName } = require('../../../shared/utils/actorName');

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

/* Ang Claims Summary - isang row per claim na nakarating na sa deduction stage,
nagpapakita kung magkano ang nakolekta mula sa members para sa bawat claim. Ito ang
per-claim breakdown sa likod ng "Total deductions collected" dashboard tile. */
const listClaimFinancials = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const { search } = req.query;

    // Claims that never reached a deduction have no money to report on.
    const query = { 'deduction.totalCollected': { $gt: 0 } };
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ claimId: regex }, { memberName: regex }, { beneficiaryName: regex }];
    }

    const total = await Claim.countDocuments(query);
    const claims = await Claim.find(query)
      .sort({ 'deduction.processedAt': -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const rows = claims.map((claim) => ({
      claimId: claim.claimId,
      memberName: claim.memberName,
      beneficiaryName: claim.beneficiaryName,
      status: claim.status,
      amountPerMember: claim.deduction?.amountPerMember ?? 0,
      membersCharged: claim.deduction?.membersCharged ?? 0,
      totalCollected: claim.deduction?.totalCollected ?? 0,
      processedAt: claim.deduction?.processedAt ?? null,
    }));

    /* Sakop ng totals lahat ng matching claim, hindi lang yung page na ipinapakita -
    magiging misleading kung ang report footer ay idadagdag lang base sa current page. */
    const totals = await getClaimFinancialTotals(query);

    res.status(200).json({
      ...buildPaginatedResponse(rows, total, page, limit),
      totals,
    });
  } catch (error) {
    console.error('Error fetching claim income report:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching claim income report',
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

const round2 = (n) => Math.round(n * 100) / 100;

/* Pinagsasama ang computation ng preview at ng totoong batch para siguradong yung
napreview ay yung talagang sisingilin: bawat active member ay sisingilin ng rate x
bilang ng claims, isang beses lang (isang ledger row) para sa buong batch. */
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

/* Flow A, isang batch (hal. lahat ng death claim ng buwan): isang beses lang
sisingilin ang bawat active member - rate x bilang ng claims, isang ledger row - at
iisang JV number ang gamit ng lahat ng claim sa batch. Bawat claim ay may sariling
deduction record (rate, members charged, kolekta para sa claim na iyon) at batchId
para makita kung aling claims ang sabay na naproseso. */
const processDeductionBatch = async (req, res) => {
  try {
    const processedBy = actorName(req.user, 'treasurer');
    const jvNumber = String(req.body.jvNumber || '').trim();
    const claimIds = parseClaimIds(req.body.claimIds);

    if (!jvNumber) {
      return res.status(400).json({
        success: false,
        message: 'JV (Journal Disbursement) number is required before processing the deduction',
      });
    }
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

    const batchId = uuidv4();
    let summary;
    const befores = new Map();

    try {
      const { amount: rate, settingId: deductionSettingId } = await resolveDeductionRate();
      if (isNaN(rate) || rate <= 0) {
        throw Object.assign(new Error('Invalid deduction amount'), { statusCode: 400 });
      }

      const { members } = await getMemberBalanceSnapshots();
      const amountPerMember = round2(rate * locked.length);
      const description = locked.length === 1
        ? `Death fund assessment for ${locked[0].memberName}`
        : `Death fund assessment for ${locked.length} death claims`;

      const charged = [];
      for (const member of members) {
        try {
          const ledgerEntry = new Ledger({
            ledgerId: uuidv4(),
            memberId: member.memberId,
            transactionType: 'automatic_deduction',
            description,
            debit: amountPerMember,
            credit: 0,
            balance: round2((member.balance || 0) - amountPerMember),
            // Kept exactly as entered (e.g. "JV-1923823"), same as the claim record.
            referenceId: jvNumber,
            transactionDate: new Date(),
            recordedBy: processedBy,
          });
          await ledgerEntry.save();
          charged.push(member);
        } catch (memberError) {
          console.error(`Error processing deduction for member ${member.memberId}:`, memberError);
        }
      }

      summary = summarizeBatch(locked, rate, charged);
      const now = new Date();
      for (const claim of locked) {
        befores.set(claim.claimId, claim.toObject());
        claim.status = 'deduction_processed';
        claim.deduction = {
          deductionSettingId,
          jvNumber,
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
          notes: `JV ${jvNumber}: batch of ${locked.length} claims - charged ${summary.membersCharged} active members ₱${rate} for this claim (₱${summary.collectedPerClaim} collected)`,
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
        description: `JV ${jvNumber}: batch of ${locked.length} claims - charged ${summary.membersCharged} active members ₱${summary.ratePerClaim} for claim ${claim.claimId} (₱${summary.collectedPerClaim} collected)`,
        changes: { before: befores.get(claim.claimId), after: claim.toObject() },
        status: 'success',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    }

    res.status(200).json({
      success: true,
      message: `Deduction processed for ${locked.length} claims and ${summary.membersCharged} members`,
      data: { ...summary, batchId, jvNumber, processedBy, processedAt: locked[0].deduction.processedAt },
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
  listClaimFinancials,
  getClaimById,
  previewDeductionBatch,
  processDeductionBatch,
};
