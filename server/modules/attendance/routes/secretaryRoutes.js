const express = require('express');
const { 
  getAllMembers,
  getMemberById,
  uploadMembers,
  generateQRCodes,
  generateAllQRCodes
} = require('../controllers/memberController');

const { 
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent
} = require('../controllers/eventController');

const { 
  recordAttendance,
  getAttendanceByEvent,
  getAttendanceStats,
  generateReport,
  getAllAttendance
} = require('../controllers/attendanceController');

const router = express.Router();

// Event management routes (Secretary can manage events)
router.post('/events', createEvent);
router.get('/events', getAllEvents);
router.get('/events/:eventId', getEventById);
router.put('/events/:eventId', updateEvent);
router.delete('/events/:eventId', deleteEvent);

// Member management routes (Secretary can view members)
router.get('/members', getAllMembers);
router.get('/members/:memberId', getMemberById);
router.post('/members/generate-qr', generateQRCodes);

// Attendance management routes (Secretary can manage attendance)
router.post('/attendance/record', recordAttendance);
router.get('/attendance/event/:eventId', getAttendanceByEvent);
router.get('/attendance/stats/:eventId', getAttendanceStats);
router.post('/attendance/report', generateReport);
router.get('/attendance', getAllAttendance);

module.exports = router;