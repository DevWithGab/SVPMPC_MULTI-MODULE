const { authorizeRoles } = require('../../../middleware/auth');
const manageRecords = authorizeRoles('admin', 'super_admin', 'secretary');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { AppError } = require('../../../middleware/errorHandler');
const router = express.Router();

/* Pansamantalang naglalaman ang member CSV upload ng totoong member PII
bago ito i-parse at i-delete ng controller. Hindi dapat ito dumapo sa
uploads/ - yung whole tree na iyon ay served statically na walang auth
(server.js), kaya downloadable ng kung sino man yung guessable na
`${Date.now()}_name.csv` filename habang nandun ito. Sa labas ng
static-served tree nakatira ang tmp-uploads/. */
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

/* Legacy routes para sa backward compatibility (if needed) - puwede na
itong tanggalin once fully updated na ang frontend. */
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

/* Nilagay ito sa .env (10MB default) pero hindi naman talaga binabasa ng
server.js/multer configs - kung walang limit, bubuffer ng multer ang
upload ng kahit anong size papuntang disk bago pa man magkaroon ng chance
mag-reject ang fileFilter/controller. */
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
