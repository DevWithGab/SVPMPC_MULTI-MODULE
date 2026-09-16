const express = require('express');
const {
  authenticateToken,
  authorizeAdminOnly,
  authorizeRoles,
} = require('../../../middleware');

// Regenerating or deactivating a member's QR is more consequential than the
// rest of admin-only (it can lock a member out of scanning), so — unlike
// every other route on this router — it's restricted to the literal
// 'admin' role and does not extend to super_admin.
const authorizeAttendanceAdminOnly = authorizeRoles('admin');

// Import existing controllers
const memberController = require('../controllers/memberController');
const eventController = require('../controllers/eventController');
const attendanceController = require('../controllers/attendanceController');
const backupController = require('../controllers/backupController');

const router = express.Router();

// Apply authentication and authorization middleware to all routes
router.use(authenticateToken);
router.use(authorizeAdminOnly);

// Member management routes (admin has full access)
router.get('/members', memberController.getAllMembers);
// Was ':id' while the controller reads req.params.memberId — always 404'd.
router.get('/members/:memberId', memberController.getMemberById);

// Member QR management routes
router.post('/members/generate-qr', memberController.generateQRCodes);
router.post('/members/generate-all-qr', memberController.generateAllQRCodes);
router.get('/members/:memberId/qr-status', memberController.getQRStatus);
router.post('/members/:memberId/regenerate-qr', authorizeAttendanceAdminOnly, memberController.regenerateQRCode);
router.post('/members/:memberId/deactivate-qr', authorizeAttendanceAdminOnly, memberController.deactivateQRCode);
router.post('/members/:memberId/reactivate-qr', authorizeAttendanceAdminOnly, memberController.reactivateQRCode);

// Event management routes (admin has full access)
router.get('/events', eventController.getAllEvents);
router.post('/events', eventController.createEventAsAdmin);
router.get('/events/:eventId', eventController.getEventById);
router.put('/events/:eventId', eventController.updateEvent);
router.delete('/events/:eventId', eventController.deleteEvent);
router.post('/events/:eventId/approve', eventController.approveEvent);
router.post('/events/:eventId/reject', eventController.rejectEvent);
router.post('/events/:eventId/reopen', eventController.reopenEvent);

// Attendance management routes (admin has full access)
router.get('/attendance', attendanceController.getAllAttendance);
router.post('/attendance', attendanceController.recordAttendance);

// Database backup/restore — restore is a bulk write over live data, so it
// gets the same strict admin-only gate as the QR lifecycle actions above.
router.post('/backup/restore', authorizeAttendanceAdminOnly, backupController.restoreBackup);

module.exports = router;