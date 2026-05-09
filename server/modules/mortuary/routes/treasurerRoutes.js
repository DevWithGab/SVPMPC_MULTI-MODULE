const express = require('express');
const { 
  authenticateToken, 
  authorizeTreasurerOnly
} = require('../../../middleware');

const { 
  recordContribution,
  getContributionHistory,
  getAllContributions
} = require('../controllers/contributionController');

const { 
  getDashboard,
  getTreasurerDashboard
} = require('../controllers/dashboardController');

const { 
  getAllMemberBalances,
  processAutomaticDeduction,
  checkLowBalanceMembers,
  sendLowBalanceNotifications
} = require('../controllers/deductionController');

const { 
  getMemberLedger,
  getAllLedger,
  getMemberBalance,
  bulkUploadLedger
} = require('../controllers/ledgerController');

const router = express.Router();

// Apply authentication and authorization middleware to all routes
router.use(authenticateToken);
router.use(authorizeTreasurerOnly);

// Dashboard routes (Treasurer can view fund overview)
router.get('/dashboard', getTreasurerDashboard);

// Contribution management routes (Treasurer can manage all contributions)
router.post('/contributions/record', recordContribution);
router.get('/contributions/:memberId', getContributionHistory);
router.get('/contributions', getAllContributions);

// Member balance management routes
router.get('/balances/all', getAllMemberBalances);
router.post('/balances/automatic-deduction', processAutomaticDeduction);
router.get('/balances/low-balance-check', checkLowBalanceMembers);
router.post('/balances/send-low-balance-notifications', sendLowBalanceNotifications);

// Ledger management routes
router.get('/ledger', getAllLedger);
router.get('/ledger/:memberId', getMemberLedger);
router.get('/balance/:memberId', getMemberBalance);
router.post('/ledger/bulk-upload', bulkUploadLedger);

module.exports = router;