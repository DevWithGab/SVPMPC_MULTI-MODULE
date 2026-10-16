const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { AppError } = require('../../middleware/errorHandler');
const authController = require('../controllers/authController');
const bulkImportController = require('../controllers/bulkImportController');
const { loginLimiter, changePasswordLimiter } = require('../../middleware');

const { authenticateToken, requirePasswordChange, authorizeAdminOnly } = require('../../middleware/auth');
const ownAccount = (req, res, next) => req.params.userId === req.user.userId ? next() : res.status(403).json({ message: 'Access denied' });
const router = express.Router();

// A bulk-import CSV briefly contains real member PII before the controller
// parses it and deletes it. It must never land under uploads/ — that whole
// tree is served statically with no auth (server.js), so a guessable
// `${Date.now()}_name.csv` filename there would be downloadable by anyone
// during that window. tmp-uploads/ sits outside the static-served tree.
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

// Auth routes
router.post('/login', loginLimiter, authController.login);
router.put('/change-password/:userId', changePasswordLimiter, authenticateToken, ownAccount, authController.changePassword);
router.get('/profile/:userId', authenticateToken, ownAccount, authController.getUserProfile);
router.get('/credential-history/:userId', authenticateToken, ownAccount, authController.getCredentialHistory);
router.get('/verify-token', authController.verifyToken);

router.use('/bulk-import', authenticateToken, requirePasswordChange, authorizeAdminOnly);

// Bulk import routes
router.post('/bulk-import/upload', upload.single('file'), bulkImportController.uploadAndPreviewCSV);
router.post('/bulk-import/confirm', bulkImportController.confirmAndStartImport);
router.get('/bulk-import/status/:operationId', bulkImportController.getImportStatus);
router.get('/bulk-import/details/:operationId', bulkImportController.getImportDetails);
router.get('/bulk-import/operations', bulkImportController.getAllImportOperations);

module.exports = router;
