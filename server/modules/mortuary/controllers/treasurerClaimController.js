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
// to their beneficiary.
const releaseClaim = async (req, res) => {
  try {
    const { claimId } = req.params;
    const { amount, paymentMethod } = req.body;
    const releasedBy = req.body.releasedBy || req.user?.username || 'treasurer';

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

    const newBalance = currentBalance - payoutAmount;

    const ledgerEntry = new Ledger({
      ledgerId: uuidv4(),
      memberId: claim.memberId,
      transactionType: 'claim_payout',
      description: `Death benefit payout to ${claim.beneficiaryName}`,
      credit: 0,
      debit: payoutAmount,
      balance: newBalance,
      referenceId: claimId,
      beneficiary: claim.beneficiaryName,
      paymentMethod: paymentMethod || 'cash',
      transactionDate: new Date(),
      recordedBy: releasedBy,
    });
    await ledgerEntry.save();

    const now = new Date();
    claim.status = 'released';
    claim.payout = {
      amount: payoutAmount,
      paymentMethod: paymentMethod || 'cash',
      releasedBy,
      releasedAt: now,
      ledgerId: ledgerEntry.ledgerId,
    };
    claim.statusHistory.push({
      status: 'released',
      changedBy: releasedBy,
      changedAt: now,
      notes: `₱${payoutAmount} released to ${claim.beneficiaryName}`,
    });

    await claim.save();

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
  getClaimById,
  processClaimDeduction,
  releaseClaim,
};
