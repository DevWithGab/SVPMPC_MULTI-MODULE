const express = require('express');
const router = express.Router();
const { authorizeTreasurerOnly } = require('../../../middleware/auth');

// Authentication, password change, and module access are enforced by server.js.

// Import role-based routes
const treasurerRoutes = require('./treasurerRoutes');
const adminRoutes = require('./adminRoutes');

// Route organization by role
router.use('/treasurer', treasurerRoutes);
router.use('/admin', adminRoutes);

/* Legacy routes lang ito para sa backward compatibility (kung kailangan) -
puwede na itong tanggalin pag fully updated na ang frontend. */
const dashboardController = require('../controllers/dashboardController');
const contributionController = require('../controllers/contributionController');
const ledgerController = require('../controllers/ledgerController');

// Legacy dashboard routes
router.get('/dashboard/:memberId', dashboardController.getDashboard);

// Legacy contribution routes
router.post('/contributions/record', authorizeTreasurerOnly, contributionController.recordContribution);
router.get('/contributions/:memberId', contributionController.getContributionHistory);
router.get('/contributions', contributionController.getAllContributions);

// Legacy ledger routes
router.get('/ledger/:memberId', authorizeTreasurerOnly, ledgerController.getMemberLedger);
router.get('/ledger', authorizeTreasurerOnly, ledgerController.getAllLedger);
router.get('/balance/:memberId', authorizeTreasurerOnly, ledgerController.getMemberBalance);

module.exports = router;
