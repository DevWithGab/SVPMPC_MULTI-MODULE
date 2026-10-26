const { createDailyLedgerSummaryService } = require('../services/dailyLedgerSummaryService');
const summary = createDailyLedgerSummaryService({
  Ledger: require('../models/Ledger'), Member: require('../../../shared/models/Member'),
  Contribution: require('../models/Contribution'), PaymentImport: require('../models/PaymentImport'),
});

exports.getDailyLedgerSummary = async (req, res) => {
  try {
    const data = await summary(req.query.date);
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Unable to load the complete daily summary. Please retry.' });
  }
};
