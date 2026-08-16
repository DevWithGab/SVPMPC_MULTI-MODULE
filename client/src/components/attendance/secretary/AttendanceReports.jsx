import React, { useState, useEffect } from "react";
import {
  BarChart3,
  Download,
  Calendar,
  Users,
  Filter,
  TrendingUp,
  FileText,
  Search,
  X,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";
import { StatCard } from "../shared";
import { pdfReportGenerator } from "../../../utils/pdfReportGenerator";
import { attendanceAPI, eventAPI, memberAPI } from "../../../services/api";
import { formatDate, formatTime } from "../../../utils/date";

export default function AttendanceReports({ attendanceLogs, events }) {
  const [selectedEvent, setSelectedEvent] = useState("all");
  const [selectedBarangay, setSelectedBarangay] = useState("all");
  const [dateRange, setDateRange] = useState("month");
  const [searchTerm, setSearchTerm] = useState("");
  const [localEvents, setLocalEvents] = useState(events || []);
  const [localAttendanceLogs, setLocalAttendanceLogs] = useState(
    attendanceLogs || [],
  );
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [totalMembersInDb, setTotalMembersInDb] = useState(0);
  const [_totalAttendanceInDb, setTotalAttendanceInDb] = useState(0);

  useEffect(() => {
    setLocalEvents(events || []);
  }, [events]);

  useEffect(() => {
    setLocalAttendanceLogs(attendanceLogs || []);
  }, [attendanceLogs]);

  useEffect(() => {
    const loadEvents = async () => {
      setLoadingEvents(true);
      try {
        const response = await eventAPI.getAllEvents();
        if (Array.isArray(response?.events)) {
          setLocalEvents(response.events);
        } else if (Array.isArray(response)) {
          setLocalEvents(response);
        } else if (Array.isArray(response?.data?.events)) {
          setLocalEvents(response.data.events);
        }
      } catch (error) {
        console.error("Error loading events from DB:", error);
      } finally {
        setLoadingEvents(false);
      }
    };

    loadEvents();
  }, [events]);

  useEffect(() => {
    let isMounted = true;

    const loadMembers = async () => {
      try {
        const response = await memberAPI.getAllMembers();
        const memberList = Array.isArray(response?.members)
          ? response.members
          : Array.isArray(response)
            ? response
            : Array.isArray(response?.data?.members)
              ? response.data.members
              : [];

        if (isMounted) {
          setTotalMembersInDb(memberList.length);
        }
      } catch (error) {
        console.error("Error loading members from DB:", error);
        if (isMounted) {
          setTotalMembersInDb(0);
        }
      }
    };

    loadMembers();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadAttendance = async () => {
      setLoadingAttendance(true);
      try {
        const response = await attendanceAPI.getAllAttendance();
        const attendanceList = Array.isArray(response?.attendance)
          ? response.attendance
          : Array.isArray(response)
            ? response
            : Array.isArray(response?.data?.attendance)
              ? response.data.attendance
              : [];

        if (isMounted) {
          setLocalAttendanceLogs(attendanceList);
          setTotalAttendanceInDb(attendanceList.length);
        }
      } catch (error) {
        console.error("Error loading attendance from DB:", error);
        if (isMounted) {
          setLocalAttendanceLogs(attendanceLogs || []);
          setTotalAttendanceInDb((attendanceLogs || []).length);
        }
      } finally {
        if (isMounted) {
          setLoadingAttendance(false);
        }
      }
    };

    loadAttendance();

    return () => {
      isMounted = false;
    };
  }, [attendanceLogs]);

  const normalizeLog = (log) => {
    const memberName =
      log?.memberName || log?.member_name || log?.name || "Unknown member";
    const eventName = log?.eventName || log?.event || log?.event_name || "";
    const eventId = log?.eventId || log?.event_id || log?.eventID || "";
    const memberId = log?.memberId || log?.member_id || log?.memberID || "";
    const barangay =
      log?.barangay ||
      log?.barangayName ||
      log?.memberBarangay ||
      log?.address?.barangay ||
      log?.member?.barangay ||
      "";
    const scanTime = log?.scanTime || log?.timestamp || log?.createdAt || null;
    const status = String(log?.status || "present").toLowerCase();

    return {
      ...log,
      memberName,
      eventName,
      eventId,
      memberId,
      barangay,
      scanTime,
      status,
    };
  };

  // Filter attendance logs based on selected event and date range
  const normalizedLogs = (
    Array.isArray(localAttendanceLogs) ? localAttendanceLogs : []
  ).map(normalizeLog);

  const filteredLogs = normalizedLogs.filter((log) => {
    const matchesEvent =
      selectedEvent === "all" ||
      String(log.eventId || "") === selectedEvent ||
      log.eventName === selectedEvent;
    const matchesBarangay =
      selectedBarangay === "all" ||
      String(log.barangay || "").toLowerCase() === selectedBarangay;
    const matchesSearch = log.memberName
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    let matchesDate = true;
    if (dateRange !== "all") {
      const logDate = new Date(log.scanTime);
      const now = new Date();

      switch (dateRange) {
        case "today":
          matchesDate = logDate.toDateString() === now.toDateString();
          break;
        case "week": {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = logDate >= weekAgo;
          break;
        }
        case "month":
          matchesDate =
            logDate.getMonth() === now.getMonth() &&
            logDate.getFullYear() === now.getFullYear();
          break;
        case "year":
          matchesDate = logDate.getFullYear() === now.getFullYear();
          break;
      }
    }

    return matchesEvent && matchesBarangay && matchesSearch && matchesDate;
  });

  // Calculate statistics
  const totalAttendance = filteredLogs.length;
  const eventsCovered = localEvents.filter((event) => {
    const eventKey = String(event?.eventId || event?.id || event?._id || "");
    const eventName = String(event?.eventName || event?.name || "");

    return filteredLogs.some((log) => {
      return (
        (eventKey && String(log.eventId || "") === eventKey) ||
        (eventName && log.eventName === eventName)
      );
    });
  }).length;
  const uniqueMembers = [
    ...new Set(filteredLogs.map((log) => log.memberId || log.memberName)),
  ].length;
  const uniqueEvents = eventsCovered;
  const averagePerEvent =
    eventsCovered > 0 ? Math.round(totalAttendance / eventsCovered) : 0;

  const getEventAttendanceLogs = (event) => {
    const eventKey = String(event?.eventId || event?.id || event?._id || "");
    const eventName = String(event?.eventName || event?.name || "");

    return filteredLogs.filter((log) => {
      const matchesEvent =
        (eventKey && String(log.eventId || "") === eventKey) ||
        (eventName && log.eventName === eventName);
      const matchesStatus = log.status === "present";

      return matchesEvent && matchesStatus;
    });
  };

  // Group attendance by event for summary
  const eventSummary = localEvents.map((event) => {
    const eventName = event.eventName || event.name || "";
    const eventId = String(event.eventId || event.id || event._id || "");
    const eventLogs = getEventAttendanceLogs(event);
    return {
      ...event,
      filterKey: eventId || eventName,
      displayName: eventName,
      displayDate: event.eventDate || event.date || "",
      attendanceCount: eventLogs.length,
      uniqueAttendees: [
        ...new Set(eventLogs.map((log) => log.memberId || log.memberName)),
      ].length,
    };
  });

  const barangayOptions = [
    ...new Set(
      normalizedLogs
        .map((log) => log.barangay)
        .filter((barangay) => barangay && String(barangay).trim()),
    ),
  ].sort((a, b) => String(a).localeCompare(String(b)));

  const handleExportCSV = () => {
    const csvContent = [
      ["Member Name", "Event", "Date", "Time"],
      ...filteredLogs.map((log) => [
        log.memberName,
        log.eventName,
        formatDate(log.scanTime),
        formatTime(log.scanTime),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-report-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    try {
      // Transform the attendance logs to match the expected format
      const transformedData = filteredLogs.map((log) => ({
        scanTime: log.scanTime,
        memberId: log.memberId || "N/A",
        memberName: log.memberName,
        eventName: log.eventName,
        barangay: log.barangay || "N/A",
        status: "Present",
      }));

      const reportOptions = {
        data: transformedData,
        filters: {
          event: selectedEvent,
          eventName: selectedEvent !== "all" ? selectedEvent : null,
          search: searchTerm,
          dateRange:
            dateRange === "all"
              ? "All time"
              : dateRange === "today"
                ? "Today"
                : dateRange === "week"
                  ? "This Week"
                  : dateRange === "month"
                    ? "This Month"
                    : dateRange === "year"
                      ? "This Year"
                      : "Custom",
        },
        stats: {
          totalRecords: totalAttendance,
          uniqueMembers: uniqueMembers,
          uniqueEvents: uniqueEvents,
          presentCount: totalAttendance,
        },
        title: "Attendance Report",
        subtitle: "Secretary Dashboard - Cooperative Management System",
      };

      const result = pdfReportGenerator.generateAttendanceReport(reportOptions);

      if (result.success) {
        console.log(`PDF report generated: ${result.filename}`);
        // You could add a toast notification here if available
      }
    } catch (error) {
      console.error("Error generating PDF report:", error);
      alert("Error generating PDF report. Please try again.");
    }
  };

  // Export attendees for a specific event, optionally filtered by barangay (CSV)
  const handleExportAttendeesByBarangay = (eventObj) => {
    try {
      const eventId = String(
        eventObj.eventId || eventObj.id || eventObj._id || "",
      );
      const eventName = eventObj.eventName || eventObj.name || "";
      const barangayFilter =
        selectedBarangay && selectedBarangay !== "all"
          ? selectedBarangay.toLowerCase()
          : "";

      const eventAttendance = normalizedLogs.filter((log) => {
        const matchesEvent =
          (eventId && String(log.eventId || "") === eventId) ||
          (eventName && log.eventName === eventName);
        if (!matchesEvent) return false;
        if (!barangayFilter) return true;
        return String(log.barangay || "").toLowerCase() === barangayFilter;
      });

      if (!eventAttendance || eventAttendance.length === 0) {
        alert("No attendance records found for this event/barangay.");
        return;
      }

      const escape = (v) => {
        if (v == null) return "";
        return `"${String(v).replace(/"/g, '""')}"`;
      };

      const rows = [
        ["Member ID", "Member Name", "Barangay", "Scan Time"],
        ...eventAttendance.map((log) => [
          log.memberId || "",
          log.memberName || "",
          log.barangay || "",
          `${formatDate(log.scanTime)} ${formatTime(log.scanTime)}`,
        ]),
      ];

      const csvContent = rows.map((r) => r.map(escape).join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeEventName = eventName.replace(/\s+/g, "-").toLowerCase();
      const safeBarangay = barangayFilter
        ? String(barangayFilter).replace(/\s+/g, "-")
        : "all";
      a.download = `attendees-${safeEventName}-${safeBarangay}-${
        new Date().toISOString().split("T")[0]
      }.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting attendees by barangay:", error);
      alert("Failed to export attendees. See console for details.");
    }
  };

  // Export attendees for a specific event as PDF, optionally filtered by barangay
  const handleExportAttendeesByBarangayPDF = (eventObj) => {
    try {
      const eventId = String(
        eventObj.eventId || eventObj.id || eventObj._id || "",
      );
      const eventName = eventObj.eventName || eventObj.name || "";
      const barangayFilter =
        selectedBarangay && selectedBarangay !== "all"
          ? selectedBarangay.toLowerCase()
          : "";

      const eventAttendance = normalizedLogs.filter((log) => {
        const matchesEvent =
          (eventId && String(log.eventId || "") === eventId) ||
          (eventName && log.eventName === eventName);
        if (!matchesEvent) return false;
        if (!barangayFilter) return true;
        return String(log.barangay || "").toLowerCase() === barangayFilter;
      });

      if (!eventAttendance || eventAttendance.length === 0) {
        alert("No attendance records found for this event/barangay.");
        return;
      }

      const attendanceData = eventAttendance.map((log) => ({
        scanTime: log.scanTime,
        memberId: log.memberId || "N/A",
        memberName: log.memberName,
        eventName: log.eventName,
        barangay: log.barangay || "N/A",
        status: "Present",
      }));

      const selectedEventData = localEvents.find(
        (e) =>
          String(e.eventId || e.id || e._id || "") === eventId ||
          (e.eventName || e.name) === eventName,
      );

      const displayBarangay =
        selectedBarangay && selectedBarangay !== "all"
          ? barangayOptions.find(
              (b) => String(b).toLowerCase() === selectedBarangay,
            ) || selectedBarangay
          : null;

      const reportOptions = {
        eventData: {
          eventName: selectedEventData
            ? selectedEventData.eventName || selectedEventData.name
            : eventName,
          eventDate: selectedEventData
            ? selectedEventData.eventDate || selectedEventData.date
            : "",
          eventTime: selectedEventData
            ? selectedEventData.eventTime || selectedEventData.time || "N/A"
            : "N/A",
          location: selectedEventData ? selectedEventData.location : "",
          status: selectedEventData ? selectedEventData.status || "" : "",
          description: selectedEventData
            ? selectedEventData.description || ""
            : "",
        },
        attendanceData,
        title: `Attendees - ${eventName}`,
        subtitle: displayBarangay
          ? `Filtered by ${displayBarangay}`
          : "All barangays",
      };

      const result =
        pdfReportGenerator.generateEventSummaryReport(reportOptions);

      if (result.success) {
        console.log(`Event attendees PDF generated: ${result.filename}`);
      }
    } catch (error) {
      console.error("Error exporting attendees by barangay (PDF):", error);
      alert("Failed to export attendees PDF. See console for details.");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Attendance Reports
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            View and export attendance data
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleExportCSV}
            variant="outline"
            className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green font-semibold rounded-lg"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button
            onClick={handleExportPDF}
            className="bg-coop-green hover:bg-coop-darkGreen text-white font-semibold px-5 py-2.5 rounded-lg"
          >
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
        <CardContent className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Search Member
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-9 border-slate-200 rounded-lg"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coop-green/40 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Event
              </label>
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coop-green/30 focus:border-coop-green"
              >
                <option value="all">All Events</option>
                {localEvents.map((event) => {
                  const eventName = event.eventName || event.name || "";
                  return (
                    <option
                      key={event.eventId || event.id || event._id || eventName}
                      value={eventName}
                    >
                      {eventName}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Date Range
              </label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coop-green/30 focus:border-coop-green"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Barangay
              </label>
              <select
                value={selectedBarangay}
                onChange={(e) => setSelectedBarangay(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coop-green/30 focus:border-coop-green"
              >
                <option value="all">All Barangays</option>
                {barangayOptions.map((barangay) => (
                  <option key={barangay} value={String(barangay).toLowerCase()}>
                    {barangay}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => {
                  setSelectedEvent("all");
                  setSelectedBarangay("all");
                  setDateRange("month");
                  setSearchTerm("");
                }}
                variant="outline"
                className="w-full border-slate-200 hover:border-slate-300 text-slate-600 rounded-lg font-semibold"
              >
                <Filter className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
            <span>
              Showing <span className="font-semibold text-slate-700">{filteredLogs.length}</span> of{" "}
              <span className="font-semibold text-slate-700">{normalizedLogs.length}</span> attendance records
            </span>
            {(loadingEvents || loadingAttendance) && (
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Syncing latest data...
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-in">
        <StatCard
          title="Total Attendance"
          value={totalAttendance}
          subtitle="Total records"
          icon={Users}
        />
        <StatCard
          title="Total Members"
          value={totalMembersInDb}
          subtitle="Members in database"
          icon={Users}
        />
        <StatCard
          title="Events Covered"
          value={uniqueEvents}
          subtitle="Events with attendance"
          icon={Calendar}
          color="amber"
        />
        <StatCard
          title="Avg per Event"
          value={averagePerEvent}
          subtitle="Average attendance"
          icon={TrendingUp}
        />
      </div>

      {/* Event Summary */}
      <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-100 p-5">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-coop-green" />
            Event Summary
          </CardTitle>
          <p className="text-slate-400 text-xs mt-1">
            Attendance by event
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                    Event Name
                  </TableHead>
                  <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                    Date
                  </TableHead>
                  <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                    Total Attendance
                  </TableHead>
                  <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                    Unique Attendees
                  </TableHead>
                  <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                    Export
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="stagger-in">
                {eventSummary.map((event) => (
                  <TableRow
                    key={
                      event.eventId ||
                      event.id ||
                      event._id ||
                      event.displayName
                    }
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <TableCell className="py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {event.displayName}
                        </p>
                        <p className="text-xs text-slate-400">
                          {event.location}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          {event.displayDate
                            ? formatDate(event.displayDate)
                            : "No date"}
                        </p>
                        <p className="text-xs text-slate-400">
                          {event.displayDate
                            ? formatTime(event.displayDate)
                            : "No time"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="text-sm font-medium text-slate-700">
                        {event.attendanceCount} records
                      </span>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-700">
                          {event.uniqueAttendees} members
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportAttendeesByBarangay(event)}
                          disabled={event.attendanceCount === 0}
                          aria-label={`Export ${event.displayName} attendees as CSV`}
                          title="Export attendees (CSV)"
                          className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportAttendeesByBarangayPDF(event)}
                          disabled={event.attendanceCount === 0}
                          aria-label={`Export ${event.displayName} attendees as PDF`}
                          title="Export attendees (PDF)"
                          className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {eventSummary.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-slate-400">
                      <div className="flex flex-col items-center gap-4">
                        <BarChart3 className="w-10 h-10 text-slate-300" />
                        <div>
                          <p className="font-semibold text-slate-600">No events to summarize</p>
                          <p className="text-sm">
                            Create an event and record attendance to see it here.
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
