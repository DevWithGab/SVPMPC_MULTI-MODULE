const Ledger = require('../models/Ledger');
const { Member } = require('../../../shared/models');

// Get member ledger
const getMemberLedger = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { limit = 100 } = req.query;

    // Verify member exists
    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    const ledgerEntries = await Ledger.find({ memberId })
      .sort({ transactionDate: -1 })
      .limit(parseInt(limit));

    // Get current balance
    const currentBalance = ledgerEntries.length > 0 ? ledgerEntries[0].balance : 0;

    // Calculate totals
    const totalCredits = ledgerEntries.reduce((sum, entry) => sum + entry.credit, 0);
    const totalDebits = ledgerEntries.reduce((sum, entry) => sum + entry.debit, 0);

    res.status(200).json({
      memberId,
      memberName: member.memberName,
      currentBalance,
      totalCredits,
      totalDebits,
      transactionCount: ledgerEntries.length,
      ledger: ledgerEntries,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching ledger', error: error.message });
  }
};

// Get all ledger entries (admin)
const getAllLedger = async (req, res) => {
  try {
    const { transactionType, limit = 100 } = req.query;

    let query = {};
    if (transactionType) {
      query.transactionType = transactionType;
    }

    const ledgerEntries = await Ledger.find(query)
      .sort({ transactionDate: -1 })
      .limit(parseInt(limit));

    // Format for frontend
    const formattedEntries = ledgerEntries.map(entry => ({
      id: entry.ledgerId,
      member_id: entry.memberId,
      date: entry.transactionDate.toISOString().split('T')[0],
      ref_no: entry.referenceId || entry.ledgerId,
      description: entry.description,
      received: entry.credit || 0,
      withdrawn: entry.debit || 0,
      balance: entry.balance
    }));

    res.status(200).json({
      success: true,
      data: formattedEntries,
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error fetching ledger', 
      error: error.message 
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

    const latestLedger = await Ledger.findOne({ memberId }).sort({ transactionDate: -1 });
    const balance = latestLedger ? latestLedger.balance : 0;

    res.status(200).json({
      memberId,
      memberName: member.memberName,
      balance,
      currency: 'PHP',
      lastUpdated: latestLedger ? latestLedger.transactionDate : null,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching balance', error: error.message });
  }
};

// Bulk upload ledger entries from CSV
const bulkUploadLedger = async (req, res) => {
  try {
    const { ledgerEntries } = req.body;

    if (!ledgerEntries || !Array.isArray(ledgerEntries) || ledgerEntries.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No ledger entries provided' 
      });
    }

    const results = {
      success: [],
      failed: [],
      total: ledgerEntries.length
    };

    for (const entry of ledgerEntries) {
      try {
        console.log(`📝 Processing ledger entry for member: ${entry.memberId}`);
        
        // Validate required fields
        if (!entry.memberId || !entry.transactionDate || (!entry.credit && !entry.debit)) {
          console.log(`❌ Missing required fields:`, entry);
          results.failed.push({
            entry,
            reason: 'Missing required fields (memberId, transactionDate, credit/debit)'
          });
          continue;
        }

        // Verify member exists
        const member = await Member.findOne({ memberId: entry.memberId });
        if (!member) {
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
          console.log(`⚠️  Duplicate entry found for ${entry.memberId}`);
          results.failed.push({
            entry,
            reason: `Duplicate entry - already exists (Ledger ID: ${duplicateCheck.ledgerId})`
          });
          continue;
        }

        // Get current balance for this member
        const lastLedgerEntry = await Ledger.findOne({ 
          memberId: entry.memberId 
        }).sort({ transactionDate: -1, _id: -1 });

        const currentBalance = lastLedgerEntry ? lastLedgerEntry.balance : 0;
        const credit = parseFloat(entry.credit) || 0;
        const debit = parseFloat(entry.debit) || 0;
        const newBalance = currentBalance + credit - debit;

        console.log(`💰 Creating ledger: ${entry.memberId}, Credit: ${credit}, Debit: ${debit}, New Balance: ${newBalance}`);

        const normalizedPaymentMethod = typeof entry.paymentMethod === 'string'
          ? entry.paymentMethod.trim().toLowerCase()
          : undefined;

        // Create ledger entry
        const ledgerEntry = new Ledger({
          ledgerId: entry.ledgerId || `L${Date.now()}_${entry.memberId}`,
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
        console.log(`✅ Ledger entry saved: ${ledgerEntry.ledgerId}`);
        results.success.push({
          memberId: entry.memberId,
          ledgerId: ledgerEntry.ledgerId,
          balance: newBalance
        });

      } catch (error) {
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
      results
    });

  } catch (error) {
    console.error('Error bulk uploading ledger:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to bulk upload ledger entries',
      error: error.message 
    });
  }
};

module.exports = {
  getMemberLedger,
  getAllLedger,
  getMemberBalance,
  bulkUploadLedger,
};
