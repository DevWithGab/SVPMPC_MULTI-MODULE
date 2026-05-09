// Legacy controllers (for backward compatibility)
const dashboardController = require('./dashboardController');
const contributionController = require('./contributionController');
const ledgerController = require('./ledgerController');
const deductionController = require('./deductionController');
const adminController = require('./adminController');
const payoutController = require('./payoutController');

module.exports = {
  // Controllers
  dashboardController,
  contributionController,
  ledgerController,
  deductionController,
  adminController,
  payoutController,
};
