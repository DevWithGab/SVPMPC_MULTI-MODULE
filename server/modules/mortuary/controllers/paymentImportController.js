const { parsePaymentCsv } = require('../utils/paymentCsv');
const { createPaymentImportService } = require('../services/paymentImportService');
const service = createPaymentImportService({
  Member: require('../../../shared/models/Member'),
  Contribution: require('../models/Contribution'),
  Ledger: require('../models/Ledger'),
  PaymentImport: require('../models/PaymentImport'),
  getLatestBalance: require('../utils/ledgerBalance').getLatestBalance,
  checkAndNotify: require('../services/thresholdNotificationService').checkAndNotify,
});

const summarize = rows => ({
  total: rows.length,
  ready: rows.filter(row => ['ready', 'resume'].includes(row.status)).length,
  duplicates: rows.filter(row => ['duplicate', 'skipped'].includes(row.status)).length,
  invalid: rows.filter(row => row.status === 'error').length,
  imported: rows.filter(row => row.status === 'imported').length,
  failed: rows.filter(row => row.status === 'failed').length,
  amount: Math.round(rows.filter(row => ['ready', 'resume', 'imported'].includes(row.status)).reduce((sum, row) => sum + row.entry.amount, 0) * 100) / 100,
});

async function bulkUploadPayments(req, res) {
  let rows;
  try {
    if (!['preview', 'import'].includes(req.body.action)) throw new Error('Choose preview or import.');
    rows = parsePaymentCsv(req.body.csv);
  } catch (error) { return res.status(400).json({ success: false, message: error.message }); }
  try {
    if (req.body.action === 'preview') {
      const checked = await service.preview(rows);
      return res.json({ success: true, rows: checked, summary: summarize(checked) });
    }
    const result = await service.importRows(rows, req.user.userId || req.user.role);
    return res.status(result.blocked ? 400 : 200).json({
      success: !result.blocked, rows: result.rows, summary: summarize(result.rows),
      message: result.blocked ? 'Fix the listed errors before importing. No payments were imported.' : 'Payment import processed.',
    });
  } catch (error) {
    console.error('Bulk payment request failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to process the CSV. Retry with the same file; completed payments will be skipped.' });
  }
}

module.exports = { bulkUploadPayments };
