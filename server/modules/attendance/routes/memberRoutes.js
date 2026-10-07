const { authorizeRoles } = require('../../../middleware/auth');
const manageRecords = authorizeRoles('admin', 'super_admin', 'secretary');
const express = require('express');
const { 
  getAllMembers,
  getMemberById,
  uploadMembers,
  generateQRCodes,
  generateAllQRCodes
} = require('../controllers/memberController');

const { 
  recordAttendance,
  getAttendanceByEvent,
  getAttendanceStats,
  generateReport,
  getAllAttendance
} = require('../controllers/attendanceController');

const { 
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent
} = require('../controllers/eventController');

const router = express.Router();

// Member routes
router.get('/members', getAllMembers);
router.get('/members/:memberId', getMemberById);
router.post('/members/upload', manageRecords, uploadMembers);
router.post('/members/generate-qr', manageRecords, generateQRCodes);
router.post('/members/generate-all-qr', manageRecords, generateAllQRCodes);

// Event routes
router.post('/events', manageRecords, createEvent);
router.get('/events', getAllEvents);
router.get('/events/:eventId', getEventById);
router.put('/events/:eventId', manageRecords, updateEvent);
router.delete('/events/:eventId', authorizeRoles('admin', 'super_admin'), deleteEvent);

// Attendance routes
router.post('/attendance/record', recordAttendance);
router.get('/attendance/event/:eventId', getAttendanceByEvent);
router.get('/attendance/stats/:eventId', getAttendanceStats);
router.post('/attendance/report', generateReport);
router.get('/attendance', getAllAttendance);

module.exports = router;