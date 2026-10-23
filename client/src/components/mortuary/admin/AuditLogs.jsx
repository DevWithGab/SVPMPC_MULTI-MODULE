import React, { useState, useEffect, useCallback } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  RefreshCw,
  Download,
  Eye,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  Users,
  XCircle,
  Loader2,
} from "lucide-react";
import { downloadAuditCsv, createAuditPdf } from "../../../utils/auditExport";
import AuditLogDetails from "../../shared/AuditLogDetails";
import { outcomeLabel } from "../../../utils/auditDetails";
import { auditAPI } from "../../../services/api";
import { Pagination, PaginationInfo } from "../../ui/pagination";
import { formatDateTime, formatTime } from "../../../utils/date";
import AttendanceMetricGrid from "../../attendance/shared/AttendanceMetricGrid";
import "../treasurer/Dashboard.css";
import "../treasurer/MemberBalances.css";
import "./AuditLogs.css";

/* Plain-language labels para yung log ay basahin na parang kwento ng
nangyari sa claim, hindi dump ng internal action codes. */
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

const ROLE_LABELS = {
  admin: "Admin",
  super_admin: "Super Admin",
  treasurer: "Treasurer",
  secretary: "Secretary",
  member: "Member",
};
/* Ang CSS `capitalize` ay apektado lang sa unang letra ng bawat
space-separated word, kaya yung raw role na "super_admin" ay nagiging
"Super_admin" - nakikita pa rin yung underscore. Dito, binibigyan ang
bawat role ng totoong display name. */
const roleLabel = (role) =>
  ROLE_LABELS[role] ||
  (role || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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
  const [exportingPdf, setExportingPdf] = useState(false);

  /* Ipinapakita lang ng screen na ito yung sariling trail ng Mortuary
  module - fixed ang module, hindi ito isang user-editable filter. */
  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setError("");
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
      setError(error.response?.data?.message || "Unable to load audit logs.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

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
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  useEffect(() => {
    if (filters.startDate && filters.endDate) fetchStats();
  }, [fetchStats, filters.startDate, filters.endDate]);

  const handleFilterChange = (key, value) =>
    setFilters({ ...filters, [key]: value, page: 1 });
  const handlePageChange = (newPage) =>
    setFilters({ ...filters, page: newPage });

  const exportRows = () =>
    logs.map((log) => [
      formatDateTime(log.timestamp),
      roleLabel(log.userRole),
      actionLabel(log.action),
      log.entityName || "-",
      log.status,
      log.description,
    ]);
  const exportFilename = (extension) =>
    `mortuary-audit-logs-${new Date().toISOString().split("T")[0]}.${extension}`;
  const handleExportCSV = () => {
    if (!logs.length) return;
    downloadAuditCsv(exportRows(), exportFilename("csv"));
  };
  const handleExportPDF = async () => {
    if (!logs.length || exportingPdf) return;
    setExportingPdf(true);
    /* Synchronous yung jsPDF table rendering sa main thread, kaya nagbigay
    muna tayo ng isang tick bago ito magsimula - kung hindi, hindi talaga
    mapapaint yung "Preparing…" state bago i-block ng call yung browser. */
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      createAuditPdf({
        rows: exportRows(),
        moduleName: "Mortuary",
        filters,
      }).save(exportFilename("pdf"));
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

  const hasActiveFilters = Boolean(
    filters.action || filters.userRole || filters.startDate || filters.endDate,
  );
  const resetFilters = () =>
    setFilters({
      action: "",
      userRole: "",
      startDate: "",
      endDate: "",
      page: 1,
      limit: 50,
    });

  return (
    <div className="treasurer-dashboard admin-audit-logs">
      <header className="td-header">
        <div>
          <p className="td-eyebrow">Mortuary management / Audit logs</p>
          <h1>Audit logs</h1>
          <p className="td-description">
            Monitor claim activity and review changes in the mortuary module.
          </p>
        </div>
        <div className="td-header-actions">
          <button
            className="td-button"
            onClick={() => {
              fetchAuditLogs();
              fetchStats();
            }}
            disabled={loading}
          >
            <RefreshCw
              size={15}
              className={loading ? "animate-spin" : ""}
              aria-hidden="true"
            />
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            className="td-button td-primary"
            onClick={handleExportCSV}
            disabled={loading || Boolean(error) || logs.length === 0}
          >
            <Download size={15} aria-hidden="true" />
            CSV (current page)
          </button>
          <button
            className="td-button"
            onClick={handleExportPDF}
            disabled={loading || Boolean(error) || logs.length === 0 || exportingPdf}
          >
            {exportingPdf ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Download size={15} aria-hidden="true" />}
            {exportingPdf ? "Preparing PDF…" : "PDF (current page)"}
          </button>
        </div>
      </header>

      {stats && filters.startDate && filters.endDate && (
        <AttendanceMetricGrid
          label="Activity summary for the selected date range"
          items={[
            [
              "Total actions",
              stats.totalActions ?? 0,
              "Selected date range",
              Activity,
            ],
            ...(stats.actionsByRole?.length
              ? [
                  [
                    "Most active role",
                    roleLabel(stats.actionsByRole[0]._id),
                    `${stats.actionsByRole[0].count} actions`,
                    Users,
                  ],
                ]
              : []),
            [
              "Successful",
              stats.actionsByStatus?.find((s) => s._id === "success")?.count ||
                0,
              "Selected date range",
              CheckCircle,
            ],
            [
              "Failed",
              stats.actionsByStatus?.find((s) => s._id === "failed")?.count ||
                0,
              "Selected date range",
              XCircle,
            ],
          ]}
        />
      )}

      <section className="mb-filters" aria-labelledby="audit-filter-title">
        <div className="mb-filter-heading">
          <h2 id="audit-filter-title">Filter activity</h2>
          <button
            className="mb-text-button"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
          >
            Reset filters
          </button>
        </div>
        <div className="mb-filter-grid audit-filter-grid">
          <label>
            Start date
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange("startDate", e.target.value)}
            />
          </label>
          <label>
            End date
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange("endDate", e.target.value)}
            />
          </label>
          <label>
            Role
            <select
              value={filters.userRole}
              onChange={(e) => handleFilterChange("userRole", e.target.value)}
            >
              <option value="">All roles</option>
              <option value="admin">Admin</option>
              <option value="treasurer">Treasurer</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </label>
          <label>
            Action
            <select
              value={filters.action}
              onChange={(e) => handleFilterChange("action", e.target.value)}
            >
              <option value="">All actions</option>
              {Object.entries(ACTION_LABELS).map(([action, label]) => (
                <option key={action} value={action}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* Table */}
      <div className="mb-panel audit-register" aria-busy={loading}>
        <div className="mb-register-heading">
          <div>
            <h2>Activity register</h2>
            <p>Open an entry to review its details and recorded changes.</p>
          </div>
        </div>
        <div className="mb-scope">
          <span role="status">
            {loading
              ? "Loading audit logs…"
              : error
                ? "Audit logs unavailable"
                : `${(pagination.total || 0).toLocaleString()} matching records`}
          </span>
          <span>
            {lastUpdated
              ? `Last updated ${formatTime(lastUpdated)}`
              : "Mortuary activity"}
          </span>
        </div>
        {loading ? (
          <div
            className="mb-empty"
            role="status"
            aria-label="Loading audit logs"
          >
            <div className="animate-spin">
              <Zap className="w-8 h-8 text-green-600" />
            </div>
          </div>
        ) : error ? (
          <div className="mb-empty">
            <p role="alert">{error}</p>
            <button className="td-button" onClick={fetchAuditLogs}>
              Try again
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="mb-empty" role="status">
            <Activity className="w-12 h-12 mb-2 opacity-50" />
            <strong>No audit logs found</strong>
            <p>
              {hasActiveFilters
                ? "Try a different date range, role, or action."
                : "Recorded mortuary activity will appear here."}
            </p>
            {hasActiveFilters && (
              <button className="td-button" onClick={resetFilters}>
                Reset filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div
              className="mb-table-scroll"
              role="region"
              aria-label="Audit log records"
              tabIndex={0}
            >
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider"
                    >
                      Date
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider"
                    >
                      Performed by
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider"
                    >
                      Activity
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider"
                    >
                      Result
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider"
                    >
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
                          {log.userName && (
                            <p className="font-medium text-slate-900 mb-1">
                              {log.userName}
                            </p>
                          )}
                          <span
                            className={`px-3 py-1 rounded-md text-xs font-semibold ${getRoleColor(log.userRole)}`}
                          >
                            {roleLabel(log.userRole)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`self-start px-3 py-1 rounded-md text-xs font-semibold ${getActionColor(log.action)}`}
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
                            className="td-button"
                            aria-haspopup="dialog"
                            aria-label={`View ${actionLabel(log.action)} at ${formatDateTime(log.timestamp)}`}
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

            <div className="mb-pagination">
              <PaginationInfo
                currentPage={pagination.page}
                limit={pagination.limit}
                total={pagination.total}
              />
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
      </div>

      {showDetails && selectedLog && (
        <AuditLogDetails
          log={selectedLog}
          module="mortuary"
          actionLabel={actionLabel}
          onClose={() => setShowDetails(false)}
        />
      )}
    </div>
  );
};

export default AuditLogs;
