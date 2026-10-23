const { Member } = require('../../../shared/models');
const { Ledger } = require('../models');
const { safeErrorMessage } = require('../../../middleware/errorHandler');

const payoutController = {
  /* Kinukuha dito lahat ng payouts - kasama yung legacy manual "Record Payout" ledger
  entries (transactionType 'payout') at yung mga nagawa nung actually na-release ang
  death claim (transactionType 'claim_payout'). Tinutotal ng Fund Overview/Fund Summary
  ng Admin Dashboard ang list na ito, kaya kung ieexclude yung claim_payout entries,
  natatago nang tahimik yung lahat ng totoong disbursement sa mga figures na yun. */
  getAllPayouts: async (req, res) => {
    try {
      const payouts = await Ledger.find({
        transactionType: { $in: ['payout', 'claim_payout'] },
      }).sort({ transactionDate: -1 });

      /* Isang batch lookup lang para sa lahat ng member name imbes na Member.findOne() per
      payout row sa loop sa baba. */
      const memberIds = [...new Set(payouts.map((payout) => payout.memberId))];
      const members = await Member.find({ memberId: { $in: memberIds } }).select('memberId memberName').lean();
      const memberNameById = new Map(members.map((member) => [member.memberId, member.memberName]));

      const formattedPayouts = payouts.map((payout) => ({
        id: payout._id,
        payout_date: payout.transactionDate.toISOString().split('T')[0],
        member_name: memberNameById.get(payout.memberId) || 'Unknown',
        member_id: payout.memberId,
        beneficiary: payout.beneficiary || 'Not specified',
        /* Ang claim_payout rows ay naitala bilang credit-in/debit-out sa same row (tingnan
        ang treasurerClaimController.releaseClaim) para hindi magalaw yung sariling balance
        ng member - ang debit ay yung released amount pa rin. */
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