const { AuditLog, Member } = require('../../shared/models');
const Event = require('../../modules/attendance/models/Event');
const Attendance = require('../../modules/attendance/models/Attendance');
const { v4: uuidv4 } = require('uuid');

/**
 * Create an audit log entry
 * @param {Object} auditData - Audit log data
 * @param {string} auditData.userId - User ID performing the action
 * @param {string} auditData.userName - User name
 * @param {string} auditData.userRole - User role (admin, secretary, scanner, member)
 * @param {string} auditData.action - Action type
 * @param {string} auditData.module - Module name (attendance, mortuary, member_management)
 * @param {string} auditData.entityType - Entity type affected
 * @param {string} auditData.entityId - Entity ID affected
 * @param {string} auditData.entityName - Entity name
 * @param {string} auditData.description - Action description
 * @param {Object} auditData.changes - Before/after changes
 * @param {string} auditData.status - Success/failed/partial
 * @param {string} auditData.errorMessage - Error message if failed
 * @param {string} auditData.ipAddress - IP address of the user
 * @param {string} auditData.userAgent - User agent
 * @param {Object} auditData.metadata - Additional metadata
 * @returns {Promise<Object>} Created audit log
 */
const createAuditLog = async (auditData) => {
  try {
    const auditLog = new AuditLog({
      logId: uuidv4(),
      userId: auditData.userId || null,
      userName: auditData.userName || 'System',
      userRole: auditData.userRole || 'system',
      action: auditData.action,
      module: auditData.module,
      entityType: auditData.entityType,
      entityId: auditData.entityId || null,
      entityName: auditData.entityName || null,
      description: auditData.description,
      changes: auditData.changes || { before: null, after: null },
      status: auditData.status || 'success',
      errorMessage: auditData.errorMessage || null,
      ipAddress: auditData.ipAddress || null,
      userAgent: auditData.userAgent || null,
      metadata: auditData.metadata || {},
      timestamp: new Date(),
    });

    await auditLog.save();
    return auditLog;
  } catch (error) {
    console.error('Error creating audit log:', error);
    // Don't throw to prevent disrupting main functionality
    return null;
  }
};

const buildDerivedLog = (entry) => ({
  _id: entry.logId,
  logId: entry.logId,
  userId: entry.userId || null,
  userName: entry.userName || 'System',
  userRole: entry.userRole || 'system',
  action: entry.action,
  module: entry.module,
  entityType: entry.entityType,
  entityId: entry.entityId || null,
  entityName: entry.entityName || null,
  description: entry.description,
  changes: entry.changes || { before: null, after: null },
  status: entry.status || 'success',
  errorMessage: entry.errorMessage || null,
  ipAddress: entry.ipAddress || null,
  userAgent: entry.userAgent || null,
  metadata: entry.metadata || {},
  timestamp: new Date(entry.timestamp || Date.now()),
  source: 'derived',
});

const getDerivedActivityFeed = async (options = {}) => {
  try {
    const {
      userId,
      action,
      module,
      userRole,
      entityType,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = options;

    const [events, attendanceRecords, members] = await Promise.all([
      Event.find({}).sort({ updatedAt: -1 }).lean(),
      Attendance.find({}).sort({ scanTime: -1 }).lean(),
      Member.find({}).sort({ updatedAt: -1 }).lean(),
    ]);

    const activity = [];

    for (const event of events) {
      activity.push(
        buildDerivedLog({
          logId: `derived-event-created-${event.eventId}`,
          userId: event.createdBy || null,
          userName: event.createdBy || 'Secretary',
          userRole: String(event.createdBy || '').toLowerCase().includes('admin')
            ? 'admin'
            : 'secretary',
          action: 'event_created',
          module: 'attendance',
          entityType: 'event',
          entityId: event.eventId,
          entityName: event.eventName,
          description: `Event "${event.eventName}" created for ${event.location}`,
          timestamp: event.createdAt,
          metadata: {
            startTime: event.startTime,
            endTime: event.endTime,
            location: event.location,
            status: event.status,
          },
        }),
      );

      if (event.updatedAt && event.createdAt && new Date(event.updatedAt) > new Date(event.createdAt)) {
        activity.push(
          buildDerivedLog({
            logId: `derived-event-updated-${event.eventId}-${new Date(event.updatedAt).getTime()}`,
            userId: event.createdBy || null,
            userName: event.createdBy || 'Secretary',
            userRole: String(event.createdBy || '').toLowerCase().includes('admin')
              ? 'admin'
              : 'secretary',
            action: 'event_updated',
            module: 'attendance',
            entityType: 'event',
            entityId: event.eventId,
            entityName: event.eventName,
            description: `Event "${event.eventName}" was updated`,
            timestamp: event.updatedAt,
            metadata: {
              startTime: event.startTime,
              endTime: event.endTime,
              location: event.location,
              status: event.status,
            },
          }),
        );
      }
    }

    for (const record of attendanceRecords) {
      activity.push(
        buildDerivedLog({
          logId: `derived-attendance-${record.attendanceId}`,
          userId: record.scannedBy || 'scanner',
          userName: record.scannedBy || 'Scanner Device',
          userRole: 'scanner',
          action: 'attendance_recorded',
          module: 'attendance',
          entityType: 'attendance',
          entityId: record.attendanceId,
          entityName: record.memberName,
          description: `Attendance recorded for member "${record.memberName}" at event "${record.eventName}"`,
          timestamp: record.scanTime || record.createdAt,
          metadata: {
            memberId: record.memberId,
            eventId: record.eventId,
            barangay: record.barangay,
            status: record.status,
          },
        }),
      );
    }

    for (const member of members) {
      activity.push(
        buildDerivedLog({
          logId: `derived-member-created-${member.memberId}`,
          userId: member.memberId,
          userName: member.memberName,
          userRole: 'member',
          action: 'member_created',
          module: 'member_management',
          entityType: 'member',
          entityId: member.memberId,
          entityName: member.memberName,
          description: `Member "${member.memberName}" exists in the system`,
          timestamp: member.createdAt,
          metadata: {
            barangay: member.barangay,
            status: member.status,
            qrCodeGenerated: member.qrCodeGenerated,
          },
        }),
      );

      if (member.qrCodeGenerated) {
        activity.push(
          buildDerivedLog({
            logId: `derived-member-qr-${member.memberId}`,
            userId: member.memberId,
            userName: member.memberName,
            userRole: 'secretary',
            action: 'qr_code_generated',
            module: 'attendance',
            entityType: 'member',
            entityId: member.memberId,
            entityName: member.memberName,
            description: `QR code generated for member "${member.memberName}"`,
            timestamp: member.updatedAt || member.createdAt,
            metadata: {
              barangay: member.barangay,
            },
          }),
        );
      }
    }

    let filtered = activity;

    if (userId) filtered = filtered.filter((log) => String(log.userId || '') === String(userId));
    if (action) filtered = filtered.filter((log) => String(log.action || '') === String(action));
    if (module) filtered = filtered.filter((log) => String(log.module || '') === String(module));
    if (userRole) filtered = filtered.filter((log) => String(log.userRole || '') === String(userRole));
    if (entityType) filtered = filtered.filter((log) => String(log.entityType || '') === String(entityType));

    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      filtered = filtered.filter((log) => {
        const timestamp = new Date(log.timestamp);
        if (start && timestamp < start) return false;
        if (end && timestamp > end) return false;
        return true;
      });
    }

    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const skip = (page - 1) * limit;
    const paginated = filtered.slice(skip, skip + parseInt(limit));

    return {
      logs: paginated,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filtered.length,
        pages: Math.ceil(filtered.length / limit),
      },
      source: 'derived',
    };
  } catch (error) {
    console.error('Error building derived activity feed:', error);
    return {
      logs: [],
      pagination: {
        page: parseInt(options.page || 1),
        limit: parseInt(options.limit || 50),
        total: 0,
        pages: 0,
      },
      source: 'derived',
    };
  }
};

/**
 * Get audit logs with optional filters
 * @param {Object} options - Filter options
 * @param {string} options.userId - Filter by user ID
 * @param {string} options.action - Filter by action
 * @param {string} options.module - Filter by module
 * @param {string} options.userRole - Filter by user role
 * @param {string} options.entityType - Filter by entity type
 * @param {Date} options.startDate - Start date filter
 * @param {Date} options.endDate - End date filter
 * @param {number} options.page - Page number (default 1)
 * @param {number} options.limit - Results per page (default 50)
 * @returns {Promise<Object>} Audit logs with pagination info
 */
const getAuditLogs = async (options = {}) => {
  try {
    const {
      userId,
      action,
      module,
      userRole,
      entityType,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = options;

    const filter = {};

    if (userId) filter.userId = userId;
    if (action) filter.action = action;
    if (module) filter.module = module;
    if (userRole) filter.userRole = userRole;
    if (entityType) filter.entityType = entityType;

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      AuditLog.countDocuments(filter),
    ]);

    return {
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    throw error;
  }
};

/**
 * Get audit logs for a specific entity
 * @param {string} entityType - Entity type
 * @param {string} entityId - Entity ID
 * @param {number} limit - Number of logs to fetch
 * @returns {Promise<Array>} Audit logs for entity
 */
const getEntityAuditTrail = async (entityType, entityId, limit = 20) => {
  try {
    const logs = await AuditLog.find({
      entityType,
      entityId,
    })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    return logs;
  } catch (error) {
    console.error('Error fetching entity audit trail:', error);
    throw error;
  }
};

/**
 * Get audit logs summary statistics
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Object>} Summary statistics
 */
const getAuditLogsSummary = async (startDate, endDate) => {
  try {
    const filter = {
      timestamp: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    };

    const [totalActions, actionsByType, actionsByRole, actionsByStatus] =
      await Promise.all([
        AuditLog.countDocuments(filter),
        AuditLog.aggregate([
          { $match: filter },
          {
            $group: {
              _id: '$action',
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ]),
        AuditLog.aggregate([
          { $match: filter },
          {
            $group: {
              _id: '$userRole',
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ]),
        AuditLog.aggregate([
          { $match: filter },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

    return {
      totalActions,
      actionsByType,
      actionsByRole,
      actionsByStatus,
      dateRange: {
        startDate,
        endDate,
      },
    };
  } catch (error) {
    console.error('Error fetching audit logs summary:', error);
    throw error;
  }
};

module.exports = {
  createAuditLog,
  getAuditLogs,
  getEntityAuditTrail,
  getAuditLogsSummary,
  getDerivedActivityFeed,
};
