const express = require('express');
const multer = require('multer');
const path = require('path');
const authController = require('../controllers/authController');
const bulkImportController = require('../controllers/bulkImportController');

const router = express.Router();

// Configure multer for CSV uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
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

// Auth routes
router.post('/login', authController.login);
router.put('/change-password/:userId', authController.changePassword);
router.get('/profile/:userId', authController.getUserProfile);
router.get('/credential-history/:userId', authController.getCredentialHistory);
router.get('/verify-token', authController.verifyToken);

// Bulk import routes
router.post('/bulk-import/upload', upload.single('file'), bulkImportController.uploadAndPreviewCSV);
router.post('/bulk-import/confirm', bulkImportController.confirmAndStartImport);
router.get('/bulk-import/status/:operationId', bulkImportController.getImportStatus);
router.get('/bulk-import/details/:operationId', bulkImportController.getImportDetails);
router.get('/bulk-import/operations', bulkImportController.getAllImportOperations);

module.exports = router;
