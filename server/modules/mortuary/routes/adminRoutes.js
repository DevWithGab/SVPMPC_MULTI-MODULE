const express = require('express');
const { 
  authenticateToken, 
  authorizeAdminOnly
} = require('../../../middleware');

// Import existing controllers
const dashboardController = require('../controllers/dashboardController');
const claimController = require('../controllers/claimController');
const contributionController = require('../controllers/contributionController');
const ledgerController = require('../controllers/ledgerController');
const paymentScheduleController = require('../controllers/paymentScheduleController');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

// Apply authentication and authorization middleware to all routes
router.use(authenticateToken);
router.use(authorizeAdminOnly);

// Dashboard routes
router.get('/dashboard', dashboardController.getDashboard);

// Contribution management routes (admin has full access)
router.get('/contributions', contributionController.getAllContributions);
router.post('/contributions', contributionController.recordContribution);

// Claim management routes (admin has full access)
router.get('/claims/:memberId', claimController.getClaimHistory);
router.get('/claims/detail/:claimId', claimController.getClaimById);
router.put('/claims/:claimId/approve', claimController.approveClaim);
router.put('/claims/:claimId/reject', claimController.rejectClaim);

// Ledger management routes
router.get('/ledger', ledgerController.getAllLedger);
router.get('/ledger/:memberId', ledgerController.getMemberLedger);

// Payment schedule routes
router.get('/schedule', paymentScheduleController.getAllPaymentSchedules);
router.post('/schedule/create', paymentScheduleController.createPaymentSchedule);

// Notification routes (admin can send to all)
router.post('/notifications/send-to-members', notificationController.sendRemindersToMembers);

module.exports = router;