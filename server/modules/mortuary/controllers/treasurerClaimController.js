/* Treasurer-side claim processing.

Hiniwalay ito sa sarili nitong file, bukod sa deductionController.js, para manatiling
klaro at distinct sa codebase yung money flow na dulot ng isang claim:
  - Flow A (collection/assessment): sisingilin ang bawat ibang active member ng maliit
    na fixed amount papunta sa sari-sariling ledger nila kapag namatay ang isang
    member. Dati pa itong existing bilang blanket, manually-triggered action
    (processAutomaticDeduction); ang processClaimDeduction sa baba ay parehong
    mekanismo, tumatakbo lang per-claim, gamit ang configurable DeductionSetting rate
    at tinatag ang bawat ledger row ng claimId.

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

/* Read-only dry run ng Flow A - para makita ng Treasurer kung sino eksakto at
magkano ang maaapektuhan ng deduction na ito bago ito icommit. Parehong member
snapshot na ginagamit ng processClaimDeduction, wala lang itong isusulat. */
const previewClaimDeduction = async (req, res) => {
  try {
    const { claimId } = req.params;
    const claim = await Claim.findOne({ claimId });
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }
    if (claim.status !== 'pending_deduction') {
      return res.status(400).json({
        success: false,
        message: `Claim cannot be previewed for deduction from status "${claim.status}"`,
      });
    }

    const { amount: amountPerMember } = await resolveDeductionRate();

    if (isNaN(amountPerMember) || amountPerMember <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid deduction amount' });
    }

    const { members } = await getMemberBalanceSnapshots();
    const membersCharged = members.length;
    const totalCollected = Math.round(amountPerMember * membersCharged * 100) / 100;
    const membersGoingNegative = members.filter((m) => (m.balance || 0) - amountPerMember < 0).length;

    res.status(200).json({
      success: true,
      data: {
        claimId,
        memberName: claim.memberName,
        amountPerMember,
        membersCharged,
        totalCollected,
        membersGoingNegative,
      },
    });
  } catch (error) {
    console.error('Error previewing claim deduction:', error);
    res.status(500).json({
      success: false,
      message: 'Error previewing claim deduction',
      error: safeErrorMessage(error),
    });
  }
};

/* Flow A, per claim: sisingilin ang bawat ibang active member ng configured rate,
parehong mekanismo ng blanket automatic-deduction, tinag sa claim na ito. */
const processClaimDeduction = async (req, res) => {
  try {
    const { claimId } = req.params;
    const processedBy = actorName(req.user, 'treasurer');
    const jvNumber = String(req.body.jvNumber || '').trim();

    if (!jvNumber) {
      return res.status(400).json({
        success: false,
        message: 'JV (Journal Disbursement) number is required before processing the deduction',
      });
    }

    /* Treasurers often still type a literal "JV#"/"JV-" prefix out of habit
    from the paper JV slip, but the ledger's own Reference column already
    makes it a deduction entry via its transaction type - repeating "JV#"
    there is just noise. Strip it for the ledger's own reference only; the
    claim record and audit trail below keep the number exactly as entered. */
    const ledgerReference = jvNumber.replace(/^jv\s*[#:\-.]?\s*/i, '') || jvNumber;

    /* Atomically kinukuha dito ang exclusive right ng request na ito para iproseso ang
    deduction. Kung dumating sabay ang dalawang request para sa parehong claim
    (double-click, retried request, dalawang open tabs), yun lang talagang nakapagpalit
    ng pending_deduction -> deduction_processing ang mananalo - ang isa ay makukuha ng
    null pabalik at mareject sa baba, imbes na dalawa silang magsisingil sa lahat ng
    active member. */
    const claim = await Claim.findOneAndUpdate(
      { claimId, status: 'pending_deduction' },
      { $set: { status: 'deduction_processing' } },
      { new: true }
    );
    if (!claim) {
      const existing = await Claim.findOne({ claimId });
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Claim not found' });
      }
      return res.status(400).json({
        success: false,
        message: `Claim cannot be processed for deduction from status "${existing.status}"`,
      });
    }

    /* Idineklara dito (hindi sa loob ng try sa baba) dahil kailangan pa rin itong basahin
    ng audit log at response na gagawin pagkatapos ng try block na iyon. */
    let before, deductionAmount, totalCollected = 0, membersCharged = 0;

    try {
      let deductionSettingId;
      ({ amount: deductionAmount, settingId: deductionSettingId } = await resolveDeductionRate());

      if (isNaN(deductionAmount) || deductionAmount <= 0) {
        throw Object.assign(new Error('Invalid deduction amount'), { statusCode: 400 });
      }

      const { members } = await getMemberBalanceSnapshots();

      for (const member of members) {
        try {
          const currentBalance = member.balance || 0;
          const newBalance = currentBalance - deductionAmount;

          const ledgerEntry = new Ledger({
            ledgerId: uuidv4(),
            memberId: member.memberId,
            transactionType: 'automatic_deduction',
            description: `Death fund assessment for ${claim.memberName}`,
            debit: deductionAmount,
            credit: 0,
            balance: newBalance,
            referenceId: ledgerReference,
            transactionDate: new Date(),
            recordedBy: processedBy,
          });
          await ledgerEntry.save();

          totalCollected += deductionAmount;
          membersCharged += 1;

        } catch (memberError) {
          console.error(`Error processing deduction for member ${member.memberId}:`, memberError);
        }
      }

      before = claim.toObject();
      const now = new Date();
      claim.status = 'deduction_processed';
      claim.deduction = {
        deductionSettingId,
        jvNumber,
        amountPerMember: deductionAmount,
        membersCharged,
        totalCollected,
        processedBy,
        processedAt: now,
      };
      claim.statusHistory.push({
        status: 'deduction_processed',
        changedBy: processedBy,
        changedAt: now,
        notes: `JV ${jvNumber}: charged ${membersCharged} active members ₱${deductionAmount} each (₱${totalCollected} total)`,
      });

      await claim.save();
    } catch (error) {
      /* Ibabalik ang lock para hindi matagalang tigil ang claim sa "deduction_processing"
      kapag nagfail sa gitna ang rate lookup, member snapshot, o final save - para
      puwedeng i-retry ng Treasurer mula sa parehong pending_deduction state. */
      await Claim.updateOne({ claimId, status: 'deduction_processing' }, { $set: { status: 'pending_deduction' } });
      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      throw error;
    }

    await createAuditLog({
      userId: req.user?.userId,
      userName: processedBy,
      userRole: req.user?.role || 'treasurer',
      action: 'claim_deduction_processed',
      module: 'mortuary',
      entityType: 'claim',
      entityId: claim.claimId,
      entityName: claim.memberName,
      description: `JV ${jvNumber}: charged ${membersCharged} active members ₱${deductionAmount} each (₱${totalCollected} total) for claim ${claim.claimId}`,
      changes: { before, after: claim.toObject() },
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(200).json({
      success: true,
      message: `Deduction processed for ${membersCharged} members`,
      data: claim,
    });
  } catch (error) {
    console.error('Error processing claim deduction:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing claim deduction',
      error: safeErrorMessage(error),
    });
  }
};

module.exports = {
  listAllClaims,
  listPendingDeduction,
  listClaimFinancials,
  getClaimById,
  processClaimDeduction,
  previewClaimDeduction,
};
