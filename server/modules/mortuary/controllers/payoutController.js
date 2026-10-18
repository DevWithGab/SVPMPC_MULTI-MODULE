const { Member } = require('../../../shared/models');
const { Ledger } = require('../models');
const { safeErrorMessage } = require('../../../middleware/errorHandler');

const payoutController = {
  // Get all payouts — both the legacy manual "Record Payout" ledger entries
  // (transactionType 'payout') and the ones created when a death claim is
  // actually released (transactionType 'claim_payout'). The Admin Dashboard's
  // Fund Overview/Fund Summary total this list, so excluding claim_payout
  // entries silently hid every real disbursement from those figures.
  getAllPayouts: async (req, res) => {
    try {
      const payouts = await Ledger.find({
        transactionType: { $in: ['payout', 'claim_payout'] },
      }).sort({ transactionDate: -1 });

      // One batch lookup for every member name instead of a Member.findOne()
      // per payout row in the loop below.
      const memberIds = [...new Set(payouts.map((payout) => payout.memberId))];
      const members = await Member.find({ memberId: { $in: memberIds } }).select('memberId memberName').lean();
      const memberNameById = new Map(members.map((member) => [member.memberId, member.memberName]));

      const formattedPayouts = payouts.map((payout) => ({
        id: payout._id,
        payout_date: payout.transactionDate.toISOString().split('T')[0],
        member_name: memberNameById.get(payout.memberId) || 'Unknown',
        member_id: payout.memberId,
        beneficiary: payout.beneficiary || 'Not specified',
        // claim_payout rows are recorded credit-in/debit-out on the same
        // row (see treasurerClaimController.releaseClaim) so the member's
        // own balance is untouched — debit is still the released amount.
        amount: Math.abs(payout.debit),
        payment_method: payout.paymentMethod || 'Cash',
        description: payout.description
      }));

      res.json({
        success: true,
        payouts: formattedPayouts
      });
    } catch (error) {
      console.error('Error fetching payouts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch payouts',
        error: safeErrorMessage(error)
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
        error: safeErrorMessage(error)
      });
    }
  }
};

module.exports = payoutController;