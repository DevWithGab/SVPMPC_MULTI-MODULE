const Ledger = require('../models/Ledger');
const { Member } = require('../../../shared/models');

// Get member ledger
const getMemberLedger = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { limit = 100 } = req.query;

    // Verify member exists
    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    const ledgerEntries = await Ledger.find({ memberId })
      .sort({ transactionDate: -1 })
      .limit(parseInt(limit));

    // Get current balance
    const currentBalance = ledgerEntries.length > 0 ? ledgerEntries[0].balance : 0;

    // Calculate totals
    const totalCredits = ledgerEntries.reduce((sum, entry) => sum + entry.credit, 0);
    const totalDebits = ledgerEntries.reduce((sum, entry) => sum + entry.debit, 0);

    res.status(200).json({
      memberId,
      memberName: member.memberName,
      currentBalance,
      totalCredits,
      totalDebits,
      transactionCount: ledgerEntries.length,
      ledger: ledgerEntries,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching ledger', error: error.message });
  }
};

// Get all ledger entries (admin)
const getAllLedger = async (req, res) => {
  try {
    const { transactionType, limit = 100 } = req.query;

    let query = {};
    if (transactionType) {
      query.transactionType = transactionType;
    }

    const ledgerEntries = await Ledger.find(query)
      .sort({ transactionDate: -1 })
      .limit(parseInt(limit));

    // Format for frontend
    const formattedEntries = ledgerEntries.map(entry => ({
      id: entry.ledgerId,
      member_id: entry.memberId,
      date: entry.transactionDate.toISOString().split('T')[0],
      ref_no: entry.referenceId || entry.ledgerId,
      description: entry.description,
      received: entry.credit || 0,
      withdrawn: entry.debit || 0,
      balance: entry.balance
    }));

    res.status(200).json({
      success: true,
      data: formattedEntries,
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error fetching ledger', 
      error: error.message 
    });
  }
};

// Get member balance
const getMemberBalance = async (req, res) => {
  try {
    const { memberId } = req.params;

    // Verify member exists
    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    const latestLedger = await Ledger.findOne({ memberId }).sort({ transactionDate: -1 });
    const balance = latestLedger ? latestLedger.balance : 0;

    res.status(200).json({
      memberId,
      memberName: member.memberName,
      balance,
      currency: 'PHP',
      lastUpdated: latestLedger ? latestLedger.transactionDate : null,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching balance', error: error.message });
  }
};

module.exports = {
  getMemberLedger,
  getAllLedger,
  getMemberBalance,
};
