const Ledger = require('../models/Ledger');
const Contribution = require('../models/Contribution');
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
    // Get all members count by status
    const totalMembers = await Member.countDocuments();
    const activeMembers = await Member.countDocuments({ status: 'active' });
    const inactiveMembers = await Member.countDocuments({ status: 'inactive' });
    const deceasedMembers = await Member.countDocuments({ status: 'deceased' });

    // Get fund balance and member standing (sum of all member balances from latest ledger entries)
    const members = await Member.find({ status: 'active' });
    let fundBalance = 0;
    let lowBalanceCount = 0;
    let goodStandingCount = 0;
    let excellentStandingCount = 0;
    
    const MINIMUM_BALANCE = 1000;
    const GOOD_STANDING_THRESHOLD = 5000;
    const EXCELLENT_STANDING_THRESHOLD = 10000;
    
    for (const member of members) {
      const latestLedger = await Ledger.findOne({ memberId: member.memberId })
        .sort({ createdAt: -1 });
      
      const balance = latestLedger ? latestLedger.balance : 0;
      fundBalance += balance;
      
      // Categorize member standing
      if (balance < MINIMUM_BALANCE) {
        lowBalanceCount++;
      } else if (balance >= EXCELLENT_STANDING_THRESHOLD) {
        excellentStandingCount++;
      } else if (balance >= GOOD_STANDING_THRESHOLD) {
        goodStandingCount++;
      } else {
        // Fair standing (between minimum and good)
        // This will be calculated as: activeMembers - (low + good + excellent)
      }
    }

    const fairStandingCount = activeMembers - (lowBalanceCount + goodStandingCount + excellentStandingCount);

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
        inactiveMembers,
        deceasedMembers,
        lowBalanceMembers: lowBalanceCount,
        totalCollected,
        healthRatio: totalMembers > 0 ? Math.round(((totalMembers - lowBalanceCount) / totalMembers) * 100) : 0,
        // Member standing breakdown
        memberStanding: {
          excellent: excellentStandingCount,
          good: goodStandingCount,
          fair: fairStandingCount,
          atRisk: lowBalanceCount
        },
        // Status composition
        statusComposition: {
          active: activeMembers,
          inactive: inactiveMembers,
          deceased: deceasedMembers
        }
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
