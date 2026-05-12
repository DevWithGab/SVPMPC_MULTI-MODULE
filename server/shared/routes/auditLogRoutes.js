const express = require('express');
const router = express.Router();
const {
  getAllAuditLogs,
  getAuditTrail,
  getAuditLogStats,
  getUserActivity,
  getRoleActivity,
} = require('../../shared/controllers/auditLogController');

// Get all audit logs with filtering
router.get('/logs', getAllAuditLogs);

// Get audit trail for specific entity
router.get('/trail/:entityType/:entityId', getAuditTrail);

// Get audit logs summary statistics
router.get('/stats', getAuditLogStats);

// Get activity by user
router.get('/user/:userId', getUserActivity);

// Get activity by role
router.get('/role/:role', getRoleActivity);

module.exports = router;
