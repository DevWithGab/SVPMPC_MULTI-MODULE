const fs = require('fs');
function edit(path, fn) { const old = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n'); const next = fn(old); if (next === old) throw new Error(`No change: ${path}`); fs.writeFileSync(path, next); }
edit('server/shared/models/User.js', s => s.replace("'treasurer', 'scanner_operator'", "'treasurer', 'claims_officer', 'finance_officer', 'scanner_operator'"));
edit('server/shared/models/AuditLog.js', s => s.replace("'treasurer', 'system'", "'treasurer', 'claims_officer', 'finance_officer', 'system'"));
edit('server/shared/controllers/staffController.js', s => s.replace(/const roles = .*?;/, "const { roleModules: roles } = require('../utils/staffRoles');\nconst managedRoles = [...Object.keys(roles), 'treasurer'];").replaceAll('Object.keys(roles) }', 'managedRoles }'));
edit('server/middleware/auth.js', s => s.replace("const jwt =", "const { moduleRoles, claimsRoles, financeRoles } = require('../shared/utils/staffRoles');\nconst jwt =")
  .replace(/const moduleAccess = \{[\s\S]*?\n    \};/, 'const moduleAccess = moduleRoles;')
  .replace("authorizeRoles('admin', 'treasurer', 'super_admin')", "authorizeRoles(...new Set([...claimsRoles, ...financeRoles]))")
  .replace("const authorizeTreasurerOnly = authorizeRoles('treasurer', 'admin', 'super_admin');", "const authorizeTreasurerOnly = authorizeRoles(...financeRoles);\nconst authorizeClaimsOnly = authorizeRoles(...claimsRoles);")
  .replace('  authorizeTreasurerOnly,', '  authorizeTreasurerOnly,\n  authorizeClaimsOnly,'));
edit('server/shared/controllers/authController.js', s => s.replace("const User =", "const { moduleRoles } = require('../utils/staffRoles');\nconst User =")
  .replace("treasurer: ['treasurer'],", "treasurer: ['treasurer', 'finance_officer'],\n        finance_officer: ['finance_officer', 'treasurer'],\n        claims_officer: ['claims_officer', 'admin'],")
  .replace("if (module && user.role !== 'super_admin' && !user.modules?.includes(module))", "if (module && user.role !== 'super_admin' && (!user.modules?.includes(module) || !moduleRoles[module]?.includes(user.role)))"));
edit('server/modules/mortuary/routes/adminRoutes.js', s => s.replace('  authorizeAdminOnly,', '  authorizeClaimsOnly,\n  authorizeRoles,').replaceAll('authorizeAdminOnly', 'authorizeClaimsOnly')
  .replace('router.use(authorizeClaimsOnly);', "router.use(authorizeClaimsOnly);\nconst superAdminOnly = authorizeRoles('super_admin');")
  .replace("router.post('/members/create',", "router.post('/members/create', superAdminOnly,")
  .replace("router.post('/members/bulk-create',", "router.post('/members/bulk-create', superAdminOnly,")
  .replace("router.put('/members/:memberId',", "router.put('/members/:memberId', superAdminOnly,")
  .replace("router.delete('/members/:memberId',", "router.delete('/members/:memberId', superAdminOnly,")
  .replace("router.post('/contributions',", "router.post('/contributions', superAdminOnly,")
  .replace("router.get('/ledger',", "router.get('/ledger', superAdminOnly,")
  .replace("router.get('/ledger/:memberId',", "router.get('/ledger/:memberId', superAdminOnly,")
  .replaceAll('authenticateToken, authorizeClaimsOnly, backupController', 'authenticateToken, superAdminOnly, backupController')
  .replace("router.get('/dashboard', dashboardController.getAdminDashboard);", "router.get('/dashboard', dashboardController.getAdminDashboard);\n// Read-only context for the Claims Officer dashboard.\nrouter.get('/fund-overview', dashboardController.getTreasurerDashboard);\nrouter.get('/balances', require('../controllers/deductionController').getAllMemberBalances);"));
edit('server/modules/mortuary/routes/mortuaryRoutes.js', s => s.replace("const router = express.Router();", "const router = express.Router();\nconst { authorizeTreasurerOnly } = require('../../../middleware/auth');")
  .replace("router.post('/contributions/record',", "router.post('/contributions/record', authorizeTreasurerOnly,")
  .replace("router.get('/ledger/:memberId',", "router.get('/ledger/:memberId', authorizeTreasurerOnly,")
  .replace("router.get('/ledger',", "router.get('/ledger', authorizeTreasurerOnly,")
  .replace("router.get('/balance/:memberId',", "router.get('/balance/:memberId', authorizeTreasurerOnly,"));
edit('server/shared/routes/auditLogRoutes.js', s => s.replace("'admin', 'super_admin', 'secretary', 'treasurer'", "'admin', 'super_admin', 'secretary'")
  .replace('const modules = req.user.modules || [];', "const modules = (req.user.modules || []).filter(module => module === 'attendance');\n  if (!modules.length) return res.status(403).json({ message: 'Mortuary audit logs are available to Super Admin only.' });")
  .replace("modules.filter(module => ['attendance', 'mortuary'].includes(module))", 'modules'));
