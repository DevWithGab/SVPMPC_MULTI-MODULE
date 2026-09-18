// Treasurer-side claim processing.
//
// Kept as its own file, separate from deductionController.js, so the two
// money flows a claim drives stay visibly distinct in the codebase:
//   - Flow A (collection/assessment): every OTHER active member is charged
//     a small fixed amount into their own ledger when a member dies. This
//     already existed as a blanket, manually-triggered action
//     (processAutomaticDeduction); processClaimDeduction below is the same
//     mechanism, run per-claim instead, using the configurable
//     DeductionSetting rate and tagging every ledger row with the claimId.
//   - Flow B (payout): the pool Flow A just collected — the sum of what was
//     deducted from every other member's ledger for this claim — is paid out
//     to the deceased member's beneficiary, capped at MAX_BENEFIT_AMOUNT. Any
//     surplus above the cap is the cooperative's income. The deceased member's
//     OWN ledger balance is deliberately not the payout figure: it is their
//     personal contribution balance, not the death benefit.
const Claim = require('../models/Claim');
const DeductionSetting = require('../models/DeductionSetting');
const Ledger = require('../models/Ledger');
const { Member } = require('../../../shared/models');
const { v4: uuidv4 } = require('uuid');
const { getPaginationParams, buildPaginatedResponse } = require('../../../shared/utils/pagination');
const { getMemberBalanceSnapshots } = require('./deductionController');
const { getClaimFinancialTotals } = require('./dashboardController');
const { checkAndNotify } = require('../services/thresholdNotificationService');
const { createAuditLog } = require('../../../shared/services/auditLoggingService');
const { getLatestBalance } = require('../utils/ledgerBalance');
const {
  MAX_BENEFIT_AMOUNT,
  benefitPayoutFor,
  benefitSurplusFor,
} = require('../config/claimBenefit');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Matches DEFAULT_DEDUCTION_AMOUNT in deductionSettingController — used only if
// no rate row exists yet (the Admin screen auto-seeds one on first view).
const FALLBACK_DEDUCTION_AMOUNT = 25;

// The per-member deduction is set by the Admin in Deduction Settings and is not
// the Treasurer's to choose, so both the preview and the real run resolve it
// here rather than trusting anything off the request. That also guarantees the
// amount previewed is the amount actually charged.
const resolveDeductionRate = async () => {
  const setting = await DeductionSetting.findOne({ status: 'active' });
  return {
    amount: setting?.amount ?? FALLBACK_DEDUCTION_AMOUNT,
    settingId: setting?.settingId,
  };
};

// Both the Awaiting Release list and releaseClaim resolve the payout here so
// the figure previewed is the figure actually released. totalCollected is
// recorded on the claim at deduction time; the cap and the split live in
// config/claimBenefit so the dashboards report against the same rule.
const resolvePayoutAmount = (claim) => benefitPayoutFor(claim?.deduction?.totalCollected ?? 0);

// A claim sitting in "pending_deduction" IS the notification to the
// Treasurer — this codebase has no generic in-app notification system
// (only SMS, mostly stubbed), so a live query is the pragmatic mechanism.
const listPendingDeduction = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const query = { status: 'pending_deduction' };

    const total = await Claim.countDocuments(query);
    const claims = await Claim.find(query).sort({ dateFiled: 1 }).skip(skip).limit(limit);

    res.status(200).json(buildPaginatedResponse(claims, total, page, limit));
  } catch (error) {
    console.error('Error fetching pending-deduction claims:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending-deduction claims',
      error: error.message,
    });
  }
};

const listAwaitingRelease = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const query = { status: 'deduction_processed' };

    const total = await Claim.countDocuments(query);
    const claims = await Claim.find(query).sort({ dateFiled: 1 }).skip(skip).limit(limit).lean();

    // The payout is derived from what was collected for the claim — the
    // Treasurer does not get to choose it — so send the resolved split along
    // explicitly for the disbursement form to display read-only.
    const withPayout = claims.map((claim) => {
      const payoutAmount = resolvePayoutAmount(claim);
      return {
        ...claim,
        payoutAmount,
        retainedAmount: Math.round(((claim.deduction?.totalCollected ?? 0) - payoutAmount) * 100) / 100,
        maxBenefitAmount: MAX_BENEFIT_AMOUNT,
      };
    });

    res.status(200).json(buildPaginatedResponse(withPayout, total, page, limit));
  } catch (error) {
    console.error('Error fetching claims awaiting release:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching claims awaiting release',
      error: error.message,
    });
  }
};

// The Claim Disbursement Report — every claim that has already been paid
// out, for record-keeping (DV number, who released it, when, how much).
const listReleasedClaims = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const { search } = req.query;
    const query = { status: 'released' };

    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      query.$or = [
        { claimId: regex },
        { memberName: regex },
        { beneficiaryName: regex },
        { 'payout.dvNumber': regex },
      ];
    }

    const total = await Claim.countDocuments(query);
    const claims = await Claim.find(query).sort({ 'payout.releasedAt': -1 }).skip(skip).limit(limit);

    res.status(200).json(buildPaginatedResponse(claims, total, page, limit));
  } catch (error) {
    console.error('Error fetching disbursement report:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching disbursement report',
      error: error.message,
    });
  }
};

// The Claims Income Report — one row per claim that has reached the deduction
// stage, showing where its money went: collected from the members, released to
// the beneficiary, and retained by the cooperative. This is the per-claim
// breakdown behind the three dashboard tiles, so a Treasurer can see which
// claims produced the totals rather than just the totals.
//
// Income is derived the same way getClaimFinancialTotals derives it, and for
// the same reasons: the actual payout once a claim is settled, the capped
// projection before then. Keeping the two in step is why the rule lives in
// config/claimBenefit rather than being spelled out in either place.
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

    const round = (n) => Math.round((n || 0) * 100) / 100;
    const rows = claims.map((claim) => {
      const collected = claim.deduction?.totalCollected ?? 0;
      const released = claim.payout?.amount ?? null;
      const settled = released != null;
      return {
        claimId: claim.claimId,
        memberName: claim.memberName,
        beneficiaryName: claim.beneficiaryName,
        status: claim.status,
        amountPerMember: claim.deduction?.amountPerMember ?? 0,
        membersCharged: claim.deduction?.membersCharged ?? 0,
        totalCollected: collected,
        // Still held for an unreleased claim, matching the dashboard tile.
        amountHeld: settled ? 0 : collected,
        // null until released, so the UI can show "pending" rather than ₱0.
        amountReleased: released,
        // Income is recognised on release, so an unsettled claim contributes 0
        // to the totals. The projections below are display-only: what this
        // claim WILL release and retain, shown greyed out so a forecast is
        // never mistaken for money that has already moved.
        netIncome: settled ? round(collected - released) : 0,
        projectedRelease: benefitPayoutFor(collected),
        projectedIncome: benefitSurplusFor(collected),
        settled,
        capApplied: collected > MAX_BENEFIT_AMOUNT,
        processedAt: claim.deduction?.processedAt ?? null,
        releasedAt: claim.payout?.releasedAt ?? null,
        dvNumber: claim.payout?.dvNumber ?? null,
      };
    });

    // Totals span every matching claim, not just the page being shown — a
    // report footer that only added up the current page would be misleading.
    const totals = await getClaimFinancialTotals(query);

    res.status(200).json({
      ...buildPaginatedResponse(rows, total, page, limit),
      totals,
      maxBenefitAmount: MAX_BENEFIT_AMOUNT,
    });
  } catch (error) {
    console.error('Error fetching claim income report:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching claim income report',
      error: error.message,
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
      error: error.message,
    });
  }
};

// Read-only dry run of Flow A — lets the Treasurer see exactly who and how
// much this deduction will touch before committing to it. Same member
// snapshot processClaimDeduction uses, just without writing anything.
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
      error: error.message,
    });
  }
};

// Flow A, per claim: charge every other active member the configured rate,
// same mechanism as the blanket automatic-deduction, tagged to this claim.
const processClaimDeduction = async (req, res) => {
  try {
    const { claimId } = req.params;
    const processedBy = req.body.processedBy || req.user?.username || 'treasurer';

    const claim = await Claim.findOne({ claimId });
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }
    if (claim.status !== 'pending_deduction') {
      return res.status(400).json({
        success: false,
        message: `Claim cannot be processed for deduction from status "${claim.status}"`,
      });
    }

    const { amount: deductionAmount, settingId: deductionSettingId } = await resolveDeductionRate();

    if (isNaN(deductionAmount) || deductionAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid deduction amount' });
    }

    const { members } = await getMemberBalanceSnapshots();

    let totalCollected = 0;
    let membersCharged = 0;

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
          referenceId: claimId,
          transactionDate: new Date(),
          recordedBy: processedBy,
        });
        await ledgerEntry.save();

        totalCollected += deductionAmount;
        membersCharged += 1;

        try {
          await checkAndNotify(
            member.memberId,
            member.memberName,
            member.phoneNumber,
            currentBalance,
            newBalance,
            'deduction',
            ledgerEntry.ledgerId,
          );
        } catch (notificationError) {
          console.error(`Error sending threshold notification for ${member.memberId}:`, notificationError);
        }
      } catch (memberError) {
        console.error(`Error processing deduction for member ${member.memberId}:`, memberError);
      }
    }

    const before = claim.toObject();
    const now = new Date();
    claim.status = 'deduction_processed';
    claim.deduction = {
      deductionSettingId,
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
      notes: `Charged ${membersCharged} active members ₱${deductionAmount} each (₱${totalCollected} total)`,
    });

    await claim.save();

    await createAuditLog({
      userId: req.user?.id,
      userName: processedBy,
      userRole: req.user?.role || 'treasurer',
      action: 'claim_deduction_processed',
      module: 'mortuary',
      entityType: 'claim',
      entityId: claim.claimId,
      entityName: claim.memberName,
      description: `Charged ${membersCharged} active members ₱${deductionAmount} each (₱${totalCollected} total) for claim ${claim.claimId}`,
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
      error: error.message,
    });
  }
};

// Flow B, per claim: pay the pool collected in Flow A out to the beneficiary —
// this is the Claim Disbursement recording step. A DV (Disbursement Voucher)
// number is required since it's the physical paper trail the cooperative's own
// accounting already relies on.
const releaseClaim = async (req, res) => {
  try {
    const { claimId } = req.params;
    const { paymentMethod, dvNumber, releaseDate, remarks } = req.body;
    const releasedBy = req.body.releasedBy || req.user?.username || 'treasurer';

    if (!dvNumber?.trim()) {
      return res.status(400).json({ success: false, message: 'A DV (Disbursement Voucher) number is required' });
    }

    const claim = await Claim.findOne({ claimId });
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }
    if (claim.status !== 'deduction_processed') {
      return res.status(400).json({
        success: false,
        message: `Claim cannot be released from status "${claim.status}"`,
      });
    }

    // The death benefit is the pool collected from the other members for this
    // claim, capped at MAX_BENEFIT_AMOUNT — it is not a figure the Treasurer
    // (or anything on the request) gets to set, so any amount sent by a client
    // is deliberately ignored.
    const totalCollected = claim.deduction?.totalCollected ?? 0;
    const payoutAmount = resolvePayoutAmount(claim);
    // Surplus above the cap is the cooperative's income. Never written to a
    // member ledger — it belongs to no member. getClaimFinancialTotals derives
    // the same figure per claim to report Net Claims Income.
    const retainedAmount = benefitSurplusFor(totalCollected);

    if (isNaN(payoutAmount) || payoutAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid payout amount' });
    }

    const parsedReleaseDate = releaseDate ? new Date(releaseDate) : new Date();
    const effectiveReleaseDate = isNaN(parsedReleaseDate.getTime()) ? new Date() : parsedReleaseDate;

    const currentBalance = await getLatestBalance(claim.memberId);
    const before = claim.toObject();

    // The payout passes THROUGH the deceased member's ledger rather than out of
    // it: the money came from the assessment charged to the other members, so it
    // is recorded credit-in/debit-out on the same row and leaves the deceased
    // member's own contribution balance untouched. Only the released benefit is
    // recorded here — the retained surplus is cooperative income and belongs to
    // no member's ledger.
    const ledgerEntry = new Ledger({
      ledgerId: uuidv4(),
      memberId: claim.memberId,
      transactionType: 'claim_payout',
      description: `Death benefit payout to ${claim.beneficiaryName} from death fund assessment (DV# ${dvNumber.trim()})`,
      credit: payoutAmount,
      debit: payoutAmount,
      balance: currentBalance,
      referenceId: claimId,
      beneficiary: claim.beneficiaryName,
      paymentMethod: paymentMethod || 'cash',
      transactionDate: effectiveReleaseDate,
      recordedBy: releasedBy,
    });
    await ledgerEntry.save();

    const now = new Date();
    claim.status = 'released';
    claim.payout = {
      amount: payoutAmount,
      paymentMethod: paymentMethod || 'cash',
      dvNumber: dvNumber.trim(),
      remarks: remarks?.trim() || undefined,
      releasedBy,
      releasedAt: effectiveReleaseDate,
      ledgerId: ledgerEntry.ledgerId,
    };
    claim.statusHistory.push({
      status: 'released',
      changedBy: releasedBy,
      changedAt: now,
      notes: retainedAmount > 0
        ? `₱${payoutAmount} released to ${claim.beneficiaryName} (DV# ${dvNumber.trim()}); ₱${retainedAmount} of the ₱${totalCollected} collected retained as cooperative income`
        : `₱${payoutAmount} released to ${claim.beneficiaryName} (DV# ${dvNumber.trim()})`,
    });

    await claim.save();

    await createAuditLog({
      userId: req.user?.id,
      userName: releasedBy,
      userRole: req.user?.role || 'treasurer',
      action: 'claim_released',
      module: 'mortuary',
      entityType: 'claim',
      entityId: claim.claimId,
      entityName: claim.memberName,
      description: `Released ₱${payoutAmount} of ₱${totalCollected} collected to ${claim.beneficiaryName} for claim ${claim.claimId} (DV# ${dvNumber.trim()})${retainedAmount > 0 ? `; ₱${retainedAmount} retained as cooperative income` : ''}`,
      changes: { before, after: claim.toObject() },
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(200).json({
      success: true,
      message: 'Claim released successfully',
      data: claim,
    });
  } catch (error) {
    console.error('Error releasing claim:', error);
    res.status(500).json({
      success: false,
      message: 'Error releasing claim',
      error: error.message,
    });
  }
};

module.exports = {
  listPendingDeduction,
  listAwaitingRelease,
  listReleasedClaims,
  listClaimFinancials,
  getClaimById,
  processClaimDeduction,
  previewClaimDeduction,
  releaseClaim,
};
