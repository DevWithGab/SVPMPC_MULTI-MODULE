const Member = require('../../../shared/models/Member');
const Ledger = require('../models/Ledger');
const DeductionSetting = require('../models/DeductionSetting');
const { v4: uuidv4 } = require('uuid');
const { createHash } = require('node:crypto');
const { getPaginationParams, buildPaginationMeta } = require('../../../shared/utils/pagination');
const { createAuditLog } = require('../../../shared/services/auditLoggingService');
const { safeErrorMessage } = require('../../../middleware/errorHandler');
const { actorName } = require('../../../shared/utils/actorName');

/* Parehong deterministic-id dedup pattern gaya ng contributionController's
manualPaymentId: hindi dapat magpost ng second debit sa every active member
yung double-click, retried request, o second treasurer tab na nag-resubmit
ng same "deceased member" run. Unique yung Ledger.ledgerId, kaya yung
repeat call para sa same (deceasedMemberName, memberId) ay upsert lang sa
same row sa halip na gumawa ng bago - confirmed na dati itong unguarded
(walang key at all) at mag-re-debit ng every active member sa every
retry. */
const autoDeductionId = (deceasedMemberName, memberId) =>
  `AUTO-DEDUCT-${createHash('sha256').update(JSON.stringify([deceasedMemberName.trim().toLowerCase(), memberId])).digest('hex')}`;

// Constants
const MINIMUM_BALANCE = 1000; // 1000 pesos minimum balance
/* Matches FALLBACK_DEDUCTION_AMOUNT sa treasurerClaimController.js /
DEFAULT_DEDUCTION_AMOUNT sa deductionSettingController.js - ginagamit lang
kung walang rate row pa (ang Admin screen ay auto-seeds ng isa sa first
view). */
const FALLBACK_DEDUCTION_AMOUNT = 25;

/* Parehong resolver gaya ng treasurerClaimController.js's resolveDeductionRate:
yung per-member amount ay itinatakda ng Admin sa Deduction Settings at hindi
pagpipilian ng Treasurer, kaya dapat i-resolve ito ng blanket action na ito
dito sa halip na magtiwala sa kung ano man galing sa request -
processAutomaticDeduction dati ay tumatanggap ng client-supplied customAmount
at kung wala, bumabalik sa hardcoded ₱25, silently na-iignore kung ano man
yung rate na talagang configured ng Admin. Kept ito as its own small copy sa
halip na i-import galing sa treasurerClaimController.js, dahil yung file na
yun ay nag-import na ng getMemberBalanceSnapshots FROM dito - circular na
yun kung babalikan. */
const resolveDeductionRate = async () => {
  const setting = await DeductionSetting.findOne({ status: 'active' });
  return setting?.amount ?? FALLBACK_DEDUCTION_AMOUNT;
};

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildBalanceMatch = ({ memberIds, searchTerm, barangayFilter, includeAllStatuses }) => {
  /* Lahat ng caller maliban sa Treasurer's Reports screen ay gusto lang ng
  active members (yun naman talaga ang ibig sabihin ng "balance management"
  day to day) - kailangan ng Reports yung every status para mareport din
  ang deceased/inactive members, kaya opt-out siya sa default na ito sa
  halip na paramihin ng status enum yung helper na ito. */
  const match = includeAllStatuses ? {} : { status: 'active' };
  const andConditions = [];

  if (Array.isArray(memberIds) && memberIds.length > 0) {
    andConditions.push({ memberId: { $in: memberIds } });
  }

  if (barangayFilter && barangayFilter !== 'All') {
    /* Galing sa list ng distinct Member.barangay values yung filter value,
    kaya dapat exact match sa field na yun. Yung legacy members na na-save
    bago pa nakuha separately yung barangay ay blangko - sila lang ang
    babalik sa matching sa address text, kung hindi mapupunta sa maling
    barangay yung isang member na nakatira sa street na pangalan ng ibang
    barangay. */
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
    /* Gamit yung Member.js's text index (member_search_text), pinalitan
    yung unanchored $regex $or na dating full collection scan kahit meron
    namang ibang indexes yung model na ito (confirmed via explain():
    COLLSCAN sa 10k members). Dapat top-level query key yung $text, hindi
    nested sa $or/$and, kaya direktang nilagay sa match sa halip na idagdag
    sa andConditions. Nag-match ng whole tokens, hindi substrings - "mar"
    hindi na nag-match sa "Maria"; partial memberId/phone fragment hindi na
    rin nag-match. */
    match.$text = { $search: searchTerm };
  }

  return match;
};

/* Dati isang Member.aggregate() lang na yung $lookup niya ay tumatakbo ng
isang correlated sub-query (match + sort + limit 1) papuntang Ledger PER
MATCHED MEMBER - tama naman, pero hindi talaga naka-scale sa member count
yung per-document correlated subquery kahit gaano pa well-indexed ang
bawat individual lookup. Measured sa 10,000 members / 200,000 ledger rows:
umabot ng ~6.9s yung $lookup stage sa ibabaw ng ~0.4s $match, at yung
totoong HTTP endpoint (GET /mortuary/treasurer/balances/all) ay 9.2s para
sa isang request at 13-14s per request kung 5 concurrent lang.

Parehong result, pero computed as two plain queries sa halip: isang pass
sa Ledger para makuha yung latest-by-posting-order balance ng every member
(sort + group, gamit yung existing {memberId:1, createdAt:-1} index - yung
$match dito ay SAME filter na ginamit ng lumang $lookup per-document, isang
beses lang applied up front), tapos merge yun sa already-fetched Member
list sa application code. Measured equivalent: ~0.7s para sa Ledger side sa
same volume - hindi nagbago yung Member $match/$find side (buildBalanceMatch,
same indexes, same filters). Walang behavior change: identical filtering,
sorting, summary math, at pagination contract gaya ng pipeline na pinalitan
nito. */
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
      /* Posting order (compound index: memberId + createdAt). Yung
      pag-order by transactionDate dito ang nagpafreeze ng member balances -
      yung row na dated ahead of "now" ay nagmask ng every deduction na
      naipost after nito. Tingnan yung utils/ledgerBalance. */
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

  /* Parehong tie-break gaya ng pinalitang $sort: {balance:1, memberName:1} -
  plain string comparison, hindi locale-aware, para tumugma sa byte-wise
  string ordering ni Mongo mismo. */
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

/* Nagproseso ng automatic deduction para sa lahat ng members (triggered kung
may namatay). Blanket, non-claim-linked counterpart ito ng
processClaimDeduction sa treasurerClaimController.js - tingnan yung header
comment ng module na yun ("Flow A") kung paano magkaugnay yung dalawa. Real
money movement ito across every active member, kaya kinakailangan niyang
i-resolve yung Admin-configured rate sa parehong paraan ng claim-linked
flow, at audit-logged din sa parehong paraan. */
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
    const actor = actorName(req.user, 'treasurer');

    const { members } = await getMemberBalanceSnapshots();
    
    const deductionResults = [];
    const lowBalanceMembers = [];
    
    for (const member of members) {
      try {
        const id = autoDeductionId(deceasedMemberName, member.memberId);
        const currentBalance = member.balance || 0;
        const newBalance = Math.round((currentBalance - deductionAmount) * 100) / 100;

        /* Parehong two-step check-then-reserve shape gaya ng
        recordContribution: plain pre-check muna (cheap, covers yung common
        case - admin na nag-re-run ng same deceased-member deduction
        pagkatapos nitong matapos na), backed ng unique ledgerId index + isang
        11000 catch para sa rare race kung sabay dumating ang dalawang
        requests. */
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
          /* I-report kung ano talaga yung naipost, hindi fresh (at sa repeat
          call, mali) na recomputation - mirrors nito yung recordContribution
          na nagbabalik ng existingLedger.balance para sa already-posted
          row. */
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
  /* Exported para magamit din ng per-claim deduction flow
  (treasurerClaimController.js) yung parehong "active member balance
  snapshot" logic sa halip na i-duplicate ito. */
  getMemberBalanceSnapshots,
};