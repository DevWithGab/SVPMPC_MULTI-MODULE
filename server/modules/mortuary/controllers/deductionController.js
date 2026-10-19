const Member = require('../../../shared/models/Member');
const Ledger = require('../models/Ledger');
const DeductionSetting = require('../models/DeductionSetting');
const { v4: uuidv4 } = require('uuid');
const { createHash } = require('node:crypto');
const { getPaginationParams, buildPaginationMeta } = require('../../../shared/utils/pagination');
const { createAuditLog } = require('../../../shared/services/auditLoggingService');
const { safeErrorMessage } = require('../../../middleware/errorHandler');

// Same deterministic-id dedup pattern as contributionController's
// manualPaymentId: a double-click, a retried request, or a second treasurer
// tab resubmitting the same "deceased member" run must not post a second
// debit to every active member. Ledger.ledgerId is unique, so a repeat call
// for the same (deceasedMemberName, memberId) upserts onto the same row
// instead of creating a new one — confirmed this was previously unguarded
// (no key at all) and would re-debit every active member on every retry.
const autoDeductionId = (deceasedMemberName, memberId) =>
  `AUTO-DEDUCT-${createHash('sha256').update(JSON.stringify([deceasedMemberName.trim().toLowerCase(), memberId])).digest('hex')}`;

// Constants
const MINIMUM_BALANCE = 1000; // 1000 pesos minimum balance
// Matches FALLBACK_DEDUCTION_AMOUNT in treasurerClaimController.js /
// DEFAULT_DEDUCTION_AMOUNT in deductionSettingController.js — used only if
// no rate row exists yet (the Admin screen auto-seeds one on first view).
const FALLBACK_DEDUCTION_AMOUNT = 25;

// Same resolver as treasurerClaimController.js's resolveDeductionRate: the
// per-member amount is set by the Admin in Deduction Settings and is not the
// Treasurer's to choose, so this blanket action must resolve it here rather
// than trust anything off the request — processAutomaticDeduction used to
// accept a client-supplied customAmount and otherwise fell back to a
// hardcoded ₱25, silently ignoring whatever rate the Admin had actually
// configured. Kept as its own small copy rather than imported from
// treasurerClaimController.js, since that file already imports
// getMemberBalanceSnapshots FROM this one — importing back would be circular.
const resolveDeductionRate = async () => {
  const setting = await DeductionSetting.findOne({ status: 'active' });
  return setting?.amount ?? FALLBACK_DEDUCTION_AMOUNT;
};

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildBalanceMatch = ({ memberIds, searchTerm, barangayFilter, includeAllStatuses }) => {
  // Every caller except the Treasurer's Reports screen wants only active
  // members (that's what "balance management" means day to day) — Reports
  // needs every status to report on deceased/inactive members too, so it
  // opts out of this default instead of this helper growing a status enum.
  const match = includeAllStatuses ? {} : { status: 'active' };
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

  if (andConditions.length > 0) {
    match.$and = andConditions;
  }

  if (searchTerm) {
    // Member.js's text index (member_search_text), replacing an unanchored
    // $regex $or that was a full collection scan regardless of this
    // model's other indexes (confirmed via explain(): COLLSCAN at 10k
    // members). $text must be a top-level query key, not nested inside
    // $or/$and, so it's set directly on match rather than pushed onto
    // andConditions. Matches whole tokens, not substrings — "mar" no
    // longer matches "Maria"; a partial memberId/phone fragment no longer
    // matches either.
    match.$text = { $search: searchTerm };
  }

  return match;
};

// Was a single Member.aggregate() whose $lookup ran one correlated
// sub-query (match + sort + limit 1) into Ledger PER MATCHED MEMBER —
// correct, but a per-document correlated subquery doesn't scale with
// member count no matter how well-indexed each individual lookup is.
// Measured at 10,000 members / 200,000 ledger rows: the $lookup stage
// alone cost ~6.9s on top of the ~0.4s $match, and the real HTTP endpoint
// (GET /mortuary/treasurer/balances/all) took 9.2s for one request and
// 13-14s per request under just 5 concurrent ones.
//
// Same result, computed as two plain queries instead: one pass over
// Ledger to get every member's latest-by-posting-order balance (sort +
// group, using the existing {memberId:1, createdAt:-1} index — the
// $match here is the SAME filter the old $lookup applied per-document,
// just applied once up front), then merge that onto the already-fetched
// Member list in application code. Measured equivalent: ~0.7s for the
// Ledger side at the same volume — the Member $match/$find side is
// unchanged from before (buildBalanceMatch, same indexes, same filters).
// No behavior change: identical filtering, sorting, summary math, and
// pagination contract as the pipeline this replaces.
const getMemberBalanceSnapshots = async ({
  memberIds,
  searchTerm = '',
  barangayFilter = '',
  shouldPaginate = false,
  page = 1,
  limit = 10,
  skip = 0,
  includeAllStatuses = false,
} = {}) => {
  const matchedMembers = await Member.find(
    buildBalanceMatch({ memberIds, searchTerm, barangayFilter, includeAllStatuses })
  )
    .select('memberId memberName email phoneNumber address barangay beneficiaries status joinDate')
    .lean();

  const matchedMemberIds = matchedMembers.map((member) => member.memberId);
  const latestLedgerByMember = new Map();
  if (matchedMemberIds.length > 0) {
    const latestLedgerRows = await Ledger.aggregate([
      { $match: { memberId: { $in: matchedMemberIds } } },
      // Posting order (compound index: memberId + createdAt). Ordering by
      // transactionDate here is what froze member balances — a row dated
      // ahead of "now" masked every deduction posted after it. See
      // utils/ledgerBalance.
      { $sort: { memberId: 1, createdAt: -1, _id: -1 } },
      { $group: { _id: '$memberId', balance: { $first: '$balance' }, transactionDate: { $first: '$transactionDate' } } },
    ]).allowDiskUse(true);
    for (const row of latestLedgerRows) latestLedgerByMember.set(row._id, row);
  }

  const members = matchedMembers.map((member) => {
    const latestLedger = latestLedgerByMember.get(member.memberId);
    const balance = latestLedger?.balance ?? 0;
    return {
      id: member.memberId,
      memberId: member.memberId,
      name: member.memberName,
      memberName: member.memberName,
      email: member.email,
      contact: member.phoneNumber,
      phoneNumber: member.phoneNumber,
      address: member.address,
      barangay: member.barangay,
      beneficiaries: member.beneficiaries,
      status: member.status,
      join_date: member.joinDate,
      balance,
      isLowBalance: balance < MINIMUM_BALANCE,
      lastUpdated: latestLedger?.transactionDate,
    };
  });

  // Same tie-break as the replaced $sort: {balance:1, memberName:1} —
  // plain string comparison, not locale-aware, to match Mongo's own
  // byte-wise string ordering.
  members.sort((a, b) => a.balance - b.balance || (a.memberName < b.memberName ? -1 : a.memberName > b.memberName ? 1 : 0));

  const totalMembers = members.length;
  const summaryTotals = members.reduce((acc, member) => {
    acc.totalBalance += member.balance;
    if (member.isLowBalance) acc.lowBalanceCount += 1;
    acc.minBalance = acc.minBalance === null ? member.balance : Math.min(acc.minBalance, member.balance);
    acc.maxBalance = acc.maxBalance === null ? member.balance : Math.max(acc.maxBalance, member.balance);
    return acc;
  }, { totalBalance: 0, lowBalanceCount: 0, minBalance: null, maxBalance: null });

  const summary = {
    totalMembers,
    totalBalance: summaryTotals.totalBalance,
    averageBalance: totalMembers > 0 ? summaryTotals.totalBalance / totalMembers : 0,
    lowBalanceCount: summaryTotals.lowBalanceCount,
    minimumBalance: MINIMUM_BALANCE,
    minBalance: summaryTotals.minBalance ?? 0,
    maxBalance: summaryTotals.maxBalance ?? 0,
  };

  return {
    members: shouldPaginate ? members.slice(skip, skip + limit) : members,
    summary,
    total: totalMembers,
    pagination: shouldPaginate ? buildPaginationMeta(totalMembers, page, limit) : null,
  };
};

// Get all member balances
const getAllMemberBalances = async (req, res) => {
  try {
    const shouldPaginate = req.query.page !== undefined || req.query.limit !== undefined;
    const { page, limit, skip } = getPaginationParams(req.query);
    const searchTerm = (req.query.search || '').trim().toLowerCase();
    const barangayFilter = (req.query.barangay || '').trim();
    const includeAllStatuses = req.query.status === 'all';
    const { members, summary, pagination } = await getMemberBalanceSnapshots({
      searchTerm,
      barangayFilter,
      shouldPaginate,
      page,
      limit,
      skip,
      includeAllStatuses,
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
      error: safeErrorMessage(error) 
    });
  }
};

// Process automatic deduction for all members (triggered when someone dies).
// A blanket, non-claim-linked counterpart to processClaimDeduction in
// treasurerClaimController.js — see this module's header comment there
// ("Flow A") for how the two relate. Real money movement across every
// active member, so it resolves the Admin-configured rate the same way the
// claim-linked flow does, and is audit-logged the same way too.
const processAutomaticDeduction = async (req, res) => {
  try {
    const { deceasedMemberName } = req.body;

    if (!deceasedMemberName) {
      return res.status(400).json({
        success: false,
        message: 'Deceased member name is required'
      });
    }

    const deductionAmount = await resolveDeductionRate();
    const actor = req.user?.username || 'treasurer';

    const { members } = await getMemberBalanceSnapshots();
    
    const deductionResults = [];
    const lowBalanceMembers = [];
    
    for (const member of members) {
      try {
        const id = autoDeductionId(deceasedMemberName, member.memberId);
        const currentBalance = member.balance || 0;
        const newBalance = Math.round((currentBalance - deductionAmount) * 100) / 100;

        // Same two-step check-then-reserve shape as recordContribution: a
        // plain pre-check first (cheap, covers the common case — an admin
        // re-running the same deceased-member deduction after it already
        // went through), backed by the unique ledgerId index + an 11000
        // catch for the rare race where two requests land at the same time.
        let ledgerEntry = await Ledger.findOne({ ledgerId: id });
        let alreadyProcessed = Boolean(ledgerEntry);
        if (!ledgerEntry) {
          try {
            ledgerEntry = await new Ledger({
              ledgerId: id,
              memberId: member.memberId,
              transactionType: 'automatic_deduction',
              description: `Automatic deduction for death of ${deceasedMemberName}`,
              debit: deductionAmount,
              credit: 0,
              balance: newBalance,
              transactionDate: new Date(),
              recordedBy: actor,
            }).save();
          } catch (error) {
            if (error.code !== 11000) throw error;
            ledgerEntry = await Ledger.findOne({ ledgerId: id });
            alreadyProcessed = true;
          }
        }

        const result = {
          memberId: member.memberId,
          memberName: member.memberName,
          phoneNumber: member.phoneNumber,
          previousBalance: currentBalance,
          // Report what's actually posted, not a fresh (and on a repeat
          // call, wrong) recomputation — mirrors recordContribution
          // returning existingLedger.balance for an already-posted row.
          newBalance: ledgerEntry.balance,
          deductionAmount: deductionAmount,
          isLowBalance: ledgerEntry.balance < MINIMUM_BALANCE,
          alreadyProcessed,
        };

        deductionResults.push(result);

        // Track members with low balance after deduction
        if (ledgerEntry.balance < MINIMUM_BALANCE) {
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
    
    await createAuditLog({
      userId: req.user?.userId,
      userName: actor,
      userRole: req.user?.role || 'treasurer',
      action: 'automatic_deduction_processed',
      module: 'mortuary',
      entityType: 'member',
      entityName: deceasedMemberName,
      description: `Blanket death-fund deduction for ${deceasedMemberName}: charged ${deductionResults.length} active members ₱${deductionAmount} each`,
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

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
      error: safeErrorMessage(error) 
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
      error: safeErrorMessage(error) 
    });
  }
};

module.exports = {
  getAllMemberBalances,
  processAutomaticDeduction,
  checkLowBalanceMembers,
  // Exported so the per-claim deduction flow (treasurerClaimController.js)
  // can reuse the same "active member balance snapshot" logic instead of
  // duplicating it.
  getMemberBalanceSnapshots,
};