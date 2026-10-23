const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { AppError } = require('../../middleware/errorHandler');
const authController = require('../controllers/authController');
const { getCommunityStats } = require('../controllers/communityController');
const bulkImportController = require('../controllers/bulkImportController');
const { loginIpLimiter, loginLimiter, changePasswordLimiter, bulkUploadLimiter } = require('../../middleware');

const { authenticateToken, requirePasswordChange, authorizeAdminOnly } = require('../../middleware/auth');
const ownAccount = (req, res, next) => req.params.userId === req.user.userId ? next() : res.status(403).json({ message: 'Access denied' });
const router = express.Router();

/* Pansamantalang naglalaman ng totoong member PII yung bulk-import CSV bago
ito parse-in at i-delete ng controller. Hindi dapat ito dumapo sa ilalim ng
uploads/ - static ang buong tree na iyon na walang auth (server.js), kaya
yung guessable na `${Date.now()}_name.csv` filename puwede i-download ng
kahit sino habang nandun pa ito. Nasa labas ng static-served tree ang
tmp-uploads/. */
const CSV_UPLOAD_DIR = path.join(__dirname, '../..', 'tmp-uploads');
if (!fs.existsSync(CSV_UPLOAD_DIR)) {
  fs.mkdirSync(CSV_UPLOAD_DIR, { recursive: true });
}

// Configure multer for CSV uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, CSV_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  },
});

/* May dokumentasyon nito sa .env (10MB default) pero hindi talaga binabasa
ito ng server.js/multer configs - kung walang limit, bubuffer ng multer sa
disk yung upload na kahit anong laki bago pa man magkaroon ng chance ang
fileFilter/controller na i-reject ito. */
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

// Auth routes
router.get('/community-stats', getCommunityStats);
router.post('/login', loginIpLimiter, loginLimiter, authController.login);
router.put('/change-password/:userId', changePasswordLimiter, authenticateToken, ownAccount, authController.changePassword);
router.get('/profile/:userId', authenticateToken, ownAccount, authController.getUserProfile);
router.get('/credential-history/:userId', authenticateToken, ownAccount, authController.getCredentialHistory);
router.get('/verify-token', authController.verifyToken);

router.use('/bulk-import', authenticateToken, requirePasswordChange, authorizeAdminOnly);

// Bulk import routes
router.post('/bulk-import/upload', bulkUploadLimiter, upload.single('file'), bulkImportController.uploadAndPreviewCSV);
router.post('/bulk-import/confirm', bulkUploadLimiter, bulkImportController.confirmAndStartImport);
router.get('/bulk-import/status/:operationId', bulkImportController.getImportStatus);
router.get('/bulk-import/details/:operationId', bulkImportController.getImportDetails);
router.get('/bulk-import/operations', bulkImportController.getAllImportOperations);

module.exports = router;
