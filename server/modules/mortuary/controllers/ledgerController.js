const Ledger = require('../models/Ledger');
const Contribution = require('../models/Contribution');
const PaymentImport = require('../models/PaymentImport');
const { resolveLedgerPaymentReferences } = require('../utils/ledgerReferences');
const { Member } = require('../../../shared/models');
const { getPaginationParams, buildPaginatedResponse } = require('../../../shared/utils/pagination');
const { LATEST_FIRST, getLatestBalance, getLatestBalancesByMember } = require('../utils/ledgerBalance');
const { safeErrorMessage } = require('../../../middleware/errorHandler');
const { parseLedgerCsv, validateLedgerEntries } = require('../utils/ledgerCsv');
const { createLedgerImportService, summarize } = require('../services/ledgerImportService');
const ledgerImport = createLedgerImportService({ Member, Ledger, Contribution, getLatestBalancesByMember });
const { decorateLedgerEntries } = require('../utils/ledgerCorrections');
const { createLedgerCorrectionService } = require('../services/ledgerCorrectionService');
const ledgerCorrections = createLedgerCorrectionService({ Ledger, Contribution, AuditLog: require('../../../shared/models/AuditLog') });

const correctLedgerEntry = async (req, res) => {
  try {
    const posting = await ledgerCorrections.correct(req.params.memberId, req.params.ledgerId, req.body, req.user);
    res.json({ success: true, message: 'Correction recorded. The original entry is preserved.', ledgerId: posting.ledgerId, balance: posting.balance });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, saved: Boolean(error.saved), message: error.status ? error.message : 'Unable to save the correction. Retry the same request safely.' });
  }
};

// Get member ledger - with pagination
const getMemberLedger = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { page, limit, skip } = getPaginationParams(req.query);

    // Verify member exists
    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Get total count for pagination
    const total = await Ledger.countDocuments({ memberId });

    /* Naka-sort ito sa posting order, kasunod kung paano nacompute yung running `balance`
    column - kung isosort natin yung statement base sa editable transactionDate, lalabas na
    parang tumatalbog-talbog yung balance column. Check utils/ledgerBalance. */
    const ledgerEntries = await Ledger.find({ memberId })
      .sort(LATEST_FIRST)
      .skip(skip)
      .limit(limit);

    const currentBalance = await getLatestBalance(memberId);

    // Calculate totals (from all entries, not just paginated)
    const allEntries = await Ledger.find({ memberId });
    const totalCredits = allEntries.reduce((sum, entry) => sum + entry.credit, 0);
    const totalDebits = allEntries.reduce((sum, entry) => sum + entry.debit, 0);

    /* I-format yung ledger entries para consistent sa inaasahan ng frontend. Kasama yung
    createdAt (full timestamp) kasabay ng date (day-only) para ma-break ng client yung
    same-day ties base sa totoong recency. */
    const paymentReferences = await resolveLedgerPaymentReferences(ledgerEntries, { Contribution, PaymentImport });
    const formattedEntries = ledgerEntries.map(entry => ({
      id: entry.ledgerId,
      member_id: entry.memberId,
      date: entry.transactionDate.toISOString().split('T')[0],
      createdAt: entry.createdAt,
      ref_no: paymentReferences.get(entry.ledgerId) || entry.referenceId || entry.ledgerId,
      description: entry.description,
      transactionType: entry.transactionType,
      received: entry.credit || 0,
      withdrawn: entry.debit || 0,
      balance: entry.balance
    }));

    const response = buildPaginatedResponse(decorateLedgerEntries(formattedEntries, ledgerEntries, allEntries), total, page, limit);

    res.status(200).json({
      ...response,
      memberId,
      memberName: member.memberName,
      currentBalance,
      totalCredits,
      totalDebits,
      transactionCount: total,
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error fetching ledger', 
      error: safeErrorMessage(error) 
    });
  }
};

// Get all ledger entries (admin) - with pagination
const getAllLedger = async (req, res) => {
  try {
    const { transactionType } = req.query;
    const { page, limit, skip } = getPaginationParams(req.query);

    let query = {};
    if (transactionType) {
      query.transactionType = transactionType;
    }

    // Get total count for pagination
    const total = await Ledger.countDocuments(query);

    // Posting order, same reason as getMemberLedger above.
    const ledgerEntries = await Ledger.find(query)
      .sort(LATEST_FIRST)
      .skip(skip)
      .limit(limit);

    /* I-format para sa frontend. Kasama yung createdAt (full timestamp) kasabay ng date
    (day-only) para ma-break ng client yung same-day ties base sa totoong recency. */
    const paymentReferences = await resolveLedgerPaymentReferences(ledgerEntries, { Contribution, PaymentImport });
    const formattedEntries = ledgerEntries.map(entry => ({
      id: entry.ledgerId,
      member_id: entry.memberId,
      date: entry.transactionDate.toISOString().split('T')[0],
      createdAt: entry.createdAt,
      ref_no: paymentReferences.get(entry.ledgerId) || entry.referenceId || entry.ledgerId,
      description: entry.description,
      transactionType: entry.transactionType,
      received: entry.credit || 0,
      withdrawn: entry.debit || 0,
      balance: entry.balance
    }));

    res.status(200).json(buildPaginatedResponse(formattedEntries, total, page, limit));
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error fetching ledger', 
      error: safeErrorMessage(error) 
    });
  }
};

// Get member balance
const getMemberBalance = async (req, res) => {
  try {
    const { memberId } = req.params;

    // Verify member exists
    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    /* Kailangan dito yung buong latest row, hindi lang yung balance number, kasi kinukuha
    rito yung lastUpdated galing dun - si getLatestBalance (ginagamit sa ibang parte ng file
    na ito) balance lang yung ibinabalik. */
    const latestLedger = await Ledger.findOne({ memberId }).sort(LATEST_FIRST);

    res.status(200).json({
      memberId,
      memberName: member.memberName,
      balance: latestLedger ? latestLedger.balance : 0,
      currency: 'PHP',
      lastUpdated: latestLedger ? latestLedger.transactionDate : null,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching balance', error: safeErrorMessage(error) });
  }
};

// Bulk upload ledger entries from CSV
const bulkUploadLedger = async (req, res) => {
  try {
    let rows;
    const action = req.body.action || 'import';
    try {
      if (!['preview', 'import'].includes(action)) throw new Error('Choose preview or import.');
      rows = req.body.csv !== undefined ? parseLedgerCsv(req.body.csv) : validateLedgerEntries(req.body.ledgerEntries);
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (action === 'preview') {
      const checked = await ledgerImport.preview(rows);
      return res.json({ success: true, rows: checked, summary: summarize(checked) });
    }
    const result = await ledgerImport.importRows(rows, req.user?.username || req.user?.userId || req.user?.role || 'admin');
    const summary = summarize(result.rows);
    const results = {
      success: result.rows.filter(row => row.status === 'imported').map(row => ({ memberId: row.entry.memberId, ledgerId: row.ledgerId, balance: row.balance })),
      failed: result.rows.filter(row => row.status === 'failed').map(row => ({ entry: row.entry, reason: row.errors.join('; ') })),
      skipped: result.rows.filter(row => row.status === 'skipped').map(row => ({ row: row.row, entry: row.entry, reason: 'Duplicate - not recorded' })),
      total: result.rows.length,
    };
    return res.status(result.blocked ? 400 : 200).json({
      success: !result.blocked,
      message: result.blocked
        ? 'Correct the listed errors and preview again. No new ledger entries were recorded. Duplicates can stay in the file.'
        : `Recorded ${summary.imported} entries; ${summary.duplicates} duplicates not recorded; ${summary.failed} need retry.`,
      results, rows: result.rows, summary,
    });

  } catch (error) {
    console.error('Error bulk uploading ledger:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to bulk upload ledger entries',
      error: safeErrorMessage(error) 
    });
  }
};

module.exports = {
  correctLedgerEntry,
  getMemberLedger,
  getAllLedger,
  getMemberBalance,
  bulkUploadLedger,
};
