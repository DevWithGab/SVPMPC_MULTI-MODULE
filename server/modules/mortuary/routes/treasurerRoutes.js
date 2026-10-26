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
  listClaimFinancials,
  getClaimById,
  previewDeductionBatch,
  processDeductionBatch
} = require('../controllers/treasurerClaimController');

const { getCurrentRate, getRateHistory, updateRate } = require('../controllers/deductionSettingController');
const { getCurrentThresholds, getThresholdHistory, updateThresholds } = require('../controllers/noticeThresholdSettingController');
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
/* Current deduction rate - kailangan makita ng Treasurer yung amount na
sisingilin sa Process Deduction screen. Ine-edit ito sa Settings (sa baba). */
router.get('/deduction-rate', getCurrentRate);

/* Current balance notice thresholds - kailangan malaman ng Treasurer's Member
Ledger / Member Balances screens kung saan nag-kick in ang Notice 1/2/Final. */
router.get('/notice-thresholds', getCurrentThresholds);

/* Fund settings (deduction rate, notice thresholds/content) -
Treasurer na ang nagma-manage nito, hindi na si Admin. */
router.get('/settings/deduction-rate/current', getCurrentRate);
router.get('/settings/deduction-rate', getRateHistory);
router.post('/settings/deduction-rate', updateRate);
router.get('/settings/notice-thresholds/current', getCurrentThresholds);
router.get('/settings/notice-thresholds', getThresholdHistory);
router.post('/settings/notice-thresholds', updateThresholds);

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

// Claims processing routes — a claim sitting in "pending_deduction" is the
// Treasurer's notification (live query, no separate notification model).
router.get('/claims', listAllClaims);
router.get('/claims/pending-deduction', listPendingDeduction);
/* Yung literal paths sa taas dapat mauna bago yung '/claims/:claimId' param
route sa baba, kung hindi, maaaring i-match ni Express as claimId yung
"income-report". */
router.get('/claims/income-report', listClaimFinancials);
/* Batch deduction - pinipili ng Treasurer ang maraming pending claim (hal. lahat ng
death claim ng buwan) at isang beses lang sisingilin ang bawat member, iisang JV. */
router.post('/claims/deduction-batch/preview', previewDeductionBatch);
router.post('/claims/deduction-batch', processDeductionBatch);
router.get('/claims/:claimId', getClaimById);

module.exports = router;
