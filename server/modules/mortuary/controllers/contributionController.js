const Contribution = require('../models/Contribution');
const Ledger = require('../models/Ledger');
const { Member } = require('../../../shared/models');
const { createHash } = require('node:crypto');
const { getPaginationParams, buildPaginatedResponse } = require('../../../shared/utils/pagination');
const { getLatestBalance } = require('../utils/ledgerBalance');
const { withMemberPaymentLock } = require('../utils/paymentLock');
const { safeErrorMessage } = require('../../../middleware/errorHandler');

// Same dedup-key/upsert pattern as paymentImportService.js's CSV import path
// (see paymentId/samePayment there). A deterministic id from
// (memberId, referenceNumber) means a double-click or a retried request after
// a dropped connection reuses the same contribution and ledger rows instead
// of creating a second credit, and a crash between the two saves is
// recoverable — resubmitting with the same reference number just finishes
// the missing half instead of re-crediting.
const manualPaymentId = (memberId, referenceNumber) =>
  `MANUAL-${createHash('sha256').update(JSON.stringify([memberId, referenceNumber])).digest('hex')}`;
const samePayment = (stored, entry) =>
  Number(stored.amount) === entry.amount &&
  new Date(stored.paymentDate).toISOString().slice(0, 10) === new Date(entry.paymentDate).toISOString().slice(0, 10) &&
  stored.paymentMethod === entry.paymentMethod;

// Record contribution (admin)
const recordContribution = async (req, res) => withMemberPaymentLock(String(req.body.memberId || req.body.member_id || ''), async () => {
  try {
    const { memberId: memberIdParam, member_id, amount: rawAmount, paymentDate, payment_date, dueDate, due_date, paymentMethod, payment_method, referenceNumber, notes } = req.body;
    const amount = Number(rawAmount);

    // Accept both naming conventions
    const memberId = memberIdParam || member_id;
    const finalPaymentDate = paymentDate || payment_date || new Date();
    const finalDueDate = dueDate || due_date || new Date();
    const finalPaymentMethod = paymentMethod || payment_method || 'cash';
    const trimmedReference = referenceNumber?.trim();

    console.log('📝 Recording contribution:', { memberId, amount, finalPaymentDate, finalDueDate, finalPaymentMethod });

    // typeof check closes a NoSQL operator-injection hole: a crafted body
    // like {"memberId":{"$ne":null},...} passes the !memberId truthiness
    // check (a non-empty object is truthy) and turns the findOne below into
    // a real query operator, matching whichever member Mongo's query
    // planner returns first. The String(...) cast on line 25 only protects
    // the in-memory lock key, not this query — memberId is never
    // legitimately anything but a string, so rejecting the wrong type here
    // is exactly as correct as rejecting a missing one.
    if (!memberId || typeof memberId !== 'string' || !Number.isFinite(amount) || amount <= 0 || !trimmedReference) {
      console.log('❌ Missing required fields:', { memberId, amount, referenceNumber });
      return res.status(400).json({ message: 'Missing required fields: Passbook No., amount, and reference number' });
    }

    // Verify member exists
    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    const id = manualPaymentId(memberId, trimmedReference);
    const entry = { amount, paymentDate: finalPaymentDate, paymentMethod: finalPaymentMethod };

    // Reserve the contribution row first and atomically: the unique index on
    // contributionId means concurrent/duplicate requests for the same
    // (memberId, referenceNumber) race on the same _id and only one of them
    // actually inserts — any other racer (or a later retry) just reads back
    // what the first one wrote.
    let contribution;
    try {
      contribution = await Contribution.findOneAndUpdate(
        { contributionId: id },
        { $setOnInsert: {
          contributionId: id,
          memberId,
          amount,
          paymentDate: finalPaymentDate,
          dueDate: finalDueDate,
          status: 'paid',
          paymentMethod: finalPaymentMethod,
          referenceNumber: trimmedReference,
          notes,
        } },
        { upsert: true, new: true, runValidators: true }
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      contribution = await Contribution.findOne({ contributionId: id });
    }

    if (!samePayment(contribution, entry)) {
      return res.status(409).json({
        message: `Reference number "${trimmedReference}" was already used for a different payment (₱${contribution.amount} on ${new Date(contribution.paymentDate).toISOString().slice(0, 10)} via ${contribution.paymentMethod}) for this member. Use a different reference number.`,
      });
    }

    const existingLedger = await Ledger.findOne({ ledgerId: id });
    if (existingLedger) {
      // Same (memberId, referenceNumber) was already fully posted — a
      // double-click or a retried request after the first one actually
      // succeeded. Report what's already there instead of crediting again.
      return res.status(200).json({
        success: true,
        message: 'This contribution was already recorded.',
        contribution,
        ledgerEntry: existingLedger,
        newBalance: existingLedger.balance,
      });
    }

    // Posting order — see utils/ledgerBalance for why transactionDate must not
    // decide this. Shared by every balance lookup in the module.
    const currentBalance = await getLatestBalance(memberId);
    const computedBalance = Math.round((currentBalance + amount) * 100) / 100;

    let ledgerEntry;
    try {
      ledgerEntry = await Ledger.findOneAndUpdate(
        { ledgerId: id },
        { $setOnInsert: {
          ledgerId: id,
          memberId,
          transactionType: 'contribution',
          description: `Contribution payment - ${finalPaymentMethod}`,
          credit: amount,
          balance: computedBalance,
          referenceId: contribution.referenceNumber,
          recordedBy: 'admin',
          paymentMethod: finalPaymentMethod,
          // Always stamp the actual posting time (matches recordPayout,
          // processAutomaticDeduction, releaseClaim, etc). Using the
          // treasurer-editable payment date here (often just a date with no
          // time, e.g. "2026-08-16") made new contributions sort *before*
          // same-day entries that carry a real time-of-day, so every "current
          // balance" lookup (sorted by transactionDate desc) kept surfacing
          // the older entry and the member's balance looked stuck. The
          // user-chosen payment date is still preserved on the Contribution
          // record itself (paymentDate, above) for reporting.
          transactionDate: new Date(),
        } },
        { upsert: true, new: true, runValidators: true }
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      ledgerEntry = await Ledger.findOne({ ledgerId: id });
    }

    res.status(201).json({
      success: true,
      message: 'Contribution recorded successfully',
      contribution: contribution,
      ledgerEntry: ledgerEntry,
      newBalance: ledgerEntry.balance,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error recording contribution', error: safeErrorMessage(error) });
  }
});

// Get contribution history
const getContributionHistory = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { limit = 50 } = req.query;

    // Verify member exists
    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // paymentDate is often just a date with no time (defaults to "today"),
    // so same-day payments tie on it; createdAt breaks the tie so the most
    // recently recorded payment always sorts first.
    const contributions = await Contribution.find({ memberId })
      .sort({ paymentDate: -1, createdAt: -1 })
      .limit(parseInt(limit));

    const totalAmount = contributions.reduce((sum, c) => sum + c.amount, 0);

    res.status(200).json({
      memberId,
      memberName: member.memberName,
      totalAmount,
      count: contributions.length,
      contributions: contributions,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching contributions', error: safeErrorMessage(error) });
  }
};

// Get all contributions (admin) - with pagination
const getAllContributions = async (req, res) => {
  try {
    const { status } = req.query;
    const { page, limit, skip } = getPaginationParams(req.query);

    let query = {};
    if (status) {
      query.status = status;
    }

    // Get total count for pagination
    const total = await Contribution.countDocuments(query);

    // Get paginated contributions — paymentDate is often just a date with no
    // time (defaults to "today"), so same-day payments tie on it; createdAt
    // breaks the tie so the most recently recorded payment sorts first.
    const contributions = await Contribution.find(query)
      .sort({ paymentDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Populate member names
    const contributionsWithMemberNames = await Promise.all(
      contributions.map(async (contribution) => {
        const member = await Member.findOne({ memberId: contribution.memberId });
        return {
          id: contribution.contributionId,
          member_id: contribution.memberId,
          member_name: member ? member.memberName : 'Unknown Member',
          amount: contribution.amount,
          payment_date: contribution.paymentDate.toISOString().split('T')[0],
          due_date: contribution.dueDate.toISOString().split('T')[0],
          status: contribution.status,
          payment_method: contribution.paymentMethod,
          reference_number: contribution.referenceNumber,
          notes: contribution.notes,
          created_at: contribution.createdAt,
          updated_at: contribution.updatedAt
        };
      })
    );

    res.status(200).json(buildPaginatedResponse(contributionsWithMemberNames, total, page, limit));
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error fetching contributions', 
      error: safeErrorMessage(error) 
    });
  }
};

module.exports = {
  recordContribution,
  getContributionHistory,
  getAllContributions,
};
