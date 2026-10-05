import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { RefreshCw, CalendarOff } from "lucide-react";
import { attendanceAPI, eventAPI } from "../../../services/api";
import { formatDateTime, formatTime } from "../../../utils/date";
import { Pagination, PaginationInfo } from "../../ui/pagination";

const PAGE_SIZE = 10;
const AUTO_REFRESH_MS = 45000;
// Server caps each attendance page at 100 rows, so an event with more
// attendees than that needs multiple requests to see everyone.
const ATTENDANCE_FETCH_PAGE_SIZE = 100;

const getEventKey = (event) =>
  event?.eventId || event?.id || event?._id || event?.name || event?.eventName;

const getAttendanceKey = (record) =>
  record?.memberId ||
  record?.member_id ||
  record?.member?.memberId ||
  record?.member?.member_id ||
  record?.memberName ||
  record?.name;

const getMemberDisplayName = (record) =>
  String(
    record?.memberName || record?.member_name || record?.name || "Unknown member",
  );

// Tracks who has actually checked in to the active event — not a full
// member roster with synthesized "Absent" rows for everyone who hasn't
// scanned yet. A present/absent breakdown against the whole membership
// belongs on the event's own report (see EventAttendeesPanel), not here;
// this is purely a live feed of real check-ins as they happen.
export default function LiveAttendanceList({
  attendanceLogs: propAttendanceLogs = [],
  initialLogs = [],
  events: propEvents = [],
  initialEvents = [],
  currentEvent = null,
  onRefresh,
}) {
  const attendanceLogsSource = propAttendanceLogs.length
    ? propAttendanceLogs
    : initialLogs;
  const eventsSource = propEvents.length ? propEvents : initialEvents;
  const [attendanceLogs, setAttendanceLogs] = useState(attendanceLogsSource);
  const [events, setEvents] = useState(eventsSource);
  const [loading, setLoading] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const isRefreshingRef = useRef(false);

  // Returns the fetched events so handleRefresh can resolve "which event is
  // active" synchronously, instead of reading back from `events` state
  // (which wouldn't reflect this fetch until the next render).
  const fetchEventsFromDB = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const response = await eventAPI.getAllEvents();
      const allEvents = Array.isArray(response)
        ? response
        : Array.isArray(response?.events)
          ? response.events
          : Array.isArray(response?.data?.events)
            ? response.data.events
            : [];
      setEvents(allEvents);
      return allEvents;
    } catch (eventError) {
      console.error("Error fetching events:", eventError);
      setError(eventError?.message || "Unable to load events.");
      return [];
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  // Pulls every attendance record for one event via the dedicated per-event
  // endpoint, paging through it in full — the generic "all attendance"
  // endpoint (and the attendanceLogs prop, sourced from it) only ever
  // returns the 10 most recent records *across every event combined*, so
  // any event with more than a handful of check-ins would have its older
  // attendees quietly fall out of view.
  const fetchEventAttendance = useCallback(async (eventId) => {
    if (!eventId) return [];
    let page = 1;
    let totalPages = 1;
    let allRecords = [];
    try {
      do {
        const response = await attendanceAPI.getAttendanceByEvent(eventId, {
          page,
          limit: ATTENDANCE_FETCH_PAGE_SIZE,
        });
        allRecords = allRecords.concat(
          Array.isArray(response?.attendance) ? response.attendance : [],
        );
        totalPages = response?.pagination?.totalPages || 1;
        page += 1;
      } while (page <= totalPages);
    } catch (fetchError) {
      console.error("Error fetching event attendance:", fetchError);
      setError(
        fetchError?.message || "Unable to load attendance for this event.",
      );
    }
    return allRecords;
  }, []);

  // Seed events from props (attendance is refetched per-event below, so it
  // doesn't need the same treatment — the prop is still capped at 10).
  useEffect(() => {
    if (eventsSource.length > 0) {
      setEvents(eventsSource);
    }
  }, [eventsSource]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setLoading(true);
    setError("");
    try {
      const fetchedEvents = await fetchEventsFromDB();

      // Mirrors the activeEvent memo below, but resolved from the events we
      // just fetched rather than state (which hasn't re-rendered yet).
      const currentEventKey = String(getEventKey(currentEvent) || "").trim();
      const resolvedEvent = currentEventKey
        ? currentEvent
        : fetchedEvents.find(
            (event) => String(event?.status || "").toLowerCase() === "active",
          ) || null;
      const resolvedEventKey = String(getEventKey(resolvedEvent) || "").trim();

      setAttendanceLogs(
        resolvedEventKey ? await fetchEventAttendance(resolvedEventKey) : [],
      );

      if (typeof onRefresh === "function") {
        onRefresh();
      }
      setLastRefreshedAt(new Date());
    } finally {
      setLoading(false);
      isRefreshingRef.current = false;
    }
  }, [fetchEventsFromDB, fetchEventAttendance, currentEvent, onRefresh]);

  useEffect(() => {
    handleRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the "live" promise: quietly refresh in the background while the tab
  // is actually visible, so the secretary doesn't have to click Refresh.
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        handleRefresh();
      }
    }, AUTO_REFRESH_MS);

    return () => clearInterval(interval);
  }, [handleRefresh]);

  const activeEvent = useMemo(() => {
    const currentEventKey = String(getEventKey(currentEvent) || "").trim();
    if (currentEventKey) {
      return currentEvent;
    }

    const eventWithActiveStatus = events.find(
      (event) => String(event?.status || "").toLowerCase() === "active",
    );

    if (eventWithActiveStatus) {
      return eventWithActiveStatus;
    }

    return null;
  }, [currentEvent, events]);

  const activeEventKey = useMemo(() => {
    return String(getEventKey(activeEvent) || "").trim();
  }, [activeEvent]);

  const selectedEventLabel = useMemo(() => {
    if (!activeEvent) {
      return "No active event";
    }

    return activeEvent?.eventName || activeEvent?.name || "Active event";
  }, [activeEvent]);

  const liveRows = useMemo(() => {
    return attendanceLogs
      .filter((record) => {
        const recordEventKey = String(
          record.eventId ||
            record.event_id ||
            record.event ||
            record.eventName ||
            "",
        );
        return recordEventKey === activeEventKey;
      })
      .map((record) => ({
        recordId: record._id || getAttendanceKey(record),
        memberKey: String(getAttendanceKey(record) || ""),
        memberName: getMemberDisplayName(record),
        memberId: record.memberId || record.member_id || "",
        barangay:
          record.barangay || record.barangayName || record.barangay_name || "",
        scanTime:
          record.scanTime || record.timestamp || record.createdAt || null,
      }));
  }, [attendanceLogs, activeEventKey]);

  const availableBarangays = useMemo(() => {
    const barangays = new Set();
    liveRows.forEach((row) => {
      if (row.barangay) barangays.add(row.barangay);
    });
    return ["all", ...Array.from(barangays).sort()];
  }, [liveRows]);

  const filteredAttendance = useMemo(() => {
    return liveRows.filter(
      (row) => selectedBarangay === "all" || row.barangay === selectedBarangay,
    );
  }, [liveRows, selectedBarangay]);

  // Reset to page 1 whenever the visible dataset would change underneath the reader
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedBarangay, activeEventKey]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAttendance.length / PAGE_SIZE),
  );
  const safePage = Math.min(currentPage, totalPages);

  // Clamp back onto a valid page if filtering shrank the result set out from under us
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedAttendance = useMemo(
    () =>
      filteredAttendance.slice(
        (safePage - 1) * PAGE_SIZE,
        safePage * PAGE_SIZE,
      ),
    [filteredAttendance, safePage],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            LIVE ATTENDANCE
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Members checking in to the active event, in real time.
          </p>
          <div
            className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${
              activeEvent
                ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                : "bg-red-50 text-red-700 ring-red-100"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                activeEvent ? "bg-emerald-500" : "bg-red-500"
              }`}
            />
            Active event: {selectedEventLabel}
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading || loadingEvents}
          className="inline-flex items-center gap-2 rounded-lg bg-coop-green px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-coop-darkGreen active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coop-green/50"
        >
          <RefreshCw
            className={`w-4 h-4 transition-transform ${loading || loadingEvents ? "animate-spin" : ""}`}
          />
          {loading || loadingEvents ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {!activeEvent && !loading && !loadingEvents ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-10 text-center">
          <CalendarOff className="w-10 h-10 text-slate-300 mx-auto mb-4" />
          <p className="font-semibold text-slate-600">
            No active event right now
          </p>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            Presence can only be tracked while an event is active. Start an
            event from Event Management to see live check-ins here.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-col gap-4 px-6 py-4 border-b border-slate-200 bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Members present
              </p>
              <p className="text-2xl font-bold text-slate-900">
                {filteredAttendance.length}
              </p>
            </div>
            <span className="self-start rounded-full bg-green-50 px-3 py-1 text-sm font-semibold text-coop-green">
              Present: {filteredAttendance.length}
            </span>
          </div>

          <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                Filter by barangay
                <select
                  value={selectedBarangay}
                  onChange={(e) => setSelectedBarangay(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-coop-green focus:outline-none focus:ring-2 focus:ring-coop-green/20"
                >
                  {availableBarangays.map((barangay) => (
                    <option key={barangay} value={barangay}>
                      {barangay === "all" ? "All barangays" : barangay}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-1.5 text-sm font-semibold text-slate-700">
                <span className="block text-slate-400 font-medium">
                  Showing
                </span>
                <div className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700">
                  {filteredAttendance.length} check-in
                  {filteredAttendance.length === 1 ? "" : "s"}
                </div>
              </div>

              <div className="space-y-1.5 text-sm font-semibold text-slate-700">
                <span className="block text-slate-400 font-medium">
                  Last refresh
                </span>
                <div className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700">
                  {loading
                    ? "Refreshing..."
                    : lastRefreshedAt
                      ? formatTime(lastRefreshedAt)
                      : "Never"}
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-600">
              <thead className="bg-white">
                <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wide text-xs font-semibold">
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Barangay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white stagger-in">
                {paginatedAttendance.length > 0 ? (
                  paginatedAttendance.map((row) => {
                    const timeLabel = row.scanTime
                      ? formatDateTime(row.scanTime)
                      : "Unknown time";

                    return (
                      <tr
                        key={row.recordId || row.memberKey}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          <div>
                            <div className="font-semibold text-slate-900">
                              {row.memberName}
                            </div>
                            <div className="text-xs text-slate-400">
                              ID: {row.memberId || row.memberKey || "N/A"}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {timeLabel}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {row.barangay || "Unassigned"}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan="3"
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No check-ins yet for this event.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredAttendance.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <PaginationInfo
                currentPage={safePage}
                limit={PAGE_SIZE}
                total={filteredAttendance.length}
              />
              <Pagination
                currentPage={safePage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                hasPrevPage={safePage > 1}
                hasNextPage={safePage < totalPages}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
