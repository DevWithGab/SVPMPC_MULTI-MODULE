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
const adminController = require('../controllers/adminController');
const payoutController = require('../controllers/payoutController');

const router = express.Router();

// Apply authentication and authorization middleware to all routes
router.use(authenticateToken);
router.use(authorizeAdminOnly);

// Dashboard routes
router.get('/dashboard', dashboardController.getDashboard);

// Member management routes (admin only)
router.get('/members', adminController.getAllMembers);
router.post('/members/create', adminController.createMember);
router.post('/members/bulk-create', adminController.bulkCreateMembers);
router.put('/members/:memberId', adminController.updateMember);
router.delete('/members/:memberId', adminController.deleteMember);

// Contribution management routes (admin has full access)
router.get('/contributions', contributionController.getAllContributions);
router.post('/contributions', contributionController.recordContribution);

// Payout management routes (admin only)
router.get('/payouts', payoutController.getAllPayouts);
router.post('/payouts', payoutController.recordPayout);
router.get('/payouts/:payoutId', payoutController.getPayoutById);

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