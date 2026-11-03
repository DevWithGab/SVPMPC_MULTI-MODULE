const { actorName } = require('./actorName');

/* The who/where fields every createAuditLog entry for a staff request needs.
`role` and `name` are only fallbacks for a request without a signed-in user;
spread the result into the entry and add the action-specific fields after it. */
const auditRequestFields = (req, { role, name = 'Unknown' } = {}) => ({
  userId: req.user?.userId || req.user?.id,
  userName: actorName(req.user, name),
  userRole: req.user?.role || role,
  ipAddress: req.ip,
  userAgent: req.get('user-agent'),
});

module.exports = { auditRequestFields };
