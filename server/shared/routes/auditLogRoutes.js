const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware');
const {
  getAllAuditLogs,
  getAuditTrail,
  getAuditLogStats,
  getUserActivity,
  getRoleActivity,
} = require('../../shared/controllers/auditLogController');

// This router previously had no auth at all — every audit log across every
// module (who did what, when, from what IP) was readable by anyone with the
// URL, logged in or not. Requiring a valid session closes that without
// narrowing it to specific roles, since every existing caller (Attendance's
// and Mortuary's Audit Logs screens) already sends a token via the shared
// axios interceptor — this just makes the server actually check it.
router.use(authenticateToken);

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
