const { authorizeRoles } = require('../../../middleware/auth');
const manageRecords = authorizeRoles('admin', 'super_admin', 'secretary');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { AppError } = require('../../../middleware/errorHandler');
const router = express.Router();

// A member CSV upload briefly contains real member PII before the controller
// parses it and deletes it. It must never land under uploads/ — that whole
// tree is served statically with no auth (server.js), so a guessable
// `${Date.now()}_name.csv` filename there would be downloadable by anyone
// during that window. tmp-uploads/ sits outside the static-served tree.
const CSV_UPLOAD_DIR = path.join(__dirname, '../../..', 'tmp-uploads');
if (!fs.existsSync(CSV_UPLOAD_DIR)) {
  fs.mkdirSync(CSV_UPLOAD_DIR, { recursive: true });
}

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

// Configure multer for CSV uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, CSV_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  },
});

// .env documents this (10MB default) but server.js/the multer configs never
// actually read it — without a limit, multer buffers an upload of any size
// to disk before fileFilter/the controller ever get a chance to reject it.
const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024;

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new AppError('Only CSV files are allowed', 400));
    }
  },
});

// Legacy member routes
router.post('/members/upload', manageRecords, upload.single('file'), memberController.uploadMembers);
router.post('/members/generate-qr', manageRecords, memberController.generateQRCodes);
router.post('/members/generate-all-qr', manageRecords, memberController.generateAllQRCodes);
router.get('/members', memberController.getAllMembers);
router.get('/members/:memberId', memberController.getMemberById);

// Legacy event routes
router.post('/events', manageRecords, eventController.createEvent);
router.get('/events', eventController.getAllEvents);
router.get('/events/:eventId', eventController.getEventById);
router.put('/events/:eventId', manageRecords, eventController.updateEvent);
router.delete('/events/:eventId', authorizeRoles('admin', 'super_admin'), eventController.deleteEvent);

// Legacy attendance routes
router.post('/attendance/record', attendanceController.recordAttendance);
router.get('/attendance/event/:eventId', attendanceController.getAttendanceByEvent);
router.get('/attendance/stats/:eventId', attendanceController.getAttendanceStats);
router.post('/attendance/report', attendanceController.generateReport);
router.get('/attendance', attendanceController.getAllAttendance);

module.exports = router;
