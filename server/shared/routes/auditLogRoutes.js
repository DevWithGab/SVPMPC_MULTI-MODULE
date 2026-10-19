const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../../middleware');
const {
  getAllAuditLogs,
  getAuditTrail,
  getAuditLogStats,
  getUserActivity,
  getRoleActivity,
} = require('../../shared/controllers/auditLogController');

// This router previously had no auth at all — every audit log across every
// module (who did what, when, from what IP) was readable by anyone with the
// URL, logged in or not. Audit screens require both a valid session and
// an authorized staff role; scanner accounts cannot read private snapshots.
router.use(authenticateToken);
// Stored audit snapshots may include contact details. Scanner screens do not
// use audit APIs and must not bypass attendance response privacy through them.
router.use(authorizeRoles('admin', 'super_admin', 'secretary', 'treasurer'));
router.use((req, res, next) => {
  if (req.user.role === 'super_admin') { req.auditModule = req.query.module; return next(); }
  const modules = req.user.modules || [];
  if (req.query.module && !modules.includes(req.query.module)) return res.status(403).json({ message: 'Module access denied' });
  req.auditModule = req.query.module || modules.filter(module => ['attendance', 'mortuary'].includes(module));
  next();
});

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
