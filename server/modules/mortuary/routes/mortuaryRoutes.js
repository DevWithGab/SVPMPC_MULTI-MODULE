const express = require('express');
const { authenticateToken, authorizeMortuaryRoles } = require('../../../middleware');
const router = express.Router();

// Temporarily remove auth for testing
// router.use(authenticateToken);
// router.use(authorizeMortuaryRoles);

// Import role-based routes
const treasurerRoutes = require('./treasurerRoutes');
const adminRoutes = require('./adminRoutes');

// Route organization by role
router.use('/treasurer', treasurerRoutes);
router.use('/admin', adminRoutes);

// Legacy routes for backward compatibility (if needed)
// These can be removed once frontend is fully updated
const dashboardController = require('../controllers/dashboardController');
const contributionController = require('../controllers/contributionController');
const ledgerController = require('../controllers/ledgerController');
const paymentScheduleController = require('../controllers/paymentScheduleController');
const notificationController = require('../controllers/notificationController');

// Legacy dashboard routes
router.get('/dashboard/:memberId', dashboardController.getDashboard);

// Legacy contribution routes
router.post('/contributions/record', contributionController.recordContribution);
router.get('/contributions/:memberId', contributionController.getContributionHistory);
router.get('/contributions', contributionController.getAllContributions);

// Legacy ledger routes
router.get('/ledger/:memberId', ledgerController.getMemberLedger);
router.get('/ledger', ledgerController.getAllLedger);
router.get('/balance/:memberId', ledgerController.getMemberBalance);

// Legacy payment schedule routes
router.post('/schedule/create', paymentScheduleController.createPaymentSchedule);
router.get('/schedule/:memberId', paymentScheduleController.getPaymentSchedule);
router.get('/schedule', paymentScheduleController.getAllPaymentSchedules);
router.get('/schedule/overdue', paymentScheduleController.getOverduePayments);
router.put('/schedule/:scheduleId/update-due', paymentScheduleController.updateNextDueDate);
router.put('/schedule/:scheduleId/reminder-sent', paymentScheduleController.markReminderSent);

// Legacy notification routes
router.post('/notifications/send-reminder', notificationController.sendReminderToMember);
router.post('/notifications/send-bulk-overdue', notificationController.sendBulkRemindersToOverdue);
router.post('/notifications/send-to-members', notificationController.sendRemindersToMembers);
router.get('/notifications/history/:memberId', notificationController.getReminderHistory);

module.exports = router;
