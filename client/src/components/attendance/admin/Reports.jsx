import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Download,
  FileText,
  Calendar,
  Users,
  Filter,
  Search,
  FileDown,
} from "lucide-react";
import { attendanceAPI } from "../../../services/api";
import { pdfReportGenerator } from "../../../utils/pdfReportGenerator";
import {
  formatDate,
  formatTime,
  formatDateTime,
  formatForFilename,
} from "../../../utils/date";
import StatCard from "../shared/StatCard";

const Reports = ({ events }) => {
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState("all");

  useEffect(() => {
    fetchAttendanceLogs();
  }, []);

  const fetchAttendanceLogs = async () => {
    setLoading(true);
    try {
      const response = await attendanceAPI.getAllAttendance();
      if (response.attendance) {
        setAttendanceLogs(response.attendance);
      }
    } catch (error) {
      console.error("Error fetching attendance logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = attendanceLogs.filter((log) => {
    const matchesEvent =
      selectedEvent === "all" || log.eventId === selectedEvent;
    const matchesSearch =
      String(log.memberName || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      String(log.memberId || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesBarangay =
      selectedBarangay === "all" ||
      (log.barangay || "").toLowerCase() === selectedBarangay;
    return matchesEvent && matchesSearch && matchesBarangay;
  });

  const exportToPDF = () => {
    try {
      const reportOptions = {
        data: filteredLogs,
        filters: {
          event: selectedEvent,
          eventName:
            selectedEvent !== "all"
              ? events.find((e) => e.id === selectedEvent)?.name
              : null,
          search: searchTerm,
          dateRange: "All time", // You can add date range filtering later
        },
        stats: {
          totalRecords: stats.totalRecords,
          uniqueMembers: stats.uniqueMembers,
          uniqueEvents: stats.uniqueEvents,
          presentCount: stats.presentCount,
        },
        title: "Attendance Report",
        subtitle: "Cooperative Management System",
      };

      const result = pdfReportGenerator.generateAttendanceReport(reportOptions);

      if (result.success) {
        // You could add a toast notification here
        console.log(`PDF report generated: ${result.filename}`);
      }
    } catch (error) {
      console.error("Error generating PDF report:", error);
      // You could add error handling/notification here
    }
  };

  const exportEventSummary = () => {
    if (selectedEvent === "all") {
      alert(
        "Please select a specific event to generate an event summary report.",
      );
      return;
    }

    try {
      const selectedEventData = events.find((e) => e.id === selectedEvent);
      const eventAttendance = filteredLogs.filter(
        (log) => log.eventId === selectedEvent,
      );

      const reportOptions = {
        eventData: selectedEventData,
        attendanceData: eventAttendance,
        title: "Event Summary Report",
        subtitle: `${selectedEventData?.name || "Event"} - Attendance Analysis`,
      };

      const result =
        pdfReportGenerator.generateEventSummaryReport(reportOptions);

      if (result.success) {
        console.log(`Event summary PDF generated: ${result.filename}`);
      }
    } catch (error) {
      console.error("Error generating event summary PDF:", error);
    }
  };

  const exportToCSV = () => {
    const headers = [
      "Date",
      "Time",
      "Member ID",
      "Member Name",
      "Event",
      "Barangay",
      "Status",
    ];
    const rows = filteredLogs.map((log) => {
      const date = new Date(log.scanTime);
      return [
        formatDate(date),
        formatTime(date),
        log.memberId,
        log.memberName,
        log.eventName,
        log.barangay,
        log.status,
      ];
    });

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
      `attendance_report_${formatForFilename(new Date())}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generatePrintReport = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const rows = filteredLogs
      .map((log) => {
        const date = new Date(log.scanTime);
        return `
        <tr>
          <td>${formatDate(date)}</td>
          <td>${formatTime(date)}</td>
          <td>${log.memberId}</td>
          <td>${log.memberName}</td>
          <td>${log.eventName}</td>
          <td>${log.barangay}</td>
          <td><span class="status-badge">${log.status}</span></td>
        </tr>
      `;
      })
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Attendance Report</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #1e293b; }
            .header { text-align: center; border-bottom: 3px solid #2D7A3E; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { color: #2D7A3E; margin: 0; }
            .stats { display: flex; gap: 20px; justify-content: center; margin-bottom: 30px; }
            .stat { border: 2px solid #2D7A3E; padding: 15px 30px; border-radius: 12px; text-align: center; }
            .stat h3 { color: #2D7A3E; margin: 0; font-size: 32px; }
            .stat p { margin: 5px 0 0 0; color: #64748b; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { text-align: left; background: #f8fafc; padding: 12px; border-bottom: 2px solid #2D7A3E; font-weight: bold; color: #2D7A3E; }
            td { padding: 12px; border-bottom: 1px solid #f1f5f9; }
            .status-badge { background: #2D7A3E; color: white; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
            .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Attendance Report</h1>
            <p>Generated on ${formatDateTime(new Date())}</p>
          </div>
          <div class="stats">
            <div class="stat">
              <h3>${filteredLogs.length}</h3>
              <p>Total Records</p>
            </div>
            <div class="stat">
              <h3>${new Set(filteredLogs.map((l) => l.memberId)).size}</h3>
              <p>Unique Members</p>
            </div>
            <div class="stat">
              <h3>${new Set(filteredLogs.map((l) => l.eventId)).size}</h3>
              <p>Events</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Member ID</th>
                <th>Member Name</th>
                <th>Event</th>
                <th>Barangay</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="footer">
            <p>Cooperative Attendance Management System</p>
          </div>
          <script>setTimeout(() => window.print(), 500);</script>
        </body>
      </html>
    `);
  };

  const stats = {
    totalRecords: filteredLogs.length,
    uniqueMembers: new Set(filteredLogs.map((l) => l.memberId)).size,
    uniqueEvents: new Set(filteredLogs.map((l) => l.eventId)).size,
    presentCount: filteredLogs.filter((l) => l.status === "present").length,
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            ATTENDANCE REPORTS
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Export and analyze attendance data
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={generatePrintReport}
            className="inline-flex items-center h-11 px-5 bg-white border border-slate-200 rounded-lg font-semibold text-sm hover:bg-slate-50 transition-colors"
          >
            <FileText className="w-4 h-4 mr-2" />
            Print Report
          </button>
          <button
            onClick={exportToPDF}
            className="inline-flex items-center h-11 px-5 bg-white border border-slate-200 rounded-lg font-semibold text-sm hover:bg-slate-50 transition-colors"
          >
            <FileDown className="w-4 h-4 mr-2" />
            Export PDF
          </button>

          <button
            onClick={exportToCSV}
            className="inline-flex items-center h-11 px-5 bg-coop-green hover:bg-coop-darkGreen text-white rounded-lg font-semibold text-sm transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Records"
          value={stats.totalRecords}
          icon={FileText}
          color="slate"
        />
        <StatCard
          title="Total Members"
          value={stats.uniqueMembers}
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Events Tracked"
          value={stats.uniqueEvents}
          icon={Calendar}
          color="amber"
        />
        <StatCard
          title="Present Count"
          value={stats.presentCount}
          icon={Users}
          color="emerald"
        />
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
              Search Member
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or ID..."
                className="h-10 w-full pl-11 pr-4 text-sm rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-coop-green/20 focus:border-coop-green outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
              Filter by Event
            </label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="h-10 w-full pl-11 pr-4 text-sm rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-coop-green/20 focus:border-coop-green outline-none transition-all appearance-none"
              >
                <option value="all">All Events</option>
                {events.map((event) => {
                  const eventKey = String(
                    event.eventId ||
                      event.id ||
                      event._id ||
                      event.name ||
                      event.eventName ||
                      "",
                  );
                  const eventName =
                    event.eventName ||
                    event.name ||
                    event.title ||
                    "Untitled Event";
                  return (
                    <option key={eventKey} value={eventKey}>
                      {eventName}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="flex-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
              Barangay
            </label>
            <div className="relative">
              <select
                value={selectedBarangay}
                onChange={(e) => setSelectedBarangay(e.target.value)}
                className="h-10 w-full pl-3 pr-4 text-sm rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-coop-green/20 focus:border-coop-green outline-none transition-all appearance-none"
              >
                <option value="all">All Barangays</option>
                {[
                  ...new Set(
                    attendanceLogs.map((l) => l.barangay).filter(Boolean),
                  ),
                ]
                  .sort()
                  .map((b) => (
                    <option key={b} value={String(b).toLowerCase()}>
                      {b}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900">Attendance Logs</h3>
          <p className="text-sm text-slate-500 mt-1">
            Showing {filteredLogs.length} of {attendanceLogs.length} records
          </p>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block w-8 h-8 border-4 border-slate-200 border-t-green-500 rounded-full animate-spin"></div>
              <p className="text-slate-500 mt-4">Loading attendance logs...</p>
            </div>
          ) : filteredLogs.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Member
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Barangay
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => {
                  const date = new Date(log.scanTime);
                  return (
                    <motion.tr
                      key={log._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">
                          {formatDate(date)}
                        </div>
                        <div className="text-sm text-slate-500">
                          {formatTime(date)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3"
                            style={{ backgroundColor: "#2D7A3E" }}
                          >
                            {log.memberName
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-900">
                              {log.memberName}
                            </div>
                            <div className="text-sm text-slate-500">
                              ID: {log.memberId}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">
                          {log.eventName}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">
                          {log.barangay}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full text-white"
                          style={{ backgroundColor: "#2D7A3E" }}
                        >
                          {log.status}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No attendance records found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
