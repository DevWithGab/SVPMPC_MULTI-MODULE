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
//   - Flow B (payout): the DECEASED member's own accumulated ledger balance
//     is paid out to their beneficiary. This already existed as
//     recordPayout (payoutController.js); releaseClaim below is the same
//     mechanism, driven by a specific claim.
const Claim = require('../models/Claim');
const DeductionSetting = require('../models/DeductionSetting');
const Ledger = require('../models/Ledger');
const { Member } = require('../../../shared/models');
const { v4: uuidv4 } = require('uuid');
const { getPaginationParams, buildPaginatedResponse } = require('../../../shared/utils/pagination');
const { getMemberBalanceSnapshots } = require('./deductionController');
const { checkAndNotify } = require('../services/thresholdNotificationService');
const { createAuditLog } = require('../../../shared/services/auditLoggingService');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
    const claims = await Claim.find(query).sort({ dateFiled: 1 }).skip(skip).limit(limit);

    res.status(200).json(buildPaginatedResponse(claims, total, page, limit));
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

    let deductionSetting = await DeductionSetting.findOne({ status: 'active' });
    const amountPerMember = req.query.amount
      ? parseFloat(req.query.amount)
      : deductionSetting?.amount ?? 25;

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
    const { customAmount } = req.body;
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

    let deductionSetting = await DeductionSetting.findOne({ status: 'active' });
    const deductionAmount = customAmount
      ? parseFloat(customAmount)
      : deductionSetting?.amount ?? 25;

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
      deductionSettingId: deductionSetting?.settingId,
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

// Flow B, per claim: pay the deceased member's own accumulated balance out
// to their beneficiary — this is the Claim Disbursement recording step.
// A DV (Disbursement Voucher) number is required since it's the physical
// paper trail the cooperative's own accounting already relies on.
const releaseClaim = async (req, res) => {
  try {
    const { claimId } = req.params;
    const { amount, paymentMethod, dvNumber, releaseDate, remarks } = req.body;
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

    const lastLedgerEntry = await Ledger.findOne({ memberId: claim.memberId }).sort({
      transactionDate: -1,
      createdAt: -1,
    });
    const currentBalance = lastLedgerEntry ? lastLedgerEntry.balance : 0;
    const payoutAmount = amount ? parseFloat(amount) : currentBalance;

    if (isNaN(payoutAmount) || payoutAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid payout amount' });
    }

    const parsedReleaseDate = releaseDate ? new Date(releaseDate) : new Date();
    const effectiveReleaseDate = isNaN(parsedReleaseDate.getTime()) ? new Date() : parsedReleaseDate;

    const newBalance = currentBalance - payoutAmount;
    const before = claim.toObject();

    const ledgerEntry = new Ledger({
      ledgerId: uuidv4(),
      memberId: claim.memberId,
      transactionType: 'claim_payout',
      description: `Death benefit payout to ${claim.beneficiaryName} (DV# ${dvNumber.trim()})`,
      credit: 0,
      debit: payoutAmount,
      balance: newBalance,
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
      notes: `₱${payoutAmount} released to ${claim.beneficiaryName} (DV# ${dvNumber.trim()})`,
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
      description: `Released ₱${payoutAmount} to ${claim.beneficiaryName} for claim ${claim.claimId} (DV# ${dvNumber.trim()})`,
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
  getClaimById,
  processClaimDeduction,
  previewClaimDeduction,
  releaseClaim,
};
