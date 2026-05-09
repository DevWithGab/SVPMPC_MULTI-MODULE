const express = require('express');
const { 
  authenticateToken, 
  authorizeAdminOnly
} = require('../../../middleware');

// Import existing controllers
const dashboardController = require('../controllers/dashboardController');
const contributionController = require('../controllers/contributionController');
const ledgerController = require('../controllers/ledgerController');
const adminController = require('../controllers/adminController');
const payoutController = require('../controllers/payoutController');

const router = express.Router();

// Temporarily remove auth for testing
// router.use(authenticateToken);
// router.use(authorizeAdminOnly);

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

// Ledger management routes
router.get('/ledger', ledgerController.getAllLedger);
router.get('/ledger/:memberId', ledgerController.getMemberLedger);

module.exports = router;