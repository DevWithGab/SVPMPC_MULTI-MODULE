const Contribution = require('../models/Contribution');
const Ledger = require('../models/Ledger');
const PaymentSchedule = require('../models/PaymentSchedule');
const { Member } = require('../../../shared/models');
const { v4: uuidv4 } = require('uuid');

// Record contribution (admin)
const recordContribution = async (req, res) => {
  try {
    console.log('📦 Full request body:', req.body);
    
    const { memberId: memberIdParam, member_id, amount, paymentDate, payment_date, dueDate, due_date, paymentMethod, payment_method, referenceNumber, notes } = req.body;
    
    // Accept both naming conventions
    const memberId = memberIdParam || member_id;
    const finalPaymentDate = paymentDate || payment_date;
    const finalDueDate = dueDate || due_date || new Date();
    const finalPaymentMethod = paymentMethod || payment_method || 'cash';

    console.log('📝 Recording contribution:', { memberId, amount, finalPaymentDate, finalDueDate, finalPaymentMethod });

    if (!memberId || !amount) {
      console.log('❌ Missing required fields:', { memberId, amount });
      return res.status(400).json({ message: 'Missing required fields: memberId and amount' });
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
      paymentDate: finalPaymentDate || new Date(),
      dueDate: finalDueDate,
      status: 'paid',
      paymentMethod: finalPaymentMethod,
      referenceNumber,
      notes,
    });

    await contribution.save();

    // Create ledger entry
    const ledgerEntry = new Ledger({
      ledgerId: uuidv4(),
      memberId,
      transactionType: 'contribution',
      description: `Contribution payment - ${finalPaymentMethod}`,
      credit: amount,
      balance: newBalance,
      referenceId: contribution.contributionId,
      recordedBy: 'admin',
      paymentMethod: finalPaymentMethod.charAt(0).toUpperCase() + finalPaymentMethod.slice(1).replace('_', ' '),
      transactionDate: finalPaymentDate || new Date()
    });

    await ledgerEntry.save();

    res.status(201).json({
      success: true,
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
