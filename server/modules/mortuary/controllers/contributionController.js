const Contribution = require('../models/Contribution');
const Ledger = require('../models/Ledger');
const { Member } = require('../../../shared/models');
const { createHash } = require('node:crypto');
const { getPaginationParams, buildPaginatedResponse } = require('../../../shared/utils/pagination');
const { getLatestBalance } = require('../utils/ledgerBalance');
const { withMemberPaymentLock } = require('../utils/paymentLock');
const { safeErrorMessage } = require('../../../middleware/errorHandler');
const { actorName } = require('../../../shared/utils/actorName');

/* Parehong dedup-key/upsert pattern gaya ng paymentImportService.js's CSV
import path (tingnan yung paymentId/samePayment dun). Yung deterministic id
galing sa (memberId, referenceNumber) ay nangangahulugang hindi na
gagawa ng second credit yung double-click o retried request pagkatapos ng
dropped connection - gagamitin lang ulit yung same contribution at ledger
rows. At kung mag-crash sa pagitan ng dalawang saves, recoverable ito -
yung resubmit gamit yung same reference number ay tatapusin lang yung
nawawalang half sa halip na mag-re-credit. */
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

    const recordedBy = actorName(req.user, 'admin');

    console.log('📝 Recording contribution:', { memberId, amount, finalPaymentDate, finalDueDate, finalPaymentMethod });

    /* Isinasara ng typeof check yung NoSQL operator-injection hole: kung
    crafted body gaya ng {"memberId":{"$ne":null},...} ay makakapasa sa
    !memberId truthiness check (truthy yung non-empty object) at ginagawang
    real query operator yung findOne sa baba, matching kung sino man ang
    unang ibalik ng Mongo's query planner. Yung String(...) cast sa line 25
    ay pino-protect lang yung in-memory lock key, hindi yung query na ito -
    hindi naman talaga legitimate na hindi string yung memberId, kaya tama
    lang na i-reject din ang wrong type dito gaya ng pag-reject sa missing
    one. */
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

    /* Rereserve muna yung contribution row atomically: yung unique index
    sa contributionId ay nangangahulugang kung may concurrent/duplicate
    requests para sa same (memberId, referenceNumber), magrace sila sa
    same _id at isa lang sa kanila ang talagang mag-insert - basta yung
    ibang racer (o later retry) ay babasa lang ng isinulat na ng una. */
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
      /* Yung same (memberId, referenceNumber) ay fully posted na - double-click
      o retried request pagkatapos talagang nag-succeed yung una. I-report
      lang yung nandun na sa halip na mag-credit ulit. */
      return res.status(200).json({
        success: true,
        message: 'This contribution was already recorded.',
        contribution,
        ledgerEntry: existingLedger,
        newBalance: existingLedger.balance,
      });
    }

    /* Posting order - tingnan yung utils/ledgerBalance kung bakit hindi
    dapat transactionDate ang magdesisyon dito. Shared ito ng lahat ng
    balance lookup sa module na ito. */
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
          recordedBy,
          paymentMethod: finalPaymentMethod,
          /* Laging i-stamp yung actual posting time (tugma sa recordPayout,
          processAutomaticDeduction, processClaimDeduction, etc). Yung paggamit sa
          treasurer-editable payment date dito (madalas date lang na walang
          time, e.g. "2026-08-16") ay nagiging dahilan para mag-sort *before*
          yung bagong contributions kumpara sa same-day entries na may
          totoong time-of-day, kaya yung "current balance" lookup (sorted by
          transactionDate desc) ay laging sumulpot yung older entry at
          mukhang stuck yung balance ng member. Yung user-chosen payment
          date ay nakapreserve pa rin sa Contribution record mismo
          (paymentDate, sa taas) para sa reporting. */
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

    /* Madalas date lang na walang time yung paymentDate (defaults to
    "today"), kaya nagtie yung same-day payments dito; createdAt ang
    nagbreak ng tie para yung pinaka-recently recorded payment ang laging
    unang sort. */
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

    /* Kinukuha yung paginated contributions - madalas date lang na walang
    time yung paymentDate (defaults to "today"), kaya nagtie yung same-day
    payments dito; createdAt ang nagbreak ng tie para yung pinaka-recently
    recorded payment ang unang sort. */
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
