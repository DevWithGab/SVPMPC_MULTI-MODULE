const Ledger = require('../models/Ledger');
const Contribution = require('../models/Contribution');
const PaymentImport = require('../models/PaymentImport');
const { resolveLedgerPaymentReferences } = require('../utils/ledgerReferences');
const { Member } = require('../../../shared/models');
const { getPaginationParams, buildPaginatedResponse } = require('../../../shared/utils/pagination');
const { LATEST_FIRST, getLatestBalance, getLatestBalancesByMember } = require('../utils/ledgerBalance');
const { safeErrorMessage } = require('../../../middleware/errorHandler');
const { parseLedgerCsv, validateLedgerEntries, keyOf } = require('../utils/ledgerCsv');
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
    /* I-check muna lahat ng row bago magsulat ng kahit ano, kasama na kapag import: puwedeng
    nagbago na yung data dahil baka may lumipas na oras mula nung na-preview ng user.

    Dati, 2-3 sequential DB round trips ito PER ROW (member lookup, duplicate-entry lookup,
    duplicate-ledgerId lookup) - kasama yung row cap sa baba, pag 1000-row file, aabot ng
    ~3000 queries lang para ma-validate. Sa ngayon, isa lang na fetch per batch - base sa
    eksaktong member IDs, dates, at ledgerIds na ginagamit ng upload na ito - kaya naging 3
    queries na lang lahat-lahat kahit gaano karami ang rows, tapos yung per-row logic
    nagagana na laban sa in-memory lookups. */
    const candidateRows = rows.filter(row => !row.errors.length);
    const memberIds = [...new Set(candidateRows.map(row => row.entry.memberId))];
    const members = memberIds.length ? await Member.find({ memberId: { $in: memberIds } }) : [];
    const memberById = new Map(members.map(member => [member.memberId, member]));

    const dates = [...new Set(candidateRows.map(row => row.entry.transactionDate))].map(d => new Date(d));
    const existingLedgers = memberIds.length
      ? await Ledger.find({ memberId: { $in: memberIds }, transactionDate: { $in: dates } })
      : [];
    const existingKeys = new Set(existingLedgers.map(ledger => keyOf({
      memberId: ledger.memberId, transactionDate: ledger.transactionDate.toISOString().slice(0, 10),
      credit: ledger.credit, debit: ledger.debit, referenceId: ledger.referenceId || null,
    })));

    const ledgerIdsToCheck = candidateRows.map(row => row.entry.ledgerId).filter(Boolean);
    const existingLedgerIds = new Set(ledgerIdsToCheck.length
      ? (await Ledger.find({ ledgerId: { $in: ledgerIdsToCheck } }, { ledgerId: 1 })).map(l => l.ledgerId)
      : []);

    for (const row of rows) {
      if (row.errors.length) continue;
      const member = memberById.get(row.entry.memberId);
      row.memberName = member?.memberName || '';
      if (!member) row.errors.push('Passbook No. was not found.');
      if (existingKeys.has(keyOf(row.entry))) row.errors.push('This ledger entry is already recorded. Remove it from the CSV.');
      if (row.entry.ledgerId && existingLedgerIds.has(row.entry.ledgerId)) row.errors.push('This ledgerId is already in use.');
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

    /* Lahat ng row na nakarating dito ay pumasa na sa member-existence, duplicate-entry, at
    required-field checks sa itaas - at yung summary.invalid gate sa taas ay agad nang bumalik
    kapag may fail sa mga yun. Kung ulitin pa yung parehong checks per row dito (bilang second
    loop), wala talagang mahuhuli pa; dead work na lang ito mula nung hiniwalay yung dalawang
    loop. Yung natitirang totoong cost per row ay yung write mismo, plus running balance.

    Posting order ang ginamit, hindi yung uploaded transactionDate: puwedeng may back-dated o
    future-dated rows sa bulk file, at kailangang sundin ng running balance yung order kung
    saan talagang na-write yung rows. Isang batched lookup ang nagse-seed ng starting balance
    ng kada member (0 kapag walang prior rows, same fallback na ginagamit ng
    getLatestBalance); tapos in-memory running total na ang nagdadala nito pasulong kahit
    maraming rows ng same member sa upload na ito. */
    const balances = await getLatestBalancesByMember(memberIds);

    for (const [index, entry] of ledgerEntries.entries()) {
      try {
        const currentBalance = balances.get(entry.memberId) || 0;
        const credit = entry.credit;
        const debit = entry.debit;
        const newBalance = Math.round((currentBalance + credit - debit) * 100) / 100;
        balances.set(entry.memberId, newBalance);

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
