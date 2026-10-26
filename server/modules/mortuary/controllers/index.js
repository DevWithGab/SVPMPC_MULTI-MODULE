// Legacy controllers (for backward compatibility)
const dashboardController = require('./dashboardController');
const contributionController = require('./contributionController');
const ledgerController = require('./ledgerController');
const deductionController = require('./deductionController');
const adminController = require('./adminController');
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
  claimController,
  beneficiaryController,
  deductionSettingController,
  treasurerClaimController,
};
