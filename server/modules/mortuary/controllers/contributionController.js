const Contribution = require('../models/Contribution');
const Ledger = require('../models/Ledger');
const PaymentSchedule = require('../models/PaymentSchedule');
const { Member } = require('../../../shared/models');
const { v4: uuidv4 } = require('uuid');

// Record contribution (admin)
const recordContribution = async (req, res) => {
  try {
    const { memberId, amount, paymentDate, dueDate, paymentMethod, referenceNumber, notes } = req.body;

    if (!memberId || !amount || !dueDate) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Verify member exists
    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Get current balance
    const latestLedger = await Ledger.findOne({ memberId }).sort({ transactionDate: -1 });
    const currentBalance = latestLedger ? latestLedger.balance : 0;
    const newBalance = currentBalance + amount;

    // Create contribution record
    const contribution = new Contribution({
      contributionId: `CONTRIB-${Date.now()}`,
      memberId,
      amount,
      paymentDate: paymentDate || new Date(),
      dueDate,
      status: 'paid',
      paymentMethod: paymentMethod || 'cash',
      referenceNumber,
      notes,
    });

    await contribution.save();

    // Create ledger entry
    const ledgerEntry = new Ledger({
      ledgerId: uuidv4(),
      memberId,
      transactionType: 'contribution',
      description: `Contribution payment - ${paymentMethod || 'cash'}`,
      credit: amount,
      balance: newBalance,
      referenceId: contribution.contributionId,
      recordedBy: 'admin',
    });

    await ledgerEntry.save();

    res.status(201).json({
      message: 'Contribution recorded successfully',
      contribution: contribution,
      ledgerEntry: ledgerEntry,
      newBalance: newBalance,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error recording contribution', error: error.message });
  }
};

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

    const contributions = await Contribution.find({ memberId })
      .sort({ paymentDate: -1 })
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
    res.status(500).json({ message: 'Error fetching contributions', error: error.message });
  }
};

// Get all contributions (admin)
const getAllContributions = async (req, res) => {
  try {
    const { status, limit = 100 } = req.query;

    let query = {};
    if (status) {
      query.status = status;
    }

    const contributions = await Contribution.find(query)
      .sort({ paymentDate: -1 })
      .limit(parseInt(limit));

    res.status(200).json({
      count: contributions.length,
      contributions: contributions,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching contributions', error: error.message });
  }
};

module.exports = {
  recordContribution,
  getContributionHistory,
  getAllContributions,
};
