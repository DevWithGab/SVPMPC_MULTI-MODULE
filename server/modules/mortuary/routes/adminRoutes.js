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
const claimController = require('../controllers/claimController');
const beneficiaryController = require('../controllers/beneficiaryController');
const deductionSettingController = require('../controllers/deductionSettingController');
const noticeThresholdSettingController = require('../controllers/noticeThresholdSettingController');
const benefitCapSettingController = require('../controllers/benefitCapSettingController');
const backupController = require('../controllers/backupController');

const router = express.Router();

// Temporarily remove auth for testing
// router.use(authenticateToken);
// router.use(authorizeAdminOnly);

// Dashboard routes
router.get('/dashboard', dashboardController.getAdminDashboard);

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

// Claims management routes — auth enforced per-route (the router-level
// auth above is left commented out to avoid touching the existing,
// untested-open routes above; these new routes are guarded explicitly).
router.post('/claims', authenticateToken, authorizeAdminOnly, claimController.createClaim);
router.get('/claims', authenticateToken, authorizeAdminOnly, claimController.getAllClaims);
router.get('/claims/:claimId', authenticateToken, authorizeAdminOnly, claimController.getClaimById);
router.post('/claims/:claimId/requirements', authenticateToken, authorizeAdminOnly, claimController.addRequirement);
router.put('/claims/:claimId/requirements', authenticateToken, authorizeAdminOnly, claimController.updateRequirements);
router.put('/claims/:claimId/verification', authenticateToken, authorizeAdminOnly, claimController.updateVerification);
router.put('/claims/:claimId/approve', authenticateToken, authorizeAdminOnly, claimController.approveClaim);
router.put('/claims/:claimId/reject', authenticateToken, authorizeAdminOnly, claimController.rejectClaim);

// Beneficiaries routes
router.get('/beneficiaries', authenticateToken, authorizeAdminOnly, beneficiaryController.getAllBeneficiaries);
router.get('/beneficiaries/:memberId/history', authenticateToken, authorizeAdminOnly, beneficiaryController.getBeneficiaryHistory);
router.put('/beneficiaries/:memberId', authenticateToken, authorizeAdminOnly, beneficiaryController.updateBeneficiary);

// Deduction settings routes
router.get('/deduction-settings/current', authenticateToken, authorizeAdminOnly, deductionSettingController.getCurrentRate);
router.get('/deduction-settings', authenticateToken, authorizeAdminOnly, deductionSettingController.getRateHistory);
router.post('/deduction-settings', authenticateToken, authorizeAdminOnly, deductionSettingController.updateRate);

// Balance notice threshold routes
router.get('/notice-thresholds/current', authenticateToken, authorizeAdminOnly, noticeThresholdSettingController.getCurrentThresholds);
router.get('/notice-thresholds', authenticateToken, authorizeAdminOnly, noticeThresholdSettingController.getThresholdHistory);
router.post('/notice-thresholds', authenticateToken, authorizeAdminOnly, noticeThresholdSettingController.updateThresholds);

// Death benefit cap — the maximum payout released per claim (anything
// collected above it is retained as cooperative income).
router.get('/benefit-cap/current', authenticateToken, authorizeAdminOnly, benefitCapSettingController.getCurrentCap);
router.get('/benefit-cap', authenticateToken, authorizeAdminOnly, benefitCapSettingController.getCapHistory);
router.post('/benefit-cap', authenticateToken, authorizeAdminOnly, benefitCapSettingController.updateCap);

// Database backup/restore — restore is a bulk write over live data, so it
// gets the same explicit auth as the other consequential routes above.
router.get('/backup/ledger', authenticateToken, authorizeAdminOnly, backupController.getLedgerExport);
router.post('/backup/restore', authenticateToken, authorizeAdminOnly, backupController.restoreBackup);

module.exports = router;