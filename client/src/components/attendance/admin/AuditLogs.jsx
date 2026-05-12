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
  User,
  Zap,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { auditAPI } from "../../../services/api";
import { formatDateTime } from "../../../utils/date";

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Filter states
  const [filters, setFilters] = useState({
    action: "",
    userRole: "",
    module: "",
    entityType: "",
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

  // Fetch audit logs
  const fetchAuditLogs = useCallback(
    async (showLoader = false) => {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      try {
        const response = await auditAPI.getLogs(filters);
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

  // Fetch statistics
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
    const intervalId = setInterval(() => {
      fetchAuditLogs(false);
    }, 15000);

    return () => clearInterval(intervalId);
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

  const handleRefresh = () => {
    fetchAuditLogs(false);
  };

  const handleExportCSV = () => {
    if (logs.length === 0) return;

    const headers = [
      "Timestamp",
      "User",
      "Role",
      "Action",
      "Module",
      "Entity Type",
      "Entity Name",
      "Status",
      "Description",
    ];

    const rows = logs.map((log) => [
      formatDateTime(log.timestamp),
      log.userName,
      log.userRole,
      log.action,
      log.module,
      log.entityType,
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
      `audit-logs-${new Date().toISOString().split("T")[0]}.csv`,
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
        return <Activity className="w-4 h-4 text-gray-600" />;
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
    return actionColors[action] || "bg-gray-100 text-gray-800";
  };

  const getRoleColor = (role) => {
    const roleColors = {
      admin: "bg-red-100 text-red-800",
      secretary: "bg-blue-100 text-blue-800",
      scanner: "bg-green-100 text-green-800",
      member: "bg-gray-100 text-gray-800",
      super_admin: "bg-purple-100 text-purple-800",
    };
    return roleColors[role] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{ color: "#2D7A3E" }}
            >
              Audit Logs
            </h1>
            <p className="text-gray-600 mt-2">
              Monitor and track all activities in the attendance module
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
              <span
                className={`h-2.5 w-2.5 rounded-full ${refreshing ? "bg-yellow-500" : "bg-green-500"}`}
              />
              {refreshing ? "Refreshing live data..." : "Live audit feed"}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition hover:border-green-300 hover:bg-green-50 hover:text-green-700"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
            {lastUpdated && (
              <p className="text-xs text-gray-400">
                Last updated {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200"
          >
            <p className="text-blue-600 text-sm font-medium">Total Actions</p>
            <p className="text-3xl font-bold text-blue-900 mt-2">
              {stats.totalActions}
            </p>
          </Motion.div>

          {stats.actionsByRole && stats.actionsByRole.length > 0 && (
            <Motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200"
            >
              <p className="text-purple-600 text-sm font-medium">
                Most Active Role
              </p>
              <p className="text-2xl font-bold text-purple-900 mt-2 capitalize">
                {stats.actionsByRole[0]._id}
              </p>
              <p className="text-purple-700 text-xs mt-1">
                {stats.actionsByRole[0].count} actions
              </p>
            </Motion.div>
          )}

          {stats.actionsByStatus && (
            <>
              {stats.actionsByStatus.find((s) => s._id === "success") && (
                <Motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200"
                >
                  <p className="text-green-600 text-sm font-medium">
                    Successful
                  </p>
                  <p className="text-2xl font-bold text-green-900 mt-2">
                    {stats.actionsByStatus.find((s) => s._id === "success")
                      ?.count || 0}
                  </p>
                </Motion.div>
              )}

              {stats.actionsByStatus.find((s) => s._id === "failed") && (
                <Motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl border border-red-200"
                >
                  <p className="text-red-600 text-sm font-medium">Failed</p>
                  <p className="text-2xl font-bold text-red-900 mt-2">
                    {stats.actionsByStatus.find((s) => s._id === "failed")
                      ?.count || 0}
                  </p>
                </Motion.div>
              )}
            </>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 mb-6">
        <div className="flex items-center gap-2 mb-6">
          <Filter className="w-5 h-5 text-green-600" />
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6 items-end">
          {/* Date Range */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Start Date
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange("startDate", e.target.value)}
              className="w-full h-12 px-4 rounded-lg border border-gray-300 focus:border-green-500 focus:ring-1 focus:ring-green-500"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              End Date
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange("endDate", e.target.value)}
              className="w-full h-12 px-4 rounded-lg border border-gray-300 focus:border-green-500 focus:ring-1 focus:ring-green-500"
            />
          </div>

          {/* Role Filter */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Role
            </label>
            <select
              value={filters.userRole}
              onChange={(e) => handleFilterChange("userRole", e.target.value)}
              className="w-full h-12 px-4 rounded-lg border border-gray-300 focus:border-green-500 focus:ring-1 focus:ring-green-500"
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
          <div className="space-y-2 xl:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Action
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={filters.action}
                onChange={(e) => handleFilterChange("action", e.target.value)}
                className="w-full sm:flex-1 h-12 px-4 rounded-lg border border-gray-300 focus:border-green-500 focus:ring-1 focus:ring-green-500"
              >
                <option value="">All Actions</option>
                <option value="event_created">Event Created</option>
                <option value="event_updated">Event Updated</option>
                <option value="event_deleted">Event Deleted</option>
                <option value="attendance_recorded">Attendance Recorded</option>
                <option value="member_imported">Member Imported</option>
                <option value="qr_code_generated">QR Generated</option>
              </select>

              <button
                onClick={handleExportCSV}
                className="inline-flex h-12 items-center justify-center gap-2 px-5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap sm:w-auto w-full"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin">
              <Zap className="w-8 h-8 text-green-600" />
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Activity className="w-12 h-12 mb-2 opacity-50" />
            <p>No audit logs found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Entity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <AnimatePresence>
                    {logs.map((log) => (
                      <Motion.tr
                        key={log._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatDateTime(log.timestamp)}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="font-medium text-gray-900">
                              {log.userName}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleColor(log.userRole)}`}
                          >
                            {log.userRole}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${getActionColor(log.action)}`}
                          >
                            {log.action.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {log.entityName || log.entityType}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(log.status)}
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

            {/* Pagination */}
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
                of {pagination.total} logs
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Previous
                </button>
                <span className="px-3 py-1">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                  className="px-3 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
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
              className="bg-white rounded-xl max-w-2xl w-full max-h-96 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-gradient-to-r from-green-50 to-green-100 border-b border-green-200 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">
                  Audit Log Details
                </h3>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase">
                      Timestamp
                    </p>
                    <p className="text-sm text-gray-900 mt-1">
                      {formatDateTime(selectedLog.timestamp)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase">
                      User
                    </p>
                    <p className="text-sm text-gray-900 mt-1">
                      {selectedLog.userName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase">
                      Role
                    </p>
                    <p className="text-sm text-gray-900 mt-1 capitalize">
                      {selectedLog.userRole}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase">
                      Status
                    </p>
                    <p className="text-sm text-gray-900 mt-1 capitalize flex items-center gap-2">
                      {getStatusIcon(selectedLog.status)} {selectedLog.status}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    Description
                  </p>
                  <p className="text-sm text-gray-900 mt-1">
                    {selectedLog.description}
                  </p>
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

                {selectedLog.changes &&
                  (selectedLog.changes.before || selectedLog.changes.after) && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase">
                        Changes
                      </p>
                      <pre className="text-xs bg-gray-50 p-3 rounded mt-1 overflow-x-auto max-h-48">
                        {JSON.stringify(selectedLog.changes, null, 2)}
                      </pre>
                    </div>
                  )}

                {selectedLog.metadata &&
                  Object.keys(selectedLog.metadata).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase">
                        Metadata
                      </p>
                      <pre className="text-xs bg-gray-50 p-3 rounded mt-1 overflow-x-auto max-h-48">
                        {JSON.stringify(selectedLog.metadata, null, 2)}
                      </pre>
                    </div>
                  )}

                <div className="text-xs text-gray-500">
                  <p>IP Address: {selectedLog.ipAddress || "N/A"}</p>
                  <p>Log ID: {selectedLog.logId}</p>
                </div>
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AuditLogs;
