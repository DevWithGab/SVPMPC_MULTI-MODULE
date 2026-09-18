const Ledger = require('../models/Ledger');
const Contribution = require('../models/Contribution');
const Claim = require('../models/Claim');
const { Member } = require('../../../shared/models');
const { LATEST_FIRST } = require('../utils/ledgerBalance');

// The three claim-side money figures, as a clearing account. Money collected
// for a claim is HELD until the disbursement is recorded, then splits in two:
// the benefit to the beneficiary and the surplus to the cooperative. So across
// a claim's life the tiles move like this:
//
//   after deduction   collected 52,200   released      0   income     0
//   after release     collected      0   released 50,000   income 2,200
//
// The three always reconcile: held + released + income = everything ever
// collected. Nothing is double-counted and nothing is stranded.
//
//   - totalDeductionsCollected: collected for claims NOT yet released. Drains
//     to 0 as each claim is disbursed — it is money in hand, not a lifetime
//     total. Critically it must NOT count a released claim, or the same pesos
//     would show up both here and in released/income.
//   - totalReleased: what actually went out to beneficiaries.
//   - netClaimsBalance: the surplus kept, recognised on release. Derived from
//     the ACTUAL payout rather than the cap, so claims released under the old
//     pre-cap rule (payout was the deceased member's own balance) report the
//     surplus that really was retained, even when that is negative.
//
// A claim only has `deduction`/`payout` once it reaches that stage, so unset
// ones contribute 0 via $ifNull rather than being excluded. Shared by both
// dashboards and the Claims Income Report so all three stay in agreement.
const getClaimFinancialTotals = async (match) => {
  const collected = { $ifNull: ['$deduction.totalCollected', 0] };
  const payout = { $ifNull: ['$payout.amount', 0] };
  // A claim is settled once a payout amount exists on it.
  const isReleased = { $ne: [{ $ifNull: ['$payout.amount', null] }, null] };

  const [claimTotals] = await Claim.aggregate([
    // The dashboards total every claim; the Claims Income Report passes its
    // current search filter so the report footer matches the rows shown.
    ...(match ? [{ $match: match }] : []),
    {
      $group: {
        _id: null,
        totalDeductionsCollected: { $sum: { $cond: [isReleased, 0, collected] } },
        totalReleased: { $sum: payout },
        netClaimsBalance: {
          $sum: { $cond: [isReleased, { $subtract: [collected, payout] }, 0] },
        },
      },
    },
  ]);

  const round = (n) => Math.round((n || 0) * 100) / 100;
  return {
    totalDeductionsCollected: round(claimTotals?.totalDeductionsCollected),
    totalReleased: round(claimTotals?.totalReleased),
    netClaimsBalance: round(claimTotals?.netClaimsBalance),
  };
};

const getDashboard = async (req, res) => {
  try {
    const { memberId } = req.params;

    // Verify member exists
    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Get current balance
    const latestLedger = await Ledger.findOne({ memberId }).sort(LATEST_FIRST);
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
        .sort(LATEST_FIRST);
      
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

    const { totalDeductionsCollected, totalReleased, netClaimsBalance } = await getClaimFinancialTotals();

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
        // Death-fund assessment totals across all claims — see
        // getClaimFinancialTotals for why this is separate from fundBalance.
        totalDeductionsCollected,
        totalReleased,
        netClaimsBalance,
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

// Admin dashboard — member counts, claim counts by status, recent claim
// activity. Note: adminRoutes.js previously wired GET /dashboard to
// getDashboard above, which requires a memberId route param that route
// never supplied (a pre-existing 404 on that endpoint) — this function is
// the one actually meant for the admin-facing dashboard.
const getAdminDashboard = async (req, res) => {
  try {
    const [totalMembers, activeMembers, inactiveMembers, deceasedMembers] = await Promise.all([
      Member.countDocuments(),
      Member.countDocuments({ status: 'active' }),
      Member.countDocuments({ status: 'inactive' }),
      Member.countDocuments({ status: 'deceased' }),
    ]);

    const claimStatuses = [
      'pending_requirements',
      'approved',
      'pending_deduction',
      'deduction_processed',
      'released',
      'rejected',
    ];

    const claimCountsByStatus = {};
    await Promise.all(
      claimStatuses.map(async (status) => {
        claimCountsByStatus[status] = await Claim.countDocuments({ status });
      }),
    );

    const totalClaims = Object.values(claimCountsByStatus).reduce((sum, n) => sum + n, 0);

    const { totalDeductionsCollected, totalReleased, netClaimsBalance } = await getClaimFinancialTotals();

    // Recent claim activity — flatten the last few statusHistory entries
    // across the most recently updated claims.
    const recentClaims = await Claim.find()
      .sort({ updatedAt: -1 })
      .limit(10)
      .select('claimId memberName beneficiaryName statusHistory');

    const recentClaimActivities = recentClaims
      .flatMap((claim) =>
        claim.statusHistory.map((entry) => ({
          claimId: claim.claimId,
          memberName: claim.memberName,
          beneficiaryName: claim.beneficiaryName,
          status: entry.status,
          changedBy: entry.changedBy,
          changedAt: entry.changedAt,
          notes: entry.notes,
        })),
      )
      .sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt))
      .slice(0, 10);

    res.status(200).json({
      success: true,
      data: {
        members: {
          total: totalMembers,
          active: activeMembers,
          inactive: inactiveMembers,
          deceased: deceasedMembers,
        },
        claims: {
          total: totalClaims,
          ...claimCountsByStatus,
          totalDeductionsCollected,
          totalReleased,
          // The cooperative's income from the claims side: the surplus kept
          // once a claim is disbursed. Separate from members' own
          // contribution balances (fundBalance).
          netClaimsBalance,
        },
        recentClaimActivities,
      },
    });
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching admin dashboard',
      error: error.message,
    });
  }
};

module.exports = {
  getDashboard,
  getTreasurerDashboard,
  getAdminDashboard,
  getClaimFinancialTotals,
};
