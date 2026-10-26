const Ledger = require('../models/Ledger');
const Contribution = require('../models/Contribution');
const Claim = require('../models/Claim');
const NoticeThresholdSetting = require('../models/NoticeThresholdSetting');
const { Member } = require('../../../shared/models');
const { LATEST_FIRST, getLatestBalancesByMember } = require('../utils/ledgerBalance');
const { safeErrorMessage } = require('../../../middleware/errorHandler');

const getClaimFinancialTotals = async (match) => {
  const collected = { $ifNull: ['$deduction.totalCollected', 0] };

  const [claimTotals] = await Claim.aggregate([
    /* Tinotal ng dashboards yung every claim; ipinapasa ng Claims Income
    Report yung current search filter niya para tugma yung report footer
    sa mga rows na ipinapakita. */
    ...(match ? [{ $match: match }] : []),
    {
      $group: {
        _id: null,
        totalDeductionsCollected: { $sum: collected },
      },
    },
  ]);

  const round = (n) => Math.round((n || 0) * 100) / 100;
  return {
    totalDeductionsCollected: round(claimTotals?.totalDeductionsCollected),
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
    res.status(500).json({ message: 'Error fetching dashboard', error: safeErrorMessage(error) });
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
    const members = await Member.find({ status: 'active' }).select('memberId').lean();
    let fundBalance = 0;
    let lowBalanceCount = 0;
    let negativeBalanceCount = 0;
    let goodStandingCount = 0;
    let excellentStandingCount = 0;

    const noticeThresholds = await NoticeThresholdSetting.findOne({ status: 'active' }).select('targetBalance').lean();
    const MINIMUM_BALANCE = noticeThresholds?.targetBalance ?? 1000;
    const GOOD_STANDING_THRESHOLD = 5000;
    const EXCELLENT_STANDING_THRESHOLD = 10000;

    /* Isang aggregation lang para sa current balance ng every active member
    sa halip na Ledger.findOne() per member sa loop sa baba (dati ay N+1
    query sa every treasurer dashboard load). */
    const balancesByMember = await getLatestBalancesByMember(members.map((member) => member.memberId));

    for (const member of members) {
      const balance = balancesByMember.get(member.memberId) || 0;
      fundBalance += balance;
      
      // Categorize member standing
      if (balance < MINIMUM_BALANCE) {
        lowBalanceCount++;
        if (balance < 0) negativeBalanceCount++;
      } else if (balance >= EXCELLENT_STANDING_THRESHOLD) {
        excellentStandingCount++;
      } else if (balance >= GOOD_STANDING_THRESHOLD) {
        goodStandingCount++;
      } else {
        /* Fair standing (sa gitna ng minimum at good) - ito ay
        kakalkulahin as: activeMembers - (low + good + excellent) */
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

    const { totalDeductionsCollected } = await getClaimFinancialTotals();

    res.status(200).json({
      success: true,
      data: {
        fundBalance,
        minimumBalance: MINIMUM_BALANCE,
        activeMembers,
        totalMembers,
        inactiveMembers,
        deceasedMembers,
        lowBalanceMembers: lowBalanceCount,
        negativeBalanceMembers: negativeBalanceCount,
        totalCollected,
        /* Death-fund assessment totals sa lahat ng claims - tingnan yung
        getClaimFinancialTotals kung bakit separate ito sa fundBalance. */
        totalDeductionsCollected,
        healthRatio: activeMembers > 0 ? Math.round(((activeMembers - lowBalanceCount) / activeMembers) * 100) : null,
        // Member standing breakdown
        memberStanding: {
          excellent: excellentStandingCount,
          good: goodStandingCount,
          fair: fairStandingCount,
          atRisk: lowBalanceCount - negativeBalanceCount,
          negativeBalance: negativeBalanceCount
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
      error: safeErrorMessage(error) 
    });
  }
};

/* Admin dashboard - member counts, claim counts by status, recent claim
activity. Note: dati itong GET /dashboard sa adminRoutes.js ay naka-wire sa
getDashboard sa taas, na nangangailangan ng memberId route param na hindi
naman nasusupply ng route na yun (pre-existing 404 sa endpoint na yun) -
ito talaga yung function na para sa admin-facing dashboard. */
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

    const { totalDeductionsCollected } = await getClaimFinancialTotals();

    /* Recent claim activity - flatten yung last few statusHistory entries
    galing sa pinaka-recently updated claims. */
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

    /* Yung claims na talagang kailangan ng attention ngayon - by current
    status, hindi by scanning history. Yung recentClaimActivities sa taas
    ay flattened statusHistory log, kaya yung claim na approved/released na
    ay meron pa ring lumang "pending_requirements"/"pending_deduction"
    entries dito; kung ifilter yung log na yun para sa notification bell,
    sumulpot yung mga already-resolved claims na parang kailangan pa rin ng
    attention. */
    const claimsNeedingAttention = await Claim.find({
      status: { $in: ['pending_requirements', 'pending_deduction'] },
    })
      .sort({ updatedAt: -1 })
      .limit(10)
      .select('claimId memberName beneficiaryName status updatedAt');

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
        },
        recentClaimActivities,
        claimsNeedingAttention,
      },
    });
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching admin dashboard',
      error: safeErrorMessage(error),
    });
  }
};

module.exports = {
  getDashboard,
  getTreasurerDashboard,
  getAdminDashboard,
  getClaimFinancialTotals,
};
