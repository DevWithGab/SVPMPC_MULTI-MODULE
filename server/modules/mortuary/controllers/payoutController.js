const { Member } = require('../../../shared/models');
const { Ledger } = require('../models');

const payoutController = {
  // Get all payouts
  getAllPayouts: async (req, res) => {
    try {
      const payouts = await Ledger.find({ 
        transactionType: 'payout' 
      }).sort({ transactionDate: -1 });

      const formattedPayouts = [];

      for (const payout of payouts) {
        const member = await Member.findOne({ memberId: payout.memberId });
        
        formattedPayouts.push({
          id: payout._id,
          payout_date: payout.transactionDate.toISOString().split('T')[0],
          member_name: member?.memberName || 'Unknown',
          member_id: payout.memberId,
          beneficiary: payout.beneficiary || 'Not specified',
          amount: Math.abs(payout.debit), // Payouts are debit amounts
          payment_method: payout.paymentMethod || 'Cash',
          description: payout.description
        });
      }

      res.json({
        success: true,
        payouts: formattedPayouts
      });
    } catch (error) {
      console.error('Error fetching payouts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch payouts',
        error: error.message
      });
    }
  },

  // Record new payout
  recordPayout: async (req, res) => {
    try {
      const { 
        member_id, 
        amount, 
        beneficiary, 
        payment_method = 'Cash',
        description 
      } = req.body;

      if (!member_id || !amount || !beneficiary) {
        return res.status(400).json({
          success: false,
          message: 'Member ID, amount, and beneficiary are required'
        });
      }

      // Verify member exists
      const member = await Member.findOne({ memberId: member_id });
      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Member not found'
        });
      }

      // Get current balance
      const lastLedgerEntry = await Ledger.findOne({ 
        memberId: member_id 
      }).sort({ transactionDate: -1, _id: -1 });

      const currentBalance = lastLedgerEntry ? lastLedgerEntry.balance : 0;
      const newBalance = currentBalance - amount;

      // Create payout ledger entry
      const payout = new Ledger({
        ledgerId: `P${Date.now()}_${member_id}`,
        memberId: member_id,
        transactionType: 'payout',
        description: description || `Payout to ${beneficiary}`,
        credit: 0,
        debit: amount, // Positive debit for payout
        balance: newBalance,
        beneficiary,
        paymentMethod: payment_method,
        transactionDate: new Date(),
        recordedBy: req.user?.username || 'admin'
      });

      await payout.save();

      res.json({
        success: true,
        message: 'Payout recorded successfully',
        payout: {
          id: payout._id,
          payout_date: payout.transactionDate.toISOString().split('T')[0],
          member_name: member.memberName,
          member_id: payout.memberId,
          beneficiary: payout.beneficiary,
          amount: payout.debit,
          payment_method: payout.paymentMethod,
          description: payout.description
        }
      });
    } catch (error) {
      console.error('Error recording payout:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to record payout',
        error: error.message
      });
    }
  },

  // Get payout by ID
  getPayoutById: async (req, res) => {
    try {
      const { payoutId } = req.params;

      const payout = await Ledger.findOne({
        _id: payoutId,
        transactionType: 'payout'
      });

      if (!payout) {
        return res.status(404).json({
          success: false,
          message: 'Payout not found'
        });
      }

      const member = await Member.findOne({ memberId: payout.memberId });

      res.json({
        success: true,
        payout: {
          id: payout._id,
          payout_date: payout.transactionDate.toISOString().split('T')[0],
          member_name: member?.memberName || 'Unknown',
          member_contact: member?.phoneNumber || '',
          member_id: payout.memberId,
          beneficiary: payout.beneficiary,
          amount: payout.debit,
          payment_method: payout.paymentMethod,
          description: payout.description
        }
      });
    } catch (error) {
      console.error('Error fetching payout:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch payout',
        error: error.message
      });
    }
  }
};

module.exports = payoutController;