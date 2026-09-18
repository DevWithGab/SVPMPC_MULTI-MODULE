const Member = require('../../../shared/models/Member');
const Ledger = require('../models/Ledger');
const { v4: uuidv4 } = require('uuid');
const { checkAndNotify } = require('../services/thresholdNotificationService');
const { getPaginationParams, buildPaginationMeta } = require('../../../shared/utils/pagination');

// Constants
const DEDUCTION_AMOUNT = 25; // 25 pesos per death
const MINIMUM_BALANCE = 1000; // 1000 pesos minimum balance

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildBalanceMatch = ({ memberIds, searchTerm, barangayFilter }) => {
  const match = { status: 'active' };
  const andConditions = [];

  if (Array.isArray(memberIds) && memberIds.length > 0) {
    andConditions.push({ memberId: { $in: memberIds } });
  }

  if (barangayFilter && barangayFilter !== 'All') {
    // The filter value comes from the list of distinct Member.barangay values,
    // so match that field exactly. Legacy members saved before barangay was
    // captured separately have it blank — only those fall back to matching the
    // address text, otherwise a member living on a street named after another
    // barangay would be filtered into the wrong one.
    const exactBarangay = new RegExp(`^${escapeRegex(barangayFilter)}$`, 'i');
    andConditions.push({
      $or: [
        { barangay: exactBarangay },
        {
          barangay: { $in: [null, ''] },
          address: new RegExp(escapeRegex(barangayFilter), 'i'),
        },
      ],
    });
  }

  if (searchTerm) {
    const searchRegex = new RegExp(escapeRegex(searchTerm), 'i');
    andConditions.push({
      $or: [
      { memberName: searchRegex },
      { memberId: searchRegex },
      { email: searchRegex },
      { phoneNumber: searchRegex },
      { address: searchRegex },
      { beneficiaries: searchRegex },
      ],
    });
  }

  if (andConditions.length > 0) {
    match.$and = andConditions;
  }

  return match;
};

const getMemberBalanceSnapshots = async ({
  memberIds,
  searchTerm = '',
  barangayFilter = '',
  shouldPaginate = false,
  page = 1,
  limit = 10,
  skip = 0,
} = {}) => {
  const pipeline = [
    // Stage 1: Match active members with filters (uses indexes)
    { $match: buildBalanceMatch({ memberIds, searchTerm, barangayFilter }) },
    
    // Stage 2: Lookup latest ledger entry (optimized with sorted pipeline)
    {
      $lookup: {
        from: Ledger.collection.name,
        let: { memberId: '$memberId' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$memberId', '$$memberId'] },
            },
          },
          // Posting order (compound index: memberId + createdAt). Ordering by
          // transactionDate here is what froze member balances — a row dated
          // ahead of "now" masked every deduction posted after it. See
          // utils/ledgerBalance.
          { $sort: { createdAt: -1, _id: -1 } },
          { $limit: 1 },
          { $project: { balance: 1, transactionDate: 1, _id: 0 } }, // Exclude _id for smaller payload
        ],
        as: 'latestLedger',
      },
    },
    
    // Stage 3: Flatten latestLedger array
    {
      $addFields: {
        latestLedger: { $arrayElemAt: ['$latestLedger', 0] },
      },
    },
    
    // Stage 4: Calculate derived fields
    {
      $addFields: {
        balance: { $ifNull: ['$latestLedger.balance', 0] },
        lastUpdated: '$latestLedger.transactionDate',
        isLowBalance: { $lt: [{ $ifNull: ['$latestLedger.balance', 0] }, MINIMUM_BALANCE] },
      },
    },
    
    // Stage 5: Project only needed fields (reduces memory usage)
    {
      $project: {
        _id: 0,
        id: '$memberId',
        memberId: 1,
        name: '$memberName',
        memberName: 1,
        email: 1,
        contact: '$phoneNumber',
        phoneNumber: 1,
        address: 1,
        barangay: 1,
        beneficiaries: 1,
        status: 1,
        join_date: '$joinDate',
        balance: 1,
        isLowBalance: 1,
        lastUpdated: 1,
      },
    },
    
    // Stage 6: Sort (uses balance for low-balance priority)
    { $sort: { balance: 1, memberName: 1 } },
    
    // Stage 7: Facet for pagination + summary (single pass!)
    {
      $facet: {
        members: shouldPaginate ? [{ $skip: skip }, { $limit: limit }] : [],
        summary: [
          {
            $group: {
              _id: null,
              totalMembers: { $sum: 1 },
              totalBalance: { $sum: '$balance' },
              lowBalanceCount: { $sum: { $cond: ['$isLowBalance', 1, 0] } },
              minBalance: { $min: '$balance' },
              maxBalance: { $max: '$balance' },
            },
          },
        ],
      },
    },
    
    // Stage 8: Format output
    {
      $project: {
        members: { $ifNull: ['$members', []] },
        summary: {
          $let: {
            vars: {
              stats: {
                $ifNull: [
                  { $arrayElemAt: ['$summary', 0] },
                  { 
                    totalMembers: 0, 
                    totalBalance: 0, 
                    lowBalanceCount: 0,
                    minBalance: 0,
                    maxBalance: 0
                  },
                ],
              },
            },
            in: {
              totalMembers: '$$stats.totalMembers',
              totalBalance: '$$stats.totalBalance',
              averageBalance: {
                $cond: [
                  { $gt: ['$$stats.totalMembers', 0] },
                  { $divide: ['$$stats.totalBalance', '$$stats.totalMembers'] },
                  0,
                ],
              },
              lowBalanceCount: '$$stats.lowBalanceCount',
              minimumBalance: MINIMUM_BALANCE,
              minBalance: '$$stats.minBalance',
              maxBalance: '$$stats.maxBalance',
            },
          },
        },
      },
    },
  ];

  // Execute with disk use for large datasets
  const [result] = await Member.aggregate(pipeline).allowDiskUse(true);

  const summary = result?.summary || {
    totalMembers: 0,
    totalBalance: 0,
    averageBalance: 0,
    lowBalanceCount: 0,
    minimumBalance: MINIMUM_BALANCE,
    minBalance: 0,
    maxBalance: 0,
  };

  return {
    members: result?.members || [],
    summary,
    total: summary.totalMembers || 0,
    pagination: shouldPaginate ? buildPaginationMeta(summary.totalMembers || 0, page, limit) : null,
  };
};

// Get all member balances
const getAllMemberBalances = async (req, res) => {
  try {
    const shouldPaginate = req.query.page !== undefined || req.query.limit !== undefined;
    const { page, limit, skip } = getPaginationParams(req.query);
    const searchTerm = (req.query.search || '').trim().toLowerCase();
    const barangayFilter = (req.query.barangay || '').trim();
    const { members, summary, pagination } = await getMemberBalanceSnapshots({
      searchTerm,
      barangayFilter,
      shouldPaginate,
      page,
      limit,
      skip,
    });

    const responseData = {
      members,
      summary: {
        ...summary,
        averageBalance: Math.round(summary.averageBalance || 0),
      },
    };

    if (pagination) {
      responseData.pagination = pagination;
    }
    
    res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error fetching member balances:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching member balances', 
      error: error.message 
    });
  }
};

// Process automatic deduction for all members (triggered when someone dies)
const processAutomaticDeduction = async (req, res) => {
  try {
    const { deceasedMemberName, recordedBy, customAmount } = req.body;
    
    if (!deceasedMemberName) {
      return res.status(400).json({
        success: false,
        message: 'Deceased member name is required'
      });
    }
    
    // Use custom amount if provided, otherwise use default
    const deductionAmount = customAmount ? parseFloat(customAmount) : DEDUCTION_AMOUNT;
    
    if (isNaN(deductionAmount) || deductionAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid deduction amount'
      });
    }
    
    const { members } = await getMemberBalanceSnapshots();
    
    const deductionResults = [];
    const lowBalanceMembers = [];
    
    for (const member of members) {
      try {
        const currentBalance = member.balance || 0;
        const newBalance = currentBalance - deductionAmount;
        
        // Create ledger entry for deduction
        const ledgerEntry = new Ledger({
          ledgerId: uuidv4(),
          memberId: member.memberId,
          transactionType: 'automatic_deduction',
          description: `Automatic deduction for death of ${deceasedMemberName}`,
          debit: deductionAmount,
          credit: 0,
          balance: newBalance,
          transactionDate: new Date(),
          recordedBy: recordedBy || 'system'
        });
        
        await ledgerEntry.save();
        
        // Check thresholds and send notifications if needed
        try {
          await checkAndNotify(
            member.memberId,
            member.memberName,
            member.phoneNumber,
            currentBalance,
            newBalance,
            'deduction',
            ledgerEntry.ledgerId
          );
        } catch (notificationError) {
          // Log but don't fail the deduction if notification fails
          console.error(`Error sending threshold notification for ${member.memberId}:`, notificationError);
        }
        
        const result = {
          memberId: member.memberId,
          memberName: member.memberName,
          phoneNumber: member.phoneNumber,
          previousBalance: currentBalance,
          newBalance: newBalance,
          deductionAmount: deductionAmount,
          isLowBalance: newBalance < MINIMUM_BALANCE
        };
        
        deductionResults.push(result);
        
        // Track members with low balance after deduction
        if (newBalance < MINIMUM_BALANCE) {
          lowBalanceMembers.push(result);
        }
        
      } catch (memberError) {
        console.error(`Error processing deduction for member ${member.memberId}:`, memberError);
        deductionResults.push({
          memberId: member.memberId,
          memberName: member.memberName,
          error: memberError.message
        });
      }
    }
    
    res.status(200).json({
      success: true,
      message: `Automatic deduction processed for ${deductionResults.length} members`,
      data: {
        deceasedMemberName,
        deductionAmount: deductionAmount,
        processedMembers: deductionResults.length,
        lowBalanceMembers: lowBalanceMembers.length,
        deductionResults: deductionResults,
        lowBalanceList: lowBalanceMembers
      }
    });
    
  } catch (error) {
    console.error('Error processing automatic deduction:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error processing automatic deduction', 
      error: error.message 
    });
  }
};

// Check for members with low balance
const checkLowBalanceMembers = async (req, res) => {
  try {
    const { members } = await getMemberBalanceSnapshots();

    const lowBalanceMembers = members
      .filter((member) => (member.balance || 0) < MINIMUM_BALANCE)
      .map((member) => ({
        memberId: member.memberId,
        memberName: member.memberName,
        phoneNumber: member.phoneNumber,
        balance: member.balance || 0,
        deficit: MINIMUM_BALANCE - (member.balance || 0),
        lastUpdated: member.lastUpdated || null,
      }));
    
    res.status(200).json({
      success: true,
      data: {
        lowBalanceMembers: lowBalanceMembers,
        count: lowBalanceMembers.length,
        minimumBalance: MINIMUM_BALANCE
      }
    });
    
  } catch (error) {
    console.error('Error checking low balance members:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error checking low balance members', 
      error: error.message 
    });
  }
};

// Send SMS notifications to members with low balance
const sendLowBalanceNotifications = async (req, res) => {
  try {
    const { memberIds } = req.body; // Optional: specific member IDs, otherwise send to all low balance members
    
    const { members } = await getMemberBalanceSnapshots({ memberIds });

    const targetMembers = members
      .filter((member) => (member.balance || 0) < MINIMUM_BALANCE)
      .map((member) => ({
        ...member,
        balance: member.balance || 0,
        deficit: MINIMUM_BALANCE - (member.balance || 0),
      }));
    
    // TODO: Integrate with SMS service
    // For now, we'll just return the members who should receive notifications
    const notifications = targetMembers.map(member => ({
      memberId: member.memberId,
      memberName: member.memberName,
      phoneNumber: member.phoneNumber,
      balance: member.balance,
      deficit: member.deficit,
      message: `Dear ${member.memberName}, your mortuary fund balance is ₱${member.balance.toLocaleString()}, which is below the minimum required balance of ₱${MINIMUM_BALANCE.toLocaleString()}. Please make a contribution of at least ₱${member.deficit.toLocaleString()} to maintain your account in good standing.`,
      status: 'pending' // Would be 'sent' when SMS service is integrated
    }));
    
    res.status(200).json({
      success: true,
      message: `Low balance notifications prepared for ${notifications.length} members`,
      data: {
        notifications: notifications,
        count: notifications.length,
        minimumBalance: MINIMUM_BALANCE
      }
    });
    
  } catch (error) {
    console.error('Error sending low balance notifications:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error sending low balance notifications', 
      error: error.message 
    });
  }
};

module.exports = {
  getAllMemberBalances,
  processAutomaticDeduction,
  checkLowBalanceMembers,
  sendLowBalanceNotifications,
  // Exported so the per-claim deduction flow (treasurerClaimController.js)
  // can reuse the same "active member balance snapshot" logic instead of
  // duplicating it.
  getMemberBalanceSnapshots,
};