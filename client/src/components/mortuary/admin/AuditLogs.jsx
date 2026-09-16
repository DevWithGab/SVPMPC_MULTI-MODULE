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
  Users,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { auditAPI } from "../../../services/api";
import { formatDate, formatDateTime, formatTime } from "../../../utils/date";
import StatCard from "../shared/StatCard";

// Plain-language labels so the log reads as a story of what happened to a
// claim, not a dump of internal action codes.
const ACTION_LABELS = {
  claim_created: "Claim Filed",
  claim_approved: "Claim Approved",
  claim_rejected: "Claim Rejected",
  claim_deduction_processed: "Deduction Processed",
  claim_released: "Benefit Released",
};
const actionLabel = (action) =>
  ACTION_LABELS[action] ||
  (action || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const ACTION_COLORS = {
  claim_created: "bg-blue-100 text-blue-800",
  claim_approved: "bg-green-100 text-green-800",
  claim_rejected: "bg-red-100 text-red-800",
  claim_deduction_processed: "bg-amber-100 text-amber-800",
  claim_released: "bg-emerald-100 text-emerald-800",
};
const getActionColor = (action) =>
  ACTION_COLORS[action] || "bg-slate-100 text-slate-800";

const ROLE_COLORS = {
  admin: "bg-red-100 text-red-800",
  super_admin: "bg-purple-100 text-purple-800",
  treasurer: "bg-blue-100 text-blue-800",
  secretary: "bg-indigo-100 text-indigo-800",
  member: "bg-slate-100 text-slate-800",
};
const getRoleColor = (role) =>
  ROLE_COLORS[role] || "bg-slate-100 text-slate-800";

// Fields that are internal bookkeeping or already restated elsewhere (e.g.
// statusHistory duplicates what the audit trail itself is showing).
const INTERNAL_FIELDS = new Set([
  "_id",
  "__v",
  "id",
  "createdAt",
  "updatedAt",
  "statusHistory",
]);

const FIELD_LABELS = {
  memberName: "Deceased Member",
  memberId: "Member ID",
  beneficiaryName: "Beneficiary",
  beneficiaryRelationship: "Relationship",
  beneficiaryContact: "Beneficiary Contact",
  dateOfDeath: "Date of Death",
  dateFiled: "Date Filed",
  causeOfDeath: "Cause of Death",
  remarks: "Remarks",
  status: "Status",
  requirements: "Requirements",
  verification: "Verification",
  approval: "Approval",
  rejection: "Rejection",
  deduction: "Deduction",
  payout: "Payout",
  createdBy: "Created By",
};

const friendlyLabel = (key) =>
  FIELD_LABELS[key] ||
  key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();

// Nested objects (deduction, payout, approval, ...) get flattened into a
// single readable line instead of rendering as "[object Object]".
const friendlyValue = (key, value) => {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "dateOfDeath" || key === "dateFiled") return formatDate(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value))
    return value.length ? `${value.length} item(s)` : "—";
  if (typeof value === "object") {
    const parts = Object.entries(value)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(
        ([k, v]) =>
          `${friendlyLabel(k)}: ${typeof v === "object" ? JSON.stringify(v) : v}`,
      );
    return parts.length ? parts.join(", ") : "—";
  }
  return String(value);
};

// Turns a log's raw before/after snapshot into either a readable diff
// (field changed from X to Y) or, for a create with only one side, a plain
// list of that claim's key details — never the raw document.
const describeChanges = (changes) => {
  if (!changes) return { kind: null, rows: [] };
  const { before, after } = changes;

  if (before && after) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
    const rows = keys
      .filter((key) => !INTERNAL_FIELDS.has(key))
      .filter(
        (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
      )
      .map((key) => ({
        label: friendlyLabel(key),
        before: friendlyValue(key, before[key]),
        after: friendlyValue(key, after[key]),
      }));
    return { kind: "diff", rows };
  }

  const snapshot = after || before;
  if (!snapshot) return { kind: null, rows: [] };
  const rows = Object.keys(snapshot)
    .filter((key) => !INTERNAL_FIELDS.has(key))
    .map((key) => ({
      label: friendlyLabel(key),
      value: friendlyValue(key, snapshot[key]),
    }));
  return { kind: "snapshot", rows };
};

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [filters, setFilters] = useState({
    action: "",
    userRole: "",
    startDate: "",
    endDate: "",
    page: 1,
    limit: 50,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1,
  });
  const [stats, setStats] = useState(null);

  // This screen only ever shows the Mortuary module's own trail — module
  // is fixed, not a user-editable filter.
  const fetchAuditLogs = useCallback(
    async (showLoader = false) => {
      if (showLoader) setLoading(true);
      else setRefreshing(true);
      try {
        const response = await auditAPI.getLogs({
          ...filters,
          module: "mortuary",
        });
        setLogs(response.logs || []);
        setPagination(response.pagination || {});
        setLastUpdated(new Date());
      } catch (error) {
        console.error("Error fetching audit logs:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filters],
  );

  const fetchStats = useCallback(async () => {
    try {
      if (filters.startDate && filters.endDate) {
        const response = await auditAPI.getStats(
          filters.startDate,
          filters.endDate,
        );
        setStats(response.summary);
      }
    } catch (error) {
      console.error("Error fetching statistics:", error);
    }
  }, [filters.startDate, filters.endDate]);

  useEffect(() => {
    fetchAuditLogs(true);
  }, [fetchAuditLogs]);

  useEffect(() => {
    const intervalId = setInterval(() => fetchAuditLogs(false), 15000);
    return () => clearInterval(intervalId);
  }, [fetchAuditLogs]);

  useEffect(() => {
    if (filters.startDate && filters.endDate) fetchStats();
  }, [fetchStats, filters.startDate, filters.endDate]);

  const handleFilterChange = (key, value) =>
    setFilters({ ...filters, [key]: value, page: 1 });
  const handlePageChange = (newPage) =>
    setFilters({ ...filters, page: newPage });
  const handleRefresh = () => fetchAuditLogs(false);

  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const headers = [
      "Timestamp",
      "Role",
      "Action",
      "Entity Name",
      "Status",
      "Description",
    ];
    const rows = logs.map((log) => [
      formatDateTime(log.timestamp),
      log.userRole,
      actionLabel(log.action),
      log.entityName || "-",
      log.status,
      log.description,
    ]);
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `mortuary-audit-logs-${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.click();
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

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Audit Logs
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Monitor and track all claim activity in the mortuary module
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-coop-green/40 hover:bg-green-50 hover:text-coop-green"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span
              className={`h-2.5 w-2.5 rounded-full ${refreshing ? "bg-yellow-500" : "bg-green-500"}`}
            />
            {refreshing ? "Refreshing live data..." : "Live audit feed"}
          </div>
          {lastUpdated && (
            <p className="text-xs text-slate-400">
              Last updated {formatTime(lastUpdated)}
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Actions"
            value={stats.totalActions}
            icon={Activity}
            color="slate"
          />
          {stats.actionsByRole && stats.actionsByRole.length > 0 && (
            <StatCard
              title="Most Active Role"
              value={stats.actionsByRole[0]._id}
              subtitle={`${stats.actionsByRole[0].count} actions`}
              icon={Users}
              color="amber"
            />
          )}
          {stats.actionsByStatus && (
            <>
              <StatCard
                title="Successful"
                value={
                  stats.actionsByStatus.find((s) => s._id === "success")
                    ?.count || 0
                }
                icon={CheckCircle}
                color="emerald"
              />
              <StatCard
                title="Failed"
                value={
                  stats.actionsByStatus.find((s) => s._id === "failed")
                    ?.count || 0
                }
                icon={XCircle}
                color="amber"
              />
            </>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-coop-green" />
          <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 items-end">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Start Date
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange("startDate", e.target.value)}
              className="w-full h-10 px-4 text-sm rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-coop-green/20 focus:border-coop-green outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              End Date
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange("endDate", e.target.value)}
              className="w-full h-10 px-4 text-sm rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-coop-green/20 focus:border-coop-green outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Role
            </label>
            <select
              value={filters.userRole}
              onChange={(e) => handleFilterChange("userRole", e.target.value)}
              className="w-full h-10 px-4 text-sm rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-coop-green/20 focus:border-coop-green outline-none transition-all"
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="treasurer">Treasurer</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <div className="space-y-2 xl:col-span-2">
            <label className="block text-sm font-medium text-slate-700">
              Action
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={filters.action}
                onChange={(e) => handleFilterChange("action", e.target.value)}
                className="w-full sm:flex-1 h-10 px-4 text-sm rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-coop-green/20 focus:border-coop-green outline-none transition-all"
              >
                <option value="">All Actions</option>
                <option value="claim_created">Claim Filed</option>
                <option value="claim_approved">Claim Approved</option>
                <option value="claim_rejected">Claim Rejected</option>
                <option value="claim_deduction_processed">
                  Deduction Processed
                </option>
                <option value="claim_released">Benefit Released</option>
              </select>
              <button
                onClick={handleExportCSV}
                className="inline-flex h-10 items-center justify-center gap-2 px-5 bg-coop-green text-white text-sm font-semibold rounded-lg hover:bg-coop-darkGreen transition-colors whitespace-nowrap sm:w-auto w-full"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin">
              <Zap className="w-8 h-8 text-green-600" />
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <Activity className="w-12 h-12 mb-2 opacity-50" />
            <p>No audit logs found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Activity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Status
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
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${getRoleColor(log.userRole)}`}
                          >
                            {log.userRole}
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
                            {log.status}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <button
                            onClick={() => {
                              setSelectedLog(log);
                              setShowDetails(true);
                            }}
                            className="text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </button>
                        </td>
                      </Motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-t border-slate-200">
              <div className="text-sm text-slate-600">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
                of {pagination.total} logs
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 rounded border border-slate-300 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
                >
                  Previous
                </button>
                <span className="px-3 py-1">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                  className="px-3 py-1 rounded border border-slate-300 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetails && selectedLog && (
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowDetails(false)}
          >
            <Motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-gradient-to-r from-green-50 to-green-100 border-b border-green-200 px-6 py-4 flex items-center justify-between">
                <div>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${getActionColor(selectedLog.action)}`}
                  >
                    {actionLabel(selectedLog.action)}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">
                    {selectedLog.description || actionLabel(selectedLog.action)}
                  </h3>
                </div>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-slate-500 hover:text-slate-700 shrink-0"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase">
                      Date
                    </p>
                    <p className="text-sm text-slate-900 mt-1">
                      {formatDateTime(selectedLog.timestamp)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase">
                      By
                    </p>
                    <span
                      className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${getRoleColor(selectedLog.userRole)}`}
                    >
                      {selectedLog.userRole}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase">
                      Status
                    </p>
                    <p className="text-sm text-slate-900 mt-1 capitalize flex items-center gap-2">
                      {getStatusIcon(selectedLog.status)} {selectedLog.status}
                    </p>
                  </div>
                </div>

                {selectedLog.errorMessage && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-red-700 uppercase">
                      Error Message
                    </p>
                    <p className="text-sm text-red-600 mt-1">
                      {selectedLog.errorMessage}
                    </p>
                  </div>
                )}

                {(() => {
                  const { kind, rows } = describeChanges(selectedLog.changes);
                  if (!rows.length) return null;

                  if (kind === "diff") {
                    return (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
                          What Changed
                        </p>
                        <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                          {rows.map((row) => (
                            <div
                              key={row.label}
                              className="grid grid-cols-3 gap-2 px-3 py-2 text-sm"
                            >
                              <span className="font-medium text-slate-700">
                                {row.label}
                              </span>
                              <span className="text-slate-500 truncate">
                                {row.before}
                              </span>
                              <span className="text-slate-900 font-medium truncate">
                                → {row.after}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
                        Details
                      </p>
                      <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                        {rows.map((row) => (
                          <div
                            key={row.label}
                            className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                          >
                            <span className="font-medium text-slate-700">
                              {row.label}
                            </span>
                            <span className="text-slate-900 text-right">
                              {row.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <details className="text-xs text-slate-400 pt-2 border-t border-slate-100">
                  <summary className="cursor-pointer select-none font-medium text-slate-500 hover:text-slate-700">
                    Technical details
                  </summary>
                  <div className="mt-2 space-y-1 pl-1">
                    <p>IP Address: {selectedLog.ipAddress || "N/A"}</p>
                    <p>Log ID: {selectedLog.logId}</p>
                  </div>
                </details>
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AuditLogs;
