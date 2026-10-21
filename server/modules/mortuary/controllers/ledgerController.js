const Ledger = require('../models/Ledger');
const { Member } = require('../../../shared/models');
const { getPaginationParams, buildPaginatedResponse } = require('../../../shared/utils/pagination');
const { LATEST_FIRST, getLatestBalance } = require('../utils/ledgerBalance');
const { safeErrorMessage } = require('../../../middleware/errorHandler');
const { parseLedgerCsv, validateLedgerEntries } = require('../utils/ledgerCsv');
const { randomUUID } = require('node:crypto');

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

    // Listed in posting order, matching how the running `balance` column was
    // computed — sorting a statement by the editable transactionDate would show
    // the balance column jumping around. See utils/ledgerBalance.
    const ledgerEntries = await Ledger.find({ memberId })
      .sort(LATEST_FIRST)
      .skip(skip)
      .limit(limit);

    const currentBalance = await getLatestBalance(memberId);

    // Calculate totals (from all entries, not just paginated)
    const allEntries = await Ledger.find({ memberId });
    const totalCredits = allEntries.reduce((sum, entry) => sum + entry.credit, 0);
    const totalDebits = allEntries.reduce((sum, entry) => sum + entry.debit, 0);

    // Format ledger entries for consistency with frontend expectations.
    // createdAt (full timestamp) is included alongside date (day-only) so
    // the client can break same-day ties by true recency too.
    const formattedEntries = ledgerEntries.map(entry => ({
      id: entry.ledgerId,
      member_id: entry.memberId,
      date: entry.transactionDate.toISOString().split('T')[0],
      createdAt: entry.createdAt,
      ref_no: entry.referenceId || entry.ledgerId,
      description: entry.description,
      transactionType: entry.transactionType,
      received: entry.credit || 0,
      withdrawn: entry.debit || 0,
      balance: entry.balance
    }));

    const response = buildPaginatedResponse(formattedEntries, total, page, limit);

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

    // Format for frontend. createdAt (full timestamp) is included alongside
    // date (day-only) so the client can break same-day ties by true recency.
    const formattedEntries = ledgerEntries.map(entry => ({
      id: entry.ledgerId,
      member_id: entry.memberId,
      date: entry.transactionDate.toISOString().split('T')[0],
      createdAt: entry.createdAt,
      ref_no: entry.referenceId || entry.ledgerId,
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

    // Need the full latest row, not just the balance number, so this reads
    // lastUpdated off it too — getLatestBalance (used elsewhere in this
    // file) only returns the balance.
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
    // Check every row before writing anything, including on import: the data
    // may have changed since the user requested a preview.
    for (const row of rows) {
      if (row.errors.length) continue;
      const member = await Member.findOne({ memberId: row.entry.memberId });
      row.memberName = member?.memberName || '';
      if (!member) row.errors.push('Passbook No. was not found.');
      const duplicate = await Ledger.findOne({
        memberId: row.entry.memberId, transactionDate: new Date(row.entry.transactionDate),
        credit: row.entry.credit, debit: row.entry.debit, referenceId: row.entry.referenceId,
      });
      if (duplicate) row.errors.push('This ledger entry is already recorded. Remove it from the CSV.');
      if (row.entry.ledgerId && await Ledger.findOne({ ledgerId: row.entry.ledgerId })) row.errors.push('This ledgerId is already in use.');
      row.status = row.errors.length ? 'error' : 'ready';
    }
    const summary = { total: rows.length, ready: rows.filter(row => !row.errors.length).length, invalid: rows.filter(row => row.errors.length).length };
    if (action === 'preview') return res.json({ success: true, rows, summary });
    if (summary.invalid) return res.status(400).json({ success: false, message: 'Correct every listed error and preview again. No ledger entries were imported.', rows, summary });
    const ledgerEntries = rows.map(row => row.entry);

    const results = {
      success: [],
      failed: [],
      total: ledgerEntries.length
    };

    for (const [index, entry] of ledgerEntries.entries()) {
      try {
        console.log(`📝 Processing ledger entry for member: ${entry.memberId}`);
        
        // Validate required fields
        if (!entry.memberId || !entry.transactionDate || (!entry.credit && !entry.debit)) {
          console.log(`❌ Missing required fields:`, entry);
          results.failed.push({
            entry,
            reason: 'Missing required fields (Passbook No., transactionDate, credit/debit)'
          });
          continue;
        }

        // Verify member exists
        const member = await Member.findOne({ memberId: entry.memberId });
        if (!member) {
          rows[index].status = 'failed';
          rows[index].errors.push('Passbook No. was not found.');
          console.log(`❌ Member not found: ${entry.memberId}`);
          results.failed.push({
            entry,
            reason: `Member ${entry.memberId} not found`
          });
          continue;
        }
        console.log(`✅ Member found: ${member.memberName}`);

        // Check for duplicate entry (same member, date, amount, and reference)
        const duplicateCheck = await Ledger.findOne({
          memberId: entry.memberId,
          transactionDate: new Date(entry.transactionDate),
          credit: parseFloat(entry.credit) || 0,
          debit: parseFloat(entry.debit) || 0,
          referenceId: entry.referenceId || entry.ref_no || null
        });

        if (duplicateCheck) {
          rows[index].status = 'failed';
          rows[index].errors.push('This ledger entry was just recorded. Preview again.');
          console.log(`⚠️  Duplicate entry found for ${entry.memberId}`);
          results.failed.push({
            entry,
            reason: `Duplicate entry - already exists (Ledger ID: ${duplicateCheck.ledgerId})`
          });
          continue;
        }

        // Get current balance for this member
        // Posting order, not the uploaded transactionDate: a bulk file may
        // carry back-dated or future-dated rows, and the running balance has to
        // follow the order rows are actually written.
        const currentBalance = await getLatestBalance(entry.memberId);
        const credit = parseFloat(entry.credit) || 0;
        const debit = parseFloat(entry.debit) || 0;
        const newBalance = Math.round((currentBalance + credit - debit) * 100) / 100;

        console.log(`💰 Creating ledger: ${entry.memberId}, Credit: ${credit}, Debit: ${debit}, New Balance: ${newBalance}`);

        const normalizedPaymentMethod = typeof entry.paymentMethod === 'string'
          ? entry.paymentMethod.trim().toLowerCase()
          : undefined;

        // Create ledger entry
        const ledgerEntry = new Ledger({
          ledgerId: entry.ledgerId || `L${randomUUID()}`,
          memberId: entry.memberId,
          transactionType: entry.transactionType || (credit > 0 ? 'contribution' : 'payout'),
          transactionDate: new Date(entry.transactionDate),
          description: entry.description || 'Bulk upload',
          credit: credit,
          debit: debit,
          balance: newBalance,
          referenceId: entry.referenceId || entry.ref_no || null,
          // paymentMethod defaults to schema value when omitted.
          ...(normalizedPaymentMethod && { paymentMethod: normalizedPaymentMethod })
        });

        await ledgerEntry.save();
        rows[index].status = 'imported';
        console.log(`✅ Ledger entry saved: ${ledgerEntry.ledgerId}`);
        results.success.push({
          memberId: entry.memberId,
          ledgerId: ledgerEntry.ledgerId,
          balance: newBalance
        });

      } catch (error) {
        rows[index].status = 'failed';
        rows[index].errors.push('Unable to save this entry. Refresh and preview the remaining entries before retrying.');
        console.error(`❌ Error processing entry:`, error.message);
        results.failed.push({
          entry,
          reason: error.message
        });
      }
    }

    console.log(`\n📊 Upload Summary: ${results.success.length} successful, ${results.failed.length} failed`);
    if (results.failed.length > 0) {
      console.log('Failed entries:', results.failed);
    }

    res.status(200).json({
      success: true,
      message: `Processed ${results.total} entries: ${results.success.length} successful, ${results.failed.length} failed`,
      results,
      rows
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
  getMemberLedger,
  getAllLedger,
  getMemberBalance,
  bulkUploadLedger,
};
