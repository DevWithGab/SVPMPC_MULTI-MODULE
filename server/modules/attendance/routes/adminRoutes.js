const express = require('express');
const { 
  authenticateToken, 
  authorizeAdminOnly
} = require('../../../middleware');

// Import existing controllers
const memberController = require('../controllers/memberController');
const eventController = require('../controllers/eventController');
const attendanceController = require('../controllers/attendanceController');
const memberAuthController = require('../controllers/memberAuthController');

const router = express.Router();

// Apply authentication and authorization middleware to all routes
router.use(authenticateToken);
router.use(authorizeAdminOnly);

// Member management routes (admin has full access)
router.get('/members', memberController.getAllMembers);
router.get('/members/:id', memberController.getMemberById);

// Event management routes (admin has full access)
router.get('/events', eventController.getAllEvents);
router.post('/events', eventController.createEvent);
router.get('/events/:eventId', eventController.getEventById);
router.put('/events/:eventId', eventController.updateEvent);
router.delete('/events/:eventId', eventController.deleteEvent);

// Attendance management routes (admin has full access)
router.get('/attendance', attendanceController.getAllAttendance);
router.post('/attendance', attendanceController.recordAttendance);


module.exports = router;