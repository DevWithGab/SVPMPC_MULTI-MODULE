const express = require('express');
const {
  authenticateToken,
  authorizeTreasurerOnly,
  authorizeMortuaryRoles,
  authorizeClaimsOnly,
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
  listDeductionSummary,
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
router.use(authorizeMortuaryRoles);

// Dashboard routes (Treasurer can view fund overview)
router.get('/dashboard', authorizeTreasurerOnly, getTreasurerDashboard);

// Contribution management routes (Treasurer can manage all contributions)
router.post('/contributions/record', authorizeTreasurerOnly, recordContribution);
router.post('/contributions/bulk-upload', authorizeTreasurerOnly, bulkUploadLimiter, bulkUploadPayments);
router.get('/contributions/:memberId', authorizeTreasurerOnly, getContributionHistory);
router.get('/contributions', authorizeTreasurerOnly, getAllContributions);

// Member balance management routes
/* Current deduction rate - kailangan makita ng Treasurer yung amount na
sisingilin sa Process Deduction screen. Ine-edit ito sa Settings (sa baba). */
router.get('/deduction-rate', authorizeTreasurerOnly, getCurrentRate);

/* Current balance notice thresholds - kailangan malaman ng Treasurer's Member
Ledger / Member Balances screens kung saan nag-kick in ang Notice 1/2/Final. */
router.get('/notice-thresholds', getCurrentThresholds);

/* Fund settings (deduction rate, notice thresholds/content) -
Treasurer na ang nagma-manage nito, hindi na si Admin. */
router.get('/settings/deduction-rate/current', authorizeTreasurerOnly, getCurrentRate);
router.get('/settings/deduction-rate', authorizeTreasurerOnly, getRateHistory);
router.post('/settings/deduction-rate', authorizeTreasurerOnly, updateRate);
router.get('/settings/notice-thresholds/current', authorizeTreasurerOnly, getCurrentThresholds);
router.get('/settings/notice-thresholds', authorizeTreasurerOnly, getThresholdHistory);
router.post('/settings/notice-thresholds', authorizeTreasurerOnly, updateThresholds);

router.get('/balances/all', getAllMemberBalances);
router.post('/balances/automatic-deduction', authorizeTreasurerOnly, processAutomaticDeduction);
router.get('/balances/low-balance-check', authorizeTreasurerOnly, checkLowBalanceMembers);

/* Background PDF generation para sa notice batches na masyado nang malaki
para komportableng buuin sa browser (tingnan ang LARGE_BATCH_THRESHOLD sa
MemberBalances.jsx). */
router.post('/notices/:level/batch', authorizeTreasurerOnly, startNoticeBatch);
router.get('/notices/batch/:jobId', authorizeTreasurerOnly, getNoticeBatchStatus);
router.get('/notices/batch/:jobId/download', authorizeTreasurerOnly, downloadNoticeBatch);

// Ledger management routes
router.get('/ledger', getAllLedger);
router.get('/ledger/daily-summary', require('../controllers/dailyLedgerSummaryController').getDailyLedgerSummary);
router.get('/ledger/:memberId', getMemberLedger);
router.get('/balance/:memberId', authorizeTreasurerOnly, getMemberBalance);
router.post('/ledger/bulk-upload', authorizeClaimsOnly, bulkUploadLimiter, bulkUploadLedger);
router.post('/ledger/:memberId/entries/:ledgerId/correct', authorizeTreasurerOnly, require('../controllers/ledgerController').correctLedgerEntry);

// Claims processing routes — a claim sitting in "pending_deduction" is the
// Treasurer's notification (live query, no separate notification model).
router.get('/claims', listAllClaims);
router.get('/claims/pending-deduction', authorizeTreasurerOnly, listPendingDeduction);
/* Yung literal paths sa taas dapat mauna bago yung '/claims/:claimId' param
route sa baba, kung hindi, maaaring i-match ni Express as claimId yung
"deduction-summary". */
router.get('/claims/deduction-summary', authorizeTreasurerOnly, listDeductionSummary);
/* Batch deduction - pinipili ng Treasurer ang maraming pending claim (hal. lahat ng
death claim ng buwan) at isang beses lang sisingilin ang bawat member, iisang JV. */
router.post('/claims/deduction-batch/preview', authorizeTreasurerOnly, previewDeductionBatch);
router.post('/claims/deduction-batch', authorizeTreasurerOnly, processDeductionBatch);
router.get('/claims/:claimId', authorizeTreasurerOnly, getClaimById);

module.exports = router;
