const { safeErrorMessage } = require('../../middleware/errorHandler');
const {
  getAuditLogs,
  getEntityAuditTrail,
  getAuditLogsSummary,
  getDerivedActivityFeed,
} = require('../../shared/services/auditLoggingService');

/**
 * Get all audit logs with filtering and pagination
 */
const getAllAuditLogs = async (req, res) => {
  try {
    const {
      userId,
      action,
      userRole,
      entityType,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    const result = await getAuditLogs({
      userId,
      action,
      module: req.auditModule,
      userRole,
      entityType,
      startDate,
      endDate,
      page,
      limit,
    });

    // Only fall back to the synthetic feed when NO real logs exist for this
    // filter at all (pagination.total, independent of page/limit) — logs.length
    // alone is also 0 for a real, non-empty result when the caller just asked
    // for a page past the last one, which used to swap in the unrelated
    // derived dataset (different total, different rows) instead of the real
    // (correctly empty) page.
    if (result.pagination.total === 0) {
      const derivedResult = await getDerivedActivityFeed({
        userId,
        action,
        module: req.auditModule,
        userRole,
        entityType,
        startDate,
        endDate,
        page,
        limit,
      });

      return res.status(200).json({
        message: 'Audit logs retrieved successfully',
        ...derivedResult,
      });
    }

    res.status(200).json({
      message: 'Audit logs retrieved successfully',
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching audit logs',
      error: safeErrorMessage(error),
    });
  }
};

/**
 * Get audit trail for specific entity
 */
const getAuditTrail = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { limit = 20 } = req.query;

    if (!entityType || !entityId) {
      return res.status(400).json({
        message: 'Entity type and ID are required',
      });
    }

    const logs = await getEntityAuditTrail(entityType, entityId, limit, req.auditModule);

    res.status(200).json({
      message: 'Entity audit trail retrieved successfully',
      entityType,
      entityId,
      logs,
      count: logs.length,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching audit trail',
      error: safeErrorMessage(error),
    });
  }
};

/**
 * Get audit logs summary statistics
 */
const getAuditLogStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        message: 'Start date and end date are required',
      });
    }

    const summary = await getAuditLogsSummary(
      new Date(startDate),
      new Date(endDate),
      req.auditModule
    );

    res.status(200).json({
      message: 'Audit logs summary retrieved successfully',
      summary,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching audit logs summary',
      error: safeErrorMessage(error),
    });
  }
};

/**
 * Get activity by user
 */
const getUserActivity = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 30 } = req.query;

    if (!userId) {
      return res.status(400).json({
        message: 'User ID is required',
      });
    }

    const result = await getAuditLogs({
      userId,
      module: req.auditModule,
      page,
      limit,
    });

    res.status(200).json({
      message: 'User activity retrieved successfully',
      userId,
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching user activity',
      error: safeErrorMessage(error),
    });
  }
};

/**
 * Get activity by role
 */
const getRoleActivity = async (req, res) => {
  try {
    const { role } = req.params;
    const { page = 1, limit = 50 } = req.query;

    if (!role) {
      return res.status(400).json({
        message: 'Role is required',
      });
    }

    const result = await getAuditLogs({
      module: req.auditModule,
      userRole: role,
      page,
      limit,
    });

    res.status(200).json({
      message: 'Role activity retrieved successfully',
      role,
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching role activity',
      error: safeErrorMessage(error),
    });
  }
};

module.exports = {
  getAllAuditLogs,
  getAuditTrail,
  getAuditLogStats,
  getUserActivity,
  getRoleActivity,
};
