const { createAuditLog } = require('../services/auditLoggingService');

/**
 * Middleware to extract user info from request
 * @param {Object} req - Express request object
 * @returns {Object} User info
 */
const extractUserInfo = (req) => {
  const userId = req.user?.id || req.user?.userId || null;
  const userName = req.user?.name || req.user?.username || 'Unknown';
  const userRole = req.user?.role || 'system';
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('user-agent');

  return { userId, userName, userRole, ipAddress, userAgent };
};

/**
 * Middleware to log API audit events
 */
const auditLoggingMiddleware = async (req, res, next) => {
  // Store original send method
  const originalSend = res.send;

  // Override send method to capture response
  res.send = function (data) {
    res.send = originalSend;

    // Attach audit logging function to response
    res.auditLog = async (auditData) => {
      const userInfo = extractUserInfo(req);
      const mergedData = {
        ...userInfo,
        ...auditData,
      };

      await createAuditLog(mergedData);
    };

    return res.send(data);
  };

  next();
};

/**
 * Helper function to log audit event from controller
 * @param {Object} req - Express request object
 * @param {Object} auditData - Audit log data
 */
const logAuditEvent = async (req, auditData) => {
  const userInfo = extractUserInfo(req);
  const mergedData = {
    ...userInfo,
    ...auditData,
  };

  return createAuditLog(mergedData);
};

module.exports = {
  auditLoggingMiddleware,
  logAuditEvent,
  extractUserInfo,
};
