const express = require('express');
const {
  authenticateToken,

  authorizeRoles,
} = require('../../../middleware');

const authorizeAttendanceManager = authorizeRoles('secretary', 'super_admin');

// Import existing controllers
const memberController = require('../controllers/memberController');
const eventController = require('../controllers/eventController');
const attendanceController = require('../controllers/attendanceController');
const backupController = require('../controllers/backupController');

const router = express.Router();

// Apply authentication and authorization middleware to all routes
router.use(authenticateToken);
router.use(authorizeAttendanceManager);

// Secretary member management
router.get('/members', memberController.getAllMembers);
// Was ':id' while the controller reads req.params.memberId — always 404'd.
router.get('/members/:memberId', memberController.getMemberById);

// Member QR management routes
router.post('/members/generate-qr', memberController.generateQRCodes);
router.post('/members/generate-all-qr', memberController.generateAllQRCodes);
router.get('/members/:memberId/qr-status', memberController.getQRStatus);
router.post('/members/:memberId/regenerate-qr', authorizeAttendanceManager, memberController.regenerateQRCode);
router.post('/members/:memberId/deactivate-qr', authorizeAttendanceManager, memberController.deactivateQRCode);
router.post('/members/:memberId/reactivate-qr', authorizeAttendanceManager, memberController.reactivateQRCode);

// Secretary event management
router.get('/events', eventController.getAllEvents);
router.post('/events', eventController.createEventAsAdmin);
router.get('/events/:eventId', eventController.getEventById);
router.put('/events/:eventId', eventController.updateEvent);
router.delete('/events/:eventId', eventController.deleteEvent);
router.post('/events/:eventId/reopen', eventController.reopenEvent);

// Secretary attendance management
router.get('/attendance', attendanceController.getAllAttendance);
router.post('/attendance', attendanceController.recordAttendance);

// Attendance backups and restores are managed exclusively by Super Admin.
router.get('/backup/export', authorizeRoles('super_admin'), backupController.getFullBackup);
router.post('/backup/restore', authorizeRoles('super_admin'), backupController.restoreBackup);

module.exports = router;