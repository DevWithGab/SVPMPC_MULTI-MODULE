const express = require('express');
const {
  authenticateToken,
  authorizeClaimsOnly,
  authorizeRoles,
  bulkUploadLimiter
} = require('../../../middleware');

// Import existing controllers
const dashboardController = require('../controllers/dashboardController');
const contributionController = require('../controllers/contributionController');
const ledgerController = require('../controllers/ledgerController');
const adminController = require('../controllers/adminController');
const claimController = require('../controllers/claimController');
const beneficiaryController = require('../controllers/beneficiaryController');
const backupController = require('../controllers/backupController');

const router = express.Router();

// All admin operations require administrator access.
router.use(authenticateToken);
router.use(authorizeClaimsOnly);
const superAdminOnly = authorizeRoles('super_admin');

// Dashboard routes
router.get('/dashboard', dashboardController.getAdminDashboard);
// Read-only context for the Claims Officer dashboard.
router.get('/fund-overview', dashboardController.getTreasurerDashboard);
router.get('/balances', require('../controllers/deductionController').getAllMemberBalances);

// Member management routes (admin only)
router.get('/members', adminController.getAllMembers);
/* Ang claims officer (at admin/super admin) ay puwedeng mag-add ng member mula sa
Mortuary. Parehong logic ng Super Admin registration ang ginagamit, kaya ang bagong
member ay naka-enroll din sa Attendance (shared Member record, parehong modules). */
router.post('/members/create', require('../../../shared/controllers/adminController').createMember);
router.post('/members/bulk-create', superAdminOnly, bulkUploadLimiter, adminController.bulkCreateMembers);
router.put('/members/:memberId', superAdminOnly, adminController.updateMember);
router.delete('/members/:memberId', superAdminOnly, adminController.deleteMember);

// Contribution management routes (admin has full access)
router.get('/contributions', contributionController.getAllContributions);
router.post('/contributions', superAdminOnly, contributionController.recordContribution);

// Ledger management routes
router.get('/ledger', superAdminOnly, ledgerController.getAllLedger);
router.get('/ledger/:memberId', superAdminOnly, ledgerController.getMemberLedger);

// Claims management routes
router.post('/claims', authenticateToken, authorizeClaimsOnly, claimController.createClaim);
router.get('/claims', authenticateToken, authorizeClaimsOnly, claimController.getAllClaims);
router.get('/claims/:claimId', authenticateToken, authorizeClaimsOnly, claimController.getClaimById);
router.post('/claims/:claimId/requirements', authenticateToken, authorizeClaimsOnly, claimController.addRequirement);
router.put('/claims/:claimId/requirements', authenticateToken, authorizeClaimsOnly, claimController.updateRequirements);
router.delete('/claims/:claimId/requirements/:requirementKey', authenticateToken, authorizeClaimsOnly, claimController.removeRequirement);
router.put('/claims/:claimId/verification', authenticateToken, authorizeClaimsOnly, claimController.updateVerification);
router.put('/claims/:claimId/approve', authenticateToken, authorizeClaimsOnly, claimController.approveClaim);
router.put('/claims/:claimId/reject', authenticateToken, authorizeClaimsOnly, claimController.rejectClaim);

// Beneficiaries routes
router.get('/beneficiaries', authenticateToken, authorizeClaimsOnly, beneficiaryController.getAllBeneficiaries);
router.post('/beneficiaries/bulk-upload', authenticateToken, authorizeClaimsOnly, bulkUploadLimiter, beneficiaryController.bulkUploadBeneficiaries);
router.get('/beneficiaries/:memberId/history', authenticateToken, authorizeClaimsOnly, beneficiaryController.getBeneficiaryHistory);
router.put('/beneficiaries/:memberId', authenticateToken, authorizeClaimsOnly, beneficiaryController.updateBeneficiary);

/* Database backup/restore - yung restore ay bulk write sa live data, kaya
same explicit auth din ang ginagamit nito kagaya ng ibang consequential
routes sa taas. */
router.get('/backup/export', authenticateToken, superAdminOnly, backupController.getFullBackup);
router.get('/backup/ledger', authenticateToken, superAdminOnly, backupController.getLedgerExport);
router.post('/backup/restore', authenticateToken, superAdminOnly, backupController.restoreBackup);

module.exports = router;