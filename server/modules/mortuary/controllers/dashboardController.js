const Ledger = require('../models/Ledger');
const Contribution = require('../models/Contribution');
const PaymentSchedule = require('../models/PaymentSchedule');
const { Member } = require('../../../shared/models');

// Get member dashboard data
const getDashboard = async (req, res) => {
  try {
    const { memberId } = req.params;

    // Verify member exists
    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Get current balance
    const latestLedger = await Ledger.findOne({ memberId }).sort({ transactionDate: -1 });
    const currentBalance = latestLedger ? latestLedger.balance : 0;

    // Get next payment due
    const nextPayment = await PaymentSchedule.findOne({ memberId, status: 'active' });

    // Get contribution history (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const contributionHistory = await Contribution.find({
      memberId,
      paymentDate: { $gte: twelveMonthsAgo },
    }).sort({ paymentDate: -1 });

    // Calculate stats
    const totalContributions = contributionHistory.reduce((sum, c) => sum + c.amount, 0);
    const paidCount = contributionHistory.filter((c) => c.status === 'paid').length;
    const pendingCount = contributionHistory.filter((c) => c.status === 'pending').length;
    const overdueCount = contributionHistory.filter((c) => c.status === 'overdue').length;

    res.status(200).json({
      member: {
        memberId: member.memberId,
        memberName: member.memberName,
        barangay: member.barangay,
      },
      balance: {
        accumulated: currentBalance,
        currency: 'PHP',
      },
      nextPayment: nextPayment
        ? {
            amount: nextPayment.contributionAmount,
            dueDate: nextPayment.nextDueDate,
            frequency: nextPayment.frequency,
            status: new Date() > nextPayment.nextDueDate ? 'overdue' : 'pending',
          }
        : null,
      contributionStats: {
        totalContributions,
        paidCount,
        pendingCount,
        overdueCount,
        totalRecords: contributionHistory.length,
      },
      recentContributions: contributionHistory.slice(0, 5),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching dashboard', error: error.message });
  }
};

// Get treasurer dashboard data
const getTreasurerDashboard = async (req, res) => {
  try {
    // Get all members count
    const totalMembers = await Member.countDocuments();
    const activeMembers = await Member.countDocuments({ status: 'active' });

    // Get fund balance (sum of all member balances from latest ledger entries)
    const members = await Member.find({ status: 'active' });
    let fundBalance = 0;
    let lowBalanceCount = 0;
    
    for (const member of members) {
      const latestLedger = await Ledger.findOne({ memberId: member.memberId })
        .sort({ createdAt: -1 });
      
      const balance = latestLedger ? latestLedger.balance : 0;
      fundBalance += balance;
      
      if (balance < 1000) {
        lowBalanceCount++;
      }
    }

    // Get total contributions (all time)
    const allContributions = await Contribution.aggregate([
      {
        $match: {
          status: 'paid'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    const totalCollected = allContributions.length > 0 ? allContributions[0].total : 0;

    res.status(200).json({
      success: true,
      data: {
        fundBalance,
        activeMembers,
        totalMembers,
        lowBalanceMembers: lowBalanceCount,
        totalCollected,
        healthRatio: totalMembers > 0 ? Math.round(((totalMembers - lowBalanceCount) / totalMembers) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Error fetching treasurer dashboard:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching treasurer dashboard', 
      error: error.message 
    });
  }
};

module.exports = {
  getDashboard,
  getTreasurerDashboard,
};
