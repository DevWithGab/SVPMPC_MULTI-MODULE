const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();

// Import role-based routes
const memberRoutes = require('./memberRoutes');
const secretaryRoutes = require('./secretaryRoutes');
const adminRoutes = require('./adminRoutes');

// Route organization by role
router.use('/member', memberRoutes);
router.use('/secretary', secretaryRoutes);
router.use('/admin', adminRoutes);

// Legacy routes for backward compatibility (if needed)
// These can be removed once frontend is fully updated
const memberController = require('../controllers/memberController');
const eventController = require('../controllers/eventController');
const attendanceController = require('../controllers/attendanceController');
const memberAuthController = require('../controllers/memberAuthController');

// Configure multer for CSV uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../..', 'uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// Legacy member routes
router.post('/members/upload', upload.single('file'), memberController.uploadMembers);
router.post('/members/generate-qr', memberController.generateQRCodes);
router.post('/members/generate-all-qr', memberController.generateAllQRCodes);
router.get('/members', memberController.getAllMembers);
router.get('/members/:memberId', memberController.getMemberById);

// Legacy member portal routes
router.get('/member-portal/:memberId/profile', memberAuthController.getMemberProfile);
router.get('/member-portal/:memberId/attendance-history', memberAuthController.getMemberAttendanceHistory);

// Legacy event routes
router.post('/events', eventController.createEvent);
router.get('/events', eventController.getAllEvents);
router.get('/events/:eventId', eventController.getEventById);
router.put('/events/:eventId', eventController.updateEvent);
router.delete('/events/:eventId', eventController.deleteEvent);

// Legacy attendance routes
router.post('/attendance/record', attendanceController.recordAttendance);
router.get('/attendance/event/:eventId', attendanceController.getAttendanceByEvent);
router.get('/attendance/stats/:eventId', attendanceController.getAttendanceStats);
router.post('/attendance/report', attendanceController.generateReport);
router.get('/attendance', attendanceController.getAllAttendance);

module.exports = router;
