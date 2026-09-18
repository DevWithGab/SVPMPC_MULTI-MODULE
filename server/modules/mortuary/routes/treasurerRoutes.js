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

const {
  getMemberNotificationHistory,
  getAllNotifications,
  getPending,
  retryFailed,
  getNotificationStats
} = require('../controllers/smsNotificationController');

const {
  listPendingDeduction,
  listAwaitingRelease,
  listReleasedClaims,
  listClaimFinancials,
  getClaimById,
  processClaimDeduction,
  previewClaimDeduction,
  releaseClaim
} = require('../controllers/treasurerClaimController');

const { getCurrentRate } = require('../controllers/deductionSettingController');

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
// Read-only view of the Admin-set deduction rate. Only the Admin can change it
// (POST lives on the admin router) — the Treasurer just needs to see the amount
// its Process Deduction screen is about to charge.
router.get('/deduction-rate', getCurrentRate);

router.get('/balances/all', getAllMemberBalances);
router.post('/balances/automatic-deduction', processAutomaticDeduction);
router.get('/balances/low-balance-check', checkLowBalanceMembers);
router.post('/balances/send-low-balance-notifications', sendLowBalanceNotifications);

// Ledger management routes
router.get('/ledger', getAllLedger);
router.get('/ledger/:memberId', getMemberLedger);
router.get('/balance/:memberId', getMemberBalance);
router.post('/ledger/bulk-upload', bulkUploadLedger);

// SMS notification history and stats (automatic threshold notifications)
router.get('/notifications/history/:memberId', getMemberNotificationHistory);
router.get('/notifications/all', getAllNotifications);
router.get('/notifications/pending', getPending);
router.post('/notifications/retry-failed', retryFailed);
router.get('/notifications/stats', getNotificationStats);

// Claims processing routes — a claim sitting in "pending_deduction" is the
// Treasurer's notification (live query, no separate notification model).
router.get('/claims/pending-deduction', listPendingDeduction);
router.get('/claims/awaiting-release', listAwaitingRelease);
// Literal paths above must stay ahead of the '/claims/:claimId' param route
// below, or Express would match them as a claimId of "disbursement-report" etc.
router.get('/claims/disbursement-report', listReleasedClaims);
router.get('/claims/income-report', listClaimFinancials);
router.get('/claims/:claimId', getClaimById);
router.get('/claims/:claimId/deduction-preview', previewClaimDeduction);
router.post('/claims/:claimId/process-deduction', processClaimDeduction);
router.post('/claims/:claimId/release', releaseClaim);

module.exports = router;