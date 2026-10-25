import React, { useState, useEffect, useCallback } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Filter,
  Download,
  Eye,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  RotateCcw,
  Users,
  XCircle,
  Loader2,
} from "lucide-react";
import { downloadAuditCsv, createAuditPdf } from "../../../utils/auditExport";
import AuditLogDetails from '../../shared/AuditLogDetails';
import { readableLabel, outcomeLabel } from '../../../utils/auditDetails';
import { auditAPI } from "../../../services/api";
import { Pagination, PaginationInfo } from "../../ui/pagination";
import {
  formatDateTime,
  formatTime,
} from "../../../utils/date";
import AttendanceMetricGrid from "../shared/AttendanceMetricGrid";
import "../secretary/Dashboard.css";
import "./AuditLogs.css";

/* Plain-language labels para yung log ay basahin na parang kwento ng nangyari,
imbes na dump lang ng internal action codes at field names. */
const ACTION_LABELS = {
  event_created: "Event Created",
  event_updated: "Event Updated",
  event_deleted: "Event Deleted",
  attendance_recorded: "Attendance Recorded",
  member_created: "Member Created",
  member_imported: "Members Imported",
  qr_code_generated: "QR Code Generated",
  qr_code_regenerated: "QR Code Regenerated",
  qr_code_deactivated: "QR Code Deactivated",
  qr_code_reactivated: "QR Code Reactivated",
  data_restored: "Backup Restored",
  data_exported: "Backup Downloaded",
};
const actionLabel = (action) =>
  ACTION_LABELS[action] ||
  (action || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Filter states
  const [filters, setFilters] = useState({
    action: "",
    userRole: "",
    module: "attendance",
    entityType: "",
    startDate: "",
    endDate: "",
    page: 1,
    limit: 100,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 100,
    total: 0,
    pages: 1,
  });

  const [stats, setStats] = useState(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Fetch audit logs
  const fetchAuditLogs = useCallback(
    async () => {
      setLoading(true);
      try {
        const response = await auditAPI.getLogs({
          ...filters,
          module: "attendance",
        });
        setLogs(response.logs || []);
        setPagination(response.pagination || {});
        setLastUpdated(new Date());
      } catch (error) {
        console.error("Error fetching audit logs:", error);
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );

  // Fetch statistics
  const fetchStats = useCallback(async () => {
    try {
      if (filters.startDate && filters.endDate) {
        const response = await auditAPI.getStats(
          filters.startDate,
          filters.endDate,
          "attendance",
        );
        setStats(response.summary);
      }
    } catch (error) {
      console.error("Error fetching statistics:", error);
    }
  }, [filters.startDate, filters.endDate]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  useEffect(() => {
    if (filters.startDate && filters.endDate) {
      fetchStats();
    }
  }, [fetchStats, filters.startDate, filters.endDate]);

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value, page: 1 });
  };

  const handlePageChange = (newPage) => {
    setFilters({ ...filters, page: newPage });
  };

  const exportRows = () => logs.map(log => [
    formatDateTime(log.timestamp), log.userRole, actionLabel(log.action),
    log.entityName || "-", log.status, log.description,
  ]);
  const exportFilename = (extension) => `attendance-audit-logs-${new Date().toISOString().split("T")[0]}.${extension}`;
  const handleExportCSV = () => {
    if (!logs.length) return;
    downloadAuditCsv(exportRows(), exportFilename('csv'));
  };
  const handleExportPDF = async () => {
    if (!logs.length || exportingPdf) return;
    setExportingPdf(true);
    /* Synchronous yung jsPDF table rendering sa main thread, kaya nagbigay muna
    tayo ng isang tick bago ito magsimula - kung hindi, hindi talaga mapapaint
    yung "Preparing…" state bago i-block ng call yung browser. */
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      createAuditPdf({ rows: exportRows(), moduleName: 'Attendance', filters }).save(exportFilename('pdf'));
    } finally {
      setExportingPdf(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "failed":
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case "partial":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return <Activity className="w-4 h-4 text-slate-600" />;
    }
  };

  const getActionColor = (action) => {
    const actionColors = {
      event_created: "bg-blue-100 text-blue-800",
      event_updated: "bg-purple-100 text-purple-800",
      event_deleted: "bg-red-100 text-red-800",
      attendance_recorded: "bg-green-100 text-green-800",
      attendance_updated: "bg-yellow-100 text-yellow-800",
      member_imported: "bg-indigo-100 text-indigo-800",
      qr_code_generated: "bg-pink-100 text-pink-800",
      scanner_registered: "bg-cyan-100 text-cyan-800",
    };
    return actionColors[action] || "bg-slate-100 text-slate-800";
  };

  const getRoleColor = (role) => {
    const roleColors = {
      admin: "bg-red-100 text-red-800",
      secretary: "bg-blue-100 text-blue-800",
      scanner: "bg-green-100 text-green-800",
      member: "bg-slate-100 text-slate-800",
      super_admin: "bg-purple-100 text-purple-800",
    };
    return roleColors[role] || "bg-slate-100 text-slate-800";
  };

  return (
    <div className="secretary-dashboard attendance-audit-logs">
      {/* Header */}
      <header className="sd-header">
        <div>
          <p className="sd-eyebrow">Attendance management / Activity history</p>
          <h1>Audit logs</h1>
          <p className="sd-description">
            Review attendance activity, record changes, and action outcomes.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex items-center gap-2" role="group" aria-label="Export audit logs">
            <button onClick={handleExportCSV} disabled={loading || !logs.length} className="sd-button sd-primary">
              <Download size={15} aria-hidden="true" /> CSV (current page)
            </button>
            <button onClick={handleExportPDF} disabled={loading || !logs.length || exportingPdf} className="sd-button">
              {exportingPdf ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Download size={15} aria-hidden="true" />}
              {exportingPdf ? 'Preparing PDF…' : 'PDF (current page)'}
            </button>
          </div>
          {lastUpdated && (
            <p className="text-xs text-slate-400">
              Last updated {formatTime(lastUpdated)}
            </p>
          )}
        </div>
      </header>

      {/* Stats Cards */}
      {stats && filters.startDate && filters.endDate && (
        <AttendanceMetricGrid label="Attendance activity for the selected date range" items={[
          ["Total actions", stats.totalActions ?? 0, "Attendance activity in date range", Activity],
          ["Most active role", actionLabel(stats.actionsByRole?.[0]?._id) || "No activity", `${stats.actionsByRole?.[0]?.count || 0} actions in date range`, Users],
          ["Successful", stats.actionsByStatus?.find((s) => s._id === "success")?.count || 0, "Completed actions in date range", CheckCircle],
          ["Failed", stats.actionsByStatus?.find((s) => s._id === "failed")?.count || 0, "Failed actions in date range", XCircle],
        ]} />
      )}

      {/* Filters */}
      <section className="sd-panel aal-filters" aria-labelledby="aal-filter-title">
        <div className="sd-panel-heading">
          <div><h2 id="aal-filter-title" className="flex items-center gap-2"><Filter size={16} aria-hidden="true" />Filter activity</h2>
          <p>Narrow the log by date, role, or action. Select both dates to view activity totals.</p></div>
          <button className="sd-link" onClick={() => setFilters((current) => ({ ...current, startDate: "", endDate: "", userRole: "", action: "", page: 1 }))}>
            <RotateCcw size={14} aria-hidden="true" /> Reset filters
          </button>
        </div>

        <div className="aal-filter-grid">
          {/* Date Range */}
          <div className="space-y-2">
            <label htmlFor="aal-start-date" className="block text-sm font-medium text-slate-700">
              Start Date
            </label>
            <input
              id="aal-start-date"
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange("startDate", e.target.value)}
              className="w-full h-10 px-4 text-sm rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-coop-green/20 focus:border-coop-green outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="aal-end-date" className="block text-sm font-medium text-slate-700">
              End Date
            </label>
            <input
              id="aal-end-date"
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange("endDate", e.target.value)}
              className="w-full h-10 px-4 text-sm rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-coop-green/20 focus:border-coop-green outline-none transition-all"
            />
          </div>

          {/* Role Filter */}
          <div className="space-y-2">
            <label htmlFor="aal-role" className="block text-sm font-medium text-slate-700">
              Role
            </label>
            <select
              id="aal-role"
              value={filters.userRole}
              onChange={(e) => handleFilterChange("userRole", e.target.value)}
              className="w-full h-10 px-4 text-sm rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-coop-green/20 focus:border-coop-green outline-none transition-all"
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="secretary">Secretary</option>
              <option value="scanner">Scanner</option>
              <option value="member">Member</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>

          {/* Action Filter */}
          <div className="space-y-2">
            <label htmlFor="aal-action" className="block text-sm font-medium text-slate-700">
              Action
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                id="aal-action"
                value={filters.action}
                onChange={(e) => handleFilterChange("action", e.target.value)}
                className="w-full sm:flex-1 h-10 px-4 text-sm rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-coop-green/20 focus:border-coop-green outline-none transition-all"
              >
                <option value="">All Actions</option>
                <option value="event_created">Event Created</option>
                <option value="event_updated">Event Updated</option>
                <option value="event_deleted">Event Deleted</option>
                <option value="attendance_recorded">Attendance Recorded</option>
                <option value="member_imported">Member Imported</option>
                <option value="qr_code_generated">QR Generated</option>
              </select>

            </div>
          </div>
        </div>
      </section>

      {/* Audit Logs Table */}
      <section className="sd-panel aal-log-panel" aria-labelledby="aal-log-title" aria-busy={loading}>
        <div className="sd-panel-heading">
          <div><h2 id="aal-log-title">Activity history</h2><p>Inspect a record to see its details and changes. CSV export includes the current page.</p></div>
          <span className="sd-status sd-status-neutral">{pagination.total || 0} records</span>
        </div>
        {loading ? (
          <div className="sd-data-state aal-data-state" role="status">
            <div className="animate-spin">
              <Zap className="w-8 h-8 text-green-600" />
            </div>
            <p>Loading attendance activity...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="sd-data-state aal-data-state">
            <Activity className="w-12 h-12 mb-2 opacity-50" />
            <p>No audit logs found</p>
            <p>Try adjusting the filters to find attendance activity.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="aal-table" aria-label="Attendance audit logs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Performed by
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Activity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Result
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <AnimatePresence>
                    {logs.map((log) => (
                      <Motion.tr
                        key={log._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                          {formatDateTime(log.timestamp)}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {log.userName && <p className="font-medium text-slate-900 mb-1">{log.userName}</p>}
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${getRoleColor(log.userRole)}`}
                          >
                            {readableLabel(log.userRole)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`self-start px-3 py-1 rounded-full text-xs font-semibold ${getActionColor(log.action)}`}
                            >
                              {actionLabel(log.action)}
                            </span>
                            {log.description && (
                              <span className="text-slate-600">
                                {log.description}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-1.5 capitalize text-slate-700">
                            {getStatusIcon(log.status)}
                            {outcomeLabel(log.status)}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <button
                            onClick={() => {
                              setSelectedLog(log);
                              setShowDetails(true);
                            }}
                            className="sd-button" aria-haspopup="dialog"
                          >
                            <Eye className="w-4 h-4" />
                            View details
                          </button>
                        </td>
                      </Motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <PaginationInfo currentPage={pagination.page} limit={pagination.limit} total={pagination.total} />
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.pages}
                onPageChange={handlePageChange}
                hasNextPage={pagination.page < pagination.pages}
                hasPrevPage={pagination.page > 1}
              />
            </div>
          </>
        )}
      </section>

      {showDetails && selectedLog && (
        <AuditLogDetails log={selectedLog} module="attendance" actionLabel={actionLabel} onClose={() => setShowDetails(false)} />
      )}
    </div>
  );
};

export default AuditLogs;
