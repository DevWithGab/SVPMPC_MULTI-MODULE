import React, { useState, useEffect } from "react";
import {
  BarChart3,
  Download,
  Users,
  Filter,
  FileText,
  Loader2,
  ChevronRight,
  ArrowLeft,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";
import { EventAttendeesPanel } from "../shared";
import { createAttendanceReportPdf, matchesAttendancePeriod, attendancePeriods } from "../../../utils/attendanceReport";
import { loadReportLogo } from "../../../utils/mortuaryReportPdf";
import './AttendanceReports.css';
import { attendanceAPI, eventAPI, memberAPI } from "../../../services/api";
import { formatDate, formatTime } from "../../../utils/date";

// GET /attendance is paginated server-side (default 10, capped at 100 per
// page) — fetching once with no params silently truncated this screen's
// counts, CSV and PDF exports to just the 10 most-recently-scanned records
// system-wide, so most events' attendance (and their scan times) never made
// it into the export. Page through everything instead, same loop
// LiveAttendanceList's fetchEventAttendance already uses for this reason.
const ATTENDANCE_FETCH_PAGE_SIZE = 100;

// Excel auto-detects a date/time-looking CSV cell and reformats it as a date
// serial, which keeps the column at its narrow default width regardless of
// the text's actual length — showing "####" until the viewer manually
// widens it. Wrapping the value as an Excel text-formula ("="...") makes
// Excel display it as plain text instead, at a width that fits the content.
const excelText = (value) => `="${String(value ?? "").replace(/"/g, '""')}"`;

// Standard CSV field quoting (RFC 4180) — wraps every field in double quotes
// and escapes internal ones, so values containing commas (like "Oct 2, 2026")
// don't get misread as extra columns.
const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export default function AttendanceReports({ attendanceLogs, events }) {
  const [selectedEvent, setSelectedEvent] = useState("all");
  const [selectedBarangay, setSelectedBarangay] = useState("all");
  const [dateRange, setDateRange] = useState("month");
  const [localEvents, setLocalEvents] = useState(events || []);
  const [localAttendanceLogs, setLocalAttendanceLogs] = useState(
    attendanceLogs || [],
  );
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [allMembers, setAllMembers] = useState([]);
  const [viewingEvent, setViewingEvent] = useState(null);
  const [loadErrors, setLoadErrors] = useState({});
  const [reload, setReload] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLocalEvents(events || []);
  }, [events]);

  useEffect(() => {
    setLocalAttendanceLogs(attendanceLogs || []);
  }, [attendanceLogs]);

  useEffect(() => {
    const loadEvents = async () => {
      setLoadingEvents(true);
      setLoadErrors(errors => ({ ...errors, events: false }));
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
        setLoadErrors(errors => ({ ...errors, events: true }));
      } finally {
        setLoadingEvents(false);
      }
    };

    loadEvents();
  }, [events, reload]);

  useEffect(() => {
    let isMounted = true;

    const loadMembers = async () => {
      setLoadingMembers(true);
      setLoadErrors(errors => ({ ...errors, members: false }));
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
          setAllMembers(memberList);
        }
      } catch (error) {
        console.error("Error loading members from DB:", error);
        if (isMounted) {
          setLoadErrors(errors => ({ ...errors, members: true }));
          setAllMembers([]);
        }
      } finally {
        if (isMounted) setLoadingMembers(false);
      }
    };

    loadMembers();

    return () => {
      isMounted = false;
    };
  }, [reload]);

  useEffect(() => {
    let isMounted = true;

    const loadAttendance = async () => {
      setLoadingAttendance(true);
      setLoadErrors(errors => ({ ...errors, attendance: false }));
      try {
        let page = 1;
        let totalPages = 1;
        let attendanceList = [];
        do {
          const response = await attendanceAPI.getAllAttendance({
            page,
            limit: ATTENDANCE_FETCH_PAGE_SIZE,
          });
          attendanceList = attendanceList.concat(
            Array.isArray(response?.attendance) ? response.attendance : [],
          );
          totalPages = response?.pagination?.totalPages || 1;
          page += 1;
        } while (page <= totalPages);

        if (isMounted) {
          setLocalAttendanceLogs(attendanceList);
        }
      } catch (error) {
        console.error("Error loading attendance from DB:", error);
        if (isMounted) {
          setLoadErrors(errors => ({ ...errors, attendance: true }));
          setLocalAttendanceLogs(attendanceLogs || []);
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
  }, [attendanceLogs, reload]);

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

  const selectedEventData = localEvents.find(event => String(event.eventId || event.id || event._id || event.eventName || event.name) === selectedEvent);
  const matchesEventLog = (log, event) => log.eventId
    ? String(log.eventId) === String(event.eventId || event.id || event._id || '')
    : log.eventName === (event.eventName || event.name);

  const filteredLogs = normalizedLogs.filter((log) => {
    const matchesEvent =
      selectedEvent === "all" ||
      (selectedEventData && matchesEventLog(log, selectedEventData));
    const matchesBarangay =
      selectedBarangay === "all" ||
      String(log.barangay || "").toLowerCase() === selectedBarangay;

    const matchesDate = matchesAttendancePeriod(log.scanTime, dateRange);

    return matchesEvent && matchesBarangay && matchesDate;
  });

  // Calculate statistics
  const totalAttendance = filteredLogs.length;
  const eventsCovered = new Set(filteredLogs.map(log => String(log.eventId || log.eventName))).size;
  const uniqueMembers = [
    ...new Set(filteredLogs.map((log) => String(log.memberId || log.memberName))),
  ].length;
  const uniqueEvents = eventsCovered;
  const averagePerEvent =
    eventsCovered > 0 ? Math.round(totalAttendance / eventsCovered) : 0;

  const getEventAttendanceLogs = (event) => {
    return filteredLogs.filter(log => matchesEventLog(log, event));
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
        ...new Set(eventLogs.map((log) => String(log.memberId || log.memberName))),
      ].length,
    };
  }).filter(event =>
    (selectedEvent === 'all' || event.filterKey === selectedEvent || event.displayName === selectedEvent) &&
    (event.attendanceCount > 0 || (selectedBarangay === 'all' && matchesAttendancePeriod(event.displayDate, dateRange))) &&
    [event.displayName, event.location].join(' ').toLowerCase().includes(search.trim().toLowerCase())
  ).sort((a, b) => (new Date(b.displayDate).getTime() || 0) - (new Date(a.displayDate).getTime() || 0));

  const barangayOptions = [
    ...new Set(
      normalizedLogs
        .map((log) => log.barangay)
        .filter((barangay) => barangay && String(barangay).trim()),
    ),
  ].sort((a, b) => String(a).localeCompare(String(b)));

  const reportLoading = loadingEvents || loadingAttendance || loadingMembers;
  const reportError = Object.values(loadErrors).some(Boolean);
  const exportDisabled = reportLoading || reportError || exporting || !filteredLogs.length;
  const eventLabel = selectedEventData ? selectedEventData.eventName || selectedEventData.name : 'All events';
  const barangayLabel = selectedBarangay === 'all' ? 'All barangays' : barangayOptions.find(value => String(value).toLowerCase() === selectedBarangay) || selectedBarangay;
  const scope = [attendancePeriods[dateRange], eventLabel, barangayLabel].join(' · ');
  const totalPages = Math.max(1, Math.ceil(eventSummary.length / 10));
  const currentPage = Math.min(page, totalPages);

  const exportRecords = async (type, event) => {
    if (exportDisabled) return;
    const records = event ? getEventAttendanceLogs(event) : filteredLogs;
    if (!records.length) return;
    setExporting(true);
    setFeedback(null);
    const reportScope = event ? [attendancePeriods[dateRange], event.eventName || event.name, barangayLabel].join(' · ') : scope;
    const filename = 'attendance-' + (event ? String(event.eventName || event.name).replace(/[^a-z0-9]+/gi, '-').slice(0, 60) : 'report') + '-' + new Date().toISOString().slice(0, 10);
    try {
      if (type === 'pdf') {
        const logo = await loadReportLogo();
        createAttendanceReportPdf({ logs: records, scope: reportScope, logo }).save(filename + '.pdf');
      } else {
        const rows = [['Passbook Number', 'Member Name', 'Barangay', 'Event', 'Date (PHT)', 'Time (PHT)', 'Status'],
          ...records.map(log => [log.memberId, log.memberName, log.barangay, log.eventName,
            log.scanTime ? excelText(formatDate(log.scanTime)) : 'Not recorded',
            log.scanTime ? excelText(formatTime(log.scanTime)) : 'Not recorded', log.status])];
        const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
        const link = document.createElement('a');
        link.href = url; link.download = filename + '.csv';
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setFeedback({ message: type.toUpperCase() + ' download prepared with ' + records.length.toLocaleString() + ' records.' });
    } catch (error) {
      setFeedback({ error: true, message: error.message || 'Unable to export. Please try again.' });
    } finally { setExporting(false); }
  };
  const handleExportCSV = () => exportRecords('csv');
  const handleExportPDF = () => exportRecords('pdf');
  const handleExportAttendeesByBarangay = event => exportRecords('csv', event);
  const handleExportAttendeesByBarangayPDF = event => exportRecords('pdf', event);

  // Clicking an event replaces this whole screen with its own page (not a
  // modal, not an inline-expanding row) — a dedicated place to search for a
  // specific member and see present/absent, with a way back to the report.
  if (viewingEvent) {
    return (
      <div className="attendance-reports space-y-6 pb-12">
        <button
          onClick={() => setViewingEvent(null)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-coop-green transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Reports
        </button>
        <p className="ar-scope">Full event attendance · All dates and barangays. Absence is based on active membership.</p>
        <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
          <EventAttendeesPanel
            event={viewingEvent}
            presentLogs={viewingEvent.presentLogs}
            allMembers={allMembers}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="attendance-reports space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <p className="ar-eyebrow">Attendance management / Reports</p>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Attendance Reports
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Review participation and prepare official attendance records.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleExportCSV}
            disabled={exportDisabled}
            variant="outline"
            className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green font-semibold rounded-lg"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button
            onClick={handleExportPDF}
            disabled={exportDisabled}
            className="bg-coop-green hover:bg-coop-darkGreen text-white font-semibold px-5 py-2.5 rounded-lg"
          >
            <FileText className="w-4 h-4 mr-2" />
            {exporting ? 'Preparing export…' : 'Export PDF'}
          </Button>
        </div>
      </div>

      {reportError && <div role="alert" className="ar-notice ar-error">Unable to load the complete report. Retry before exporting.<button className="ar-button" onClick={() => setReload(value => value + 1)}>Retry</button></div>}
      {feedback && <div role={feedback.error ? 'alert' : 'status'} className={feedback.error ? 'ar-notice ar-error' : 'ar-notice'}>{feedback.message}</div>}
      {/* Filters */}
      <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
        <CardContent className="p-5 space-y-4">
          <div className="ar-filter-heading"><h2>Report scope</h2><span>Applies to totals and exports</span></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="ar-event" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Event
              </label>
              <select
                id="ar-event"
                value={selectedEvent}
                onChange={(e) => { setSelectedEvent(e.target.value); setPage(1); setFeedback(null); }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coop-green/30 focus:border-coop-green"
              >
                <option value="all">All Events</option>
                {localEvents.map((event) => {
                  const eventName = event.eventName || event.name || "";
                  return (
                    <option
                      key={event.eventId || event.id || event._id || eventName}
                      value={String(event.eventId || event.id || event._id || eventName)}
                    >
                      {eventName}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label htmlFor="ar-period" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Date Range
              </label>
              <select
                id="ar-period"
                value={dateRange}
                onChange={(e) => { setDateRange(e.target.value); setPage(1); setFeedback(null); }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coop-green/30 focus:border-coop-green"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 days</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>
            </div>
            <div>
              <label htmlFor="ar-barangay" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Barangay
              </label>
              <select
                id="ar-barangay"
                value={selectedBarangay}
                onChange={(e) => { setSelectedBarangay(e.target.value); setPage(1); setFeedback(null); }}
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
                  setSearch(''); setPage(1); setFeedback(null);
                }}
                variant="outline"
                className="w-full border-slate-200 hover:border-slate-300 text-slate-600 rounded-lg font-semibold"
              >
                <Filter className="w-4 h-4 mr-2" />
                Reset filters
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
            <span>
              Showing{" "}
              <span className="font-semibold text-slate-700">
                {filteredLogs.length}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-700">
                {normalizedLogs.length}
              </span>{" "}
              attendance records
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

      <section className="ar-metrics" aria-label="Report summary" aria-busy={reportLoading}>
        {[
          ['Attendance records', totalAttendance, 'Scans in the selected scope'],
          ['Unique attendees', uniqueMembers, 'Distinct members represented'],
          ['Events represented', uniqueEvents, 'Events with attendance records'],
          ['Average per event', averagePerEvent, 'Records per represented event'],
        ].map(([label, value, note]) => <div key={label}><p>{label}</p><strong>{reportLoading || reportError ? '—' : value.toLocaleString()}</strong><span>{note}</span></div>)}
      </section>

      {/* Event Summary */}
      <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-100 p-5">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-coop-green" />
            Attendance by event
          </CardTitle>
          <p className="text-slate-500 text-xs mt-1">Open an event to review its full member attendance.</p>
          <label className="ar-search"><Search size={16} /><span className="sr-only">Search events or locations</span><input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search events or locations" /></label>
        </CardHeader>
        <div className="ar-scope"><span>{scope}</span><span>All times in Philippine time (PHT)</span></div>
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
                    Attendees
                  </TableHead>
                  <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                    Export
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="stagger-in">
                {!reportLoading && !reportError && eventSummary.slice((currentPage - 1) * 10, currentPage * 10).map((event) => {
                  const eventKey =
                    event.eventId || event.id || event._id || event.displayName;
                  return (
                    <TableRow
                      key={eventKey}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <TableCell className="py-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {event.displayName}
                          </p>
                          <button className="ar-view" onClick={() => setViewingEvent({ name: event.displayName, date: event.displayDate,
                            presentLogs: normalizedLogs.filter(log => (log.eventId ? String(log.eventId) === event.filterKey : log.eventName === event.displayName) && log.status === 'present') })}>View attendees <ChevronRight size={14} /></button>
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

                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="text-sm font-medium text-slate-700">
                          {event.attendanceCount} records
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-slate-400" />
                            <span className="text-sm font-medium text-slate-700">
                              {event.uniqueAttendees} members
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExportAttendeesByBarangay(event)}
                            disabled={exportDisabled || event.attendanceCount === 0}
                            aria-label={`Export ${event.displayName} attendees as CSV`}
                            title="Export attendees (CSV)"
                            className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Download className="w-4 h-4 mr-1.5" /> CSV
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleExportAttendeesByBarangayPDF(event)
                            }
                            disabled={exportDisabled || event.attendanceCount === 0}
                            aria-label={`Export ${event.displayName} attendees as PDF`}
                            title="Export attendees (PDF)"
                            className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <FileText className="w-4 h-4 mr-1.5" /> PDF
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(reportLoading || reportError) && <TableRow><TableCell colSpan={5}><div className="ar-empty" role="status">{reportLoading && <Loader2 className="animate-spin" />}<strong>{reportLoading ? 'Loading complete attendance records…' : 'Report unavailable'}</strong><p>{reportLoading ? 'Gathering all pages for accurate totals and exports.' : 'Retry loading the report to continue.'}</p></div></TableCell></TableRow>}
                {!reportLoading && !reportError && eventSummary.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-12 text-slate-400"
                    >
                      <div className="flex flex-col items-center gap-4">
                        <BarChart3 className="w-10 h-10 text-slate-300" />
                        <div>
                          <p className="font-semibold text-slate-600">
                            No events match this view
                          </p>
                          <p className="text-sm">
                            Try another period, barangay, or search term.
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="ar-pagination"><span>{eventSummary.length} events · Search narrows this table. Exports use the report scope.</span><div><button className="ar-button" disabled={currentPage === 1 || reportLoading} onClick={() => setPage(currentPage - 1)}>Previous</button><span aria-live="polite">{currentPage} / {totalPages}</span><button className="ar-button" disabled={currentPage === totalPages || reportLoading} onClick={() => setPage(currentPage + 1)}>Next</button></div></div>
        </CardContent>
      </Card>
    </div>
  );
}
