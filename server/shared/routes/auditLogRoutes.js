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

/* Dati walang auth talaga itong router - lahat ng audit log sa bawat module
(sino gumawa, kailan, saang IP) mababasa ng kahit sino na may URL, naka-login
man o hindi. Kailangan ng audit screens ng both valid session at authorized
staff role; hindi puwedeng makabasa ng private snapshots ang scanner
accounts. */
router.use(authenticateToken);
/* Puwedeng may contact details yung stored audit snapshots. Hindi gumagamit
ng audit APIs ang scanner screens at hindi dapat makalusot dito papalampas
sa attendance response privacy. */
router.use(authorizeRoles('admin', 'super_admin', 'secretary'));
router.use((req, res, next) => {
  if (req.user.role === 'super_admin') { req.auditModule = req.query.module; return next(); }
  const modules = (req.user.modules || []).filter(module => module === 'attendance');
  if (!modules.length) return res.status(403).json({ message: 'Mortuary audit logs are available to Super Admin only.' });
  if (req.query.module && !modules.includes(req.query.module)) return res.status(403).json({ message: 'Module access denied' });
  req.auditModule = req.query.module || modules;
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
