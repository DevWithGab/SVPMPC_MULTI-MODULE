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
router.post('/members/upload', uploadMembers);
router.post('/members/generate-qr', generateQRCodes);
router.post('/members/generate-all-qr', generateAllQRCodes);

// Event routes
router.post('/events', createEvent);
router.get('/events', getAllEvents);
router.get('/events/:eventId', getEventById);
router.put('/events/:eventId', updateEvent);
router.delete('/events/:eventId', deleteEvent);

// Attendance routes
router.post('/attendance/record', recordAttendance);
router.get('/attendance/event/:eventId', getAttendanceByEvent);
router.get('/attendance/stats/:eventId', getAttendanceStats);
router.post('/attendance/report', generateReport);
router.get('/attendance', getAllAttendance);

module.exports = router;