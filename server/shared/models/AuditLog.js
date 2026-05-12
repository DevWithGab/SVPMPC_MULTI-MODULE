const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    logId: {
      type: String,
      unique: true,
      required: true,
    },
    userId: {
      type: String,
      required: false, // might be null for system actions
      ref: 'User',
    },
    userName: {
      type: String,
      required: false,
    },
    userRole: {
      type: String,
      enum: ['admin', 'secretary', 'scanner', 'member', 'super_admin', 'system'],
      required: true,
    },
    action: {
      type: String,
      enum: [
        'event_created',
        'event_updated',
        'event_deleted',
        'event_status_changed',
        'attendance_recorded',
        'attendance_updated',
        'attendance_deleted',
        'member_imported',
        'member_updated',
        'member_deleted',
        'qr_code_generated',
        'scanner_registered',
        'scanner_status_changed',
        'scan_processed',
        'report_generated',
        'filter_applied',
      ],
      required: true,
    },
    module: {
      type: String,
      enum: ['attendance', 'mortuary', 'member_management', 'admin'],
      required: true,
    },
    entityType: {
      type: String,
      enum: ['event', 'attendance', 'member', 'scanner', 'report', 'filter'],
      required: true,
    },
    entityId: {
      type: String,
      required: false,
    },
    entityName: {
      type: String,
      required: false,
    },
    description: {
      type: String,
      required: true,
    },
    changes: {
      before: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
      after: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'partial'],
      default: 'success',
    },
    errorMessage: {
      type: String,
      default: null,
    },
    ipAddress: {
      type: String,
      required: false,
    },
    userAgent: {
      type: String,
      required: false,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

// Indexes for efficient querying
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ module: 1, timestamp: -1 });
auditLogSchema.index({ userRole: 1, timestamp: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
