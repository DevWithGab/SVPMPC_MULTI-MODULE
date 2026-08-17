// Legacy controllers (for backward compatibility)
const dashboardController = require('./dashboardController');
const contributionController = require('./contributionController');
const ledgerController = require('./ledgerController');
const deductionController = require('./deductionController');
const adminController = require('./adminController');
const payoutController = require('./payoutController');
const claimController = require('./claimController');
const beneficiaryController = require('./beneficiaryController');
const deductionSettingController = require('./deductionSettingController');
const treasurerClaimController = require('./treasurerClaimController');

module.exports = {
  // Controllers
  dashboardController,
  contributionController,
  ledgerController,
  deductionController,
  adminController,
  payoutController,
  claimController,
  beneficiaryController,
  deductionSettingController,
  treasurerClaimController,
};
