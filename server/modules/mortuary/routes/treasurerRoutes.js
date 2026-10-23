const express = require('express');
const {
  authenticateToken,
  authorizeTreasurerOnly,
  bulkUploadLimiter
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
  checkLowBalanceMembers
} = require('../controllers/deductionController');

const { 
  getMemberLedger,
  getAllLedger,
  getMemberBalance,
  bulkUploadLedger
} = require('../controllers/ledgerController');

const {
  listAllClaims,
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
const { getCurrentThresholds } = require('../controllers/noticeThresholdSettingController');
const { getCurrentCap } = require('../controllers/benefitCapSettingController');
const { startNoticeBatch, getNoticeBatchStatus, downloadNoticeBatch } = require('../controllers/noticeBatchController');

const router = express.Router();
const { bulkUploadPayments } = require('../controllers/paymentImportController');

// Apply authentication and authorization middleware to all routes
router.use(authenticateToken);
router.use(authorizeTreasurerOnly);

// Dashboard routes (Treasurer can view fund overview)
router.get('/dashboard', getTreasurerDashboard);

// Contribution management routes (Treasurer can manage all contributions)
router.post('/contributions/record', recordContribution);
router.post('/contributions/bulk-upload', bulkUploadLimiter, bulkUploadPayments);
router.get('/contributions/:memberId', getContributionHistory);
router.get('/contributions', getAllContributions);

// Member balance management routes
/* Read-only view lang ito ng Admin-set deduction rate. Si Admin lang ang
makaka-change nito (POST ay nasa admin router) - kailangan lang makita ng
Treasurer yung amount na sisingilin sa Process Deduction screen. */
router.get('/deduction-rate', getCurrentRate);

/* Read-only view lang ito ng Admin-set death benefit cap. Si Admin lang ang
makaka-change nito (POST ay nasa admin router) - ipinapakita ito sa
Treasurer's Claims Awaiting Release / Income Report screens kasama yung
resolved payout, na echo na rin naman ng claim routes sa baba per-response. */
router.get('/benefit-cap', getCurrentCap);

/* Read-only view lang ito ng Admin-set balance notice thresholds. Si Admin
lang ang makaka-change nito (POST ay nasa admin router) - kailangan lang
malaman ng Treasurer's Member Ledger / Member Balances screens kung saan
nag-kick in ang Notice 1/2/Final para parehas ang classification ng members
base sa settings ng Admin. */
router.get('/notice-thresholds', getCurrentThresholds);

router.get('/balances/all', getAllMemberBalances);
router.post('/balances/automatic-deduction', processAutomaticDeduction);
router.get('/balances/low-balance-check', checkLowBalanceMembers);

/* Background PDF generation para sa notice batches na masyado nang malaki
para komportableng buuin sa browser (tingnan ang LARGE_BATCH_THRESHOLD sa
MemberBalances.jsx). */
router.post('/notices/:level/batch', startNoticeBatch);
router.get('/notices/batch/:jobId', getNoticeBatchStatus);
router.get('/notices/batch/:jobId/download', downloadNoticeBatch);

// Ledger management routes
router.get('/ledger', getAllLedger);
router.get('/ledger/:memberId', getMemberLedger);
router.get('/balance/:memberId', getMemberBalance);
router.post('/ledger/bulk-upload', bulkUploadLimiter, bulkUploadLedger);

<<<<<<< Updated upstream
// Claims processing routes — a claim sitting in "pending_deduction" is the
// Treasurer's notification (live query, no separate notification model).
=======
// Read-only historical notification records; no send or retry endpoints.
router.get('/notifications/history/:memberId', getMemberNotificationHistory);
router.get('/notifications/all', getAllNotifications);
router.get('/notifications/pending', getPending);
router.get('/notifications/stats', getNotificationStats);

/* Claims processing routes - yung claim na naka-"pending_deduction" status
ang pumapalit na notification para sa Treasurer (live query lang, walang
separate notification model). */
>>>>>>> Stashed changes
router.get('/claims', listAllClaims);
router.get('/claims/pending-deduction', listPendingDeduction);
router.get('/claims/awaiting-release', listAwaitingRelease);
/* Yung literal paths sa taas dapat mauna bago yung '/claims/:claimId' param
route sa baba, kung hindi, maaaring i-match ni Express as claimId yung
"disbursement-report" at iba pa. */
router.get('/claims/disbursement-report', listReleasedClaims);
router.get('/claims/income-report', listClaimFinancials);
router.get('/claims/:claimId', getClaimById);
router.get('/claims/:claimId/deduction-preview', previewClaimDeduction);
router.post('/claims/:claimId/process-deduction', processClaimDeduction);
router.post('/claims/:claimId/release', releaseClaim);

module.exports = router;
