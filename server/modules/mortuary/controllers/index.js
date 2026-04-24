// Role-based controllers
const memberControllers = require('./member');
const treasurerControllers = require('./treasurer');

// Legacy controllers (for backward compatibility)
const dashboardController = require('./dashboardController');
const claimController = require('./claimController');
const contributionController = require('./contributionController');
const ledgerController = require('./ledgerController');
const paymentScheduleController = require('./paymentScheduleController');
const notificationController = require('./notificationController');

module.exports = {
  // Role-based exports
  member: memberControllers,
  treasurer: treasurerControllers,
  
  // Legacy exports (for backward compatibility)
  dashboardController,
  claimController,
  contributionController,
  ledgerController,
  paymentScheduleController,
  notificationController,
};
