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
  Eye,
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
  const [_loadingAttendance, setLoadingAttendance] = useState(false);
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
  }, [events, loadingEvents]);

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

  const handleExportEventSummary = (eventName) => {
    try {
      const selectedEventData = localEvents.find(
        (e) => (e.eventName || e.name) === eventName,
      );
      const eventAttendance = filteredLogs
        .filter((log) => log.eventName === eventName)
        .map((log) => ({
          scanTime: log.scanTime,
          memberId: log.memberId || "N/A",
          memberName: log.memberName,
          eventName: log.eventName,
          barangay: log.barangay || "N/A",
          status: "Present",
        }));

      if (!selectedEventData) {
        alert("Event data not found");
        return;
      }

      const reportOptions = {
        eventData: {
          eventName: selectedEventData.eventName || selectedEventData.name,
          eventDate: selectedEventData.eventDate || selectedEventData.date,
          eventTime:
            selectedEventData.eventTime || selectedEventData.time || "N/A",
          location: selectedEventData.location,
          status: selectedEventData.status || "completed",
          description: selectedEventData.description || "",
        },
        attendanceData: eventAttendance,
        title: "Event Summary Report",
        subtitle: `${selectedEventData.eventName || selectedEventData.name} - Detailed Attendance Analysis`,
      };

      const result =
        pdfReportGenerator.generateEventSummaryReport(reportOptions);

      if (result.success) {
        console.log(`Event summary PDF generated: ${result.filename}`);
      }
    } catch (error) {
      console.error("Error generating event summary PDF:", error);
      alert("Error generating event summary. Please try again.");
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
          <h1 className="text-3xl font-black text-slate-950 tracking-tight">
            Attendance Reports
          </h1>
          <p className="text-slate-500 text-sm font-bold mt-1">
            View and export attendance data
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleExportCSV}
            variant="outline"
            className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green font-bold rounded-xl"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button
            onClick={handleExportPDF}
            className="bg-coop-green hover:bg-coop-darkGreen text-white font-black px-6 py-3 rounded-2xl shadow-lg shadow-green-200"
          >
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-slate-200/60 shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Search Member
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search members..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-slate-200 rounded-xl"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Event
              </label>
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-coop-green focus:border-transparent"
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
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Date Range
              </label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-coop-green focus:border-transparent"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Barangay
              </label>
              <select
                value={selectedBarangay}
                onChange={(e) => setSelectedBarangay(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-coop-green focus:border-transparent"
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
                className="w-full border-slate-200 hover:border-slate-300 text-slate-600 rounded-xl font-bold"
              >
                <Filter className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          {
            label: "Total Attendance",
            value: totalAttendance,
            icon: Users,
            color: "text-coop-green",
            bg: "bg-green-50",
            description: "Total records",
          },
          {
            label: "Total Members",
            value: totalMembersInDb,
            icon: Users,
            color: "text-coop-green",
            bg: "bg-green-50",
            description: "Members in database",
          },
          {
            label: "Events Covered",
            value: uniqueEvents,
            icon: Calendar,
            color: "text-coop-yellow",
            bg: "bg-yellow-50",
            description: "Events with attendance",
          },
          {
            label: "Avg per Event",
            value: averagePerEvent,
            icon: TrendingUp,
            color: "text-coop-green",
            bg: "bg-green-50",
            description: "Average attendance",
          },
        ].map((stat) => (
          <Card
            key={stat.label}
            className="p-6 border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] bg-white group hover:border-green-200 transition-all relative overflow-hidden"
          >
            <div
              className={`absolute top-0 right-0 w-20 h-20 ${stat.bg} rounded-full -mr-10 -mt-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
            />
            <div className="flex items-start justify-between relative z-10">
              <div className="flex-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                  {stat.label}
                </p>
                <h3 className="text-2xl font-black text-slate-950 tracking-tighter mb-1">
                  {stat.value}
                </h3>
                <p className="text-[10px] text-slate-500 font-bold">
                  {stat.description}
                </p>
              </div>
              <div
                className={`p-3 ${stat.bg} rounded-xl group-hover:scale-110 transition-transform duration-500`}
              >
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Event Summary */}
      <Card className="border-slate-200/60 shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-50 p-6">
          <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-coop-green" />
            Event Summary
          </CardTitle>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
            Attendance by event
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">
                    Event Name
                  </TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">
                    Date
                  </TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">
                    Total Attendance
                  </TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">
                    Unique Attendees
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
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
                    <TableCell className="py-4">
                      <div>
                        <p className="text-sm font-black text-slate-900">
                          {event.displayName}
                        </p>
                        <p className="text-xs text-slate-500 font-bold">
                          {event.location}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {event.displayDate
                            ? formatDate(event.displayDate)
                            : "No date"}
                        </p>
                        <p className="text-xs text-slate-500 font-bold">
                          {event.displayDate
                            ? formatTime(event.displayDate)
                            : "No time"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <span className="text-xs font-black text-coop-green">
                            {event.attendanceCount}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-slate-900">
                          {event.attendanceCount} records
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-bold text-slate-900">
                          {event.uniqueAttendees} members
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
