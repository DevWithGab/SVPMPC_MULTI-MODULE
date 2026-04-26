// Legacy controllers (for backward compatibility)
const dashboardController = require('./dashboardController');
const claimController = require('./claimController');
const contributionController = require('./contributionController');
const ledgerController = require('./ledgerController');
const paymentScheduleController = require('./paymentScheduleController');
const notificationController = require('./notificationController');
const deductionController = require('./deductionController');
const adminController = require('./adminController');
const payoutController = require('./payoutController');

module.exports = {
  // Controllers
  dashboardController,
  claimController,
  contributionController,
  ledgerController,
  paymentScheduleController,
  notificationController,
  deductionController,
  adminController,
  payoutController,
};
