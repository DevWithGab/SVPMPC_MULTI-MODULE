import { PageHeader } from '../../ui/workspace';
import { Select } from '../../ui/input';
import { Table as DataTable } from '../../ui/table';
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { RefreshCw, CalendarOff } from "lucide-react";
import { attendanceAPI, eventAPI } from "../../../services/api";
import { formatDateTime, formatTime } from "../../../utils/date";
import { Pagination, PaginationInfo } from "../../ui/pagination";
import LiveAttendanceView from "../secretary/LiveAttendanceView";
import { loadDashboardRecords } from "../../../utils/attendanceDashboard";
import { ATTENDANCE_UPDATED_EVENT, ATTENDANCE_UPDATED_KEY } from "../../../utils/attendanceUpdates";
import { canScanEvent } from "../../../utils/scannerSchedule";
import { attendanceScannedBy } from '../../../utils/attendanceScannedBy';

const PAGE_SIZE = 100;
const AUTO_REFRESH_MS = 3000;
const EVENT_REFRESH_MS = 10000;
const EMPTY_RECORDS = [];
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
    record?.memberName ||
      record?.member_name ||
      record?.name ||
      "Unknown member",
  );

/* Ang event.status ay bago lang kasing-bago ng huling events fetch (tignan
ang EVENT_REFRESH_MS sa baba) at ng sariling background sweep ng server, na
nagpapalit ng stored status ng tapos na event papuntang "closed" na may
delay na up to 60 seconds - kaya kung iyon lang ang paniniwalaan, pwedeng
magpakita pa ng "Active event" kahit ilang minuto na pasado ang actual end
time ng event. Yung canScanEvent ang nagre-rederive ng openness base sa
sariling schedule ng event laban sa current clock (parehong check na
ginagamit kung tatanggapin talaga ang scan), kaya tama ang oras ng
pagsara ng list na ito kahit gaano pa katagal ang stale ng persisted
status. */
const resolveActiveEvent = (events, preferredKey, now = Date.now()) => {
  const active = events.filter(event => canScanEvent(event, now));
  return active.find(event => String(getEventKey(event)) === preferredKey) || active[0] || null;
};

/* Tinatrack dito yung mga totoong naka-check-in na sa active event - hindi
full member roster na may synthesized "Absent" rows para sa lahat na
hindi pa nag-scan. Yung present/absent breakdown laban sa buong membership
ay nasa sariling report ng event (tignan sa EventAttendeesPanel), hindi
dito; ito ay purong live feed lang ng totoong check-ins habang
nangyayari. */
export default function LiveAttendanceList({
  attendanceLogs: propAttendanceLogs = EMPTY_RECORDS,
  initialLogs = EMPTY_RECORDS,
  events: propEvents = EMPTY_RECORDS,
  initialEvents = EMPTY_RECORDS,
  currentEvent = null,
  onRefresh,
  variant = "default",
}) {
  const attendanceLogsSource = propAttendanceLogs.length
    ? propAttendanceLogs
    : initialLogs;
  const eventsSource = propEvents.length ? propEvents : initialEvents;
  const [attendanceLogs, setAttendanceLogs] = useState(attendanceLogsSource);
  const [events, setEvents] = useState(eventsSource);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  /* Tumitick ito kasabay ng AUTO_REFRESH_MS interval sa baba, para lang
  mare-evaluate ulit ang activeEvent (sa baba) laban sa fresh clock kahit
  sa pagitan ng mga totoong event refetches (na nangyayari lang kahit
  pinakamadalas every EVENT_REFRESH_MS) - kung hindi, isang event na lagpas
  na sa exact end time niya ay magpapatuloy ipakita bilang active hanggang
  sa susunod na refetch na tumama pagkatapos nito. */
  const [now, setNow] = useState(Date.now);
  const isRefreshingRef = useRef(false);
  const queuedRefreshRef = useRef(null);
  const refreshRef = useRef(null);
  const mountedRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const eventsRef = useRef(eventsSource);
  const lastEventsFetchRef = useRef(0);
  const preferredEventKey = String(getEventKey(currentEvent) || "").trim();
  const optionsRef = useRef({ preferredEventKey, onRefresh });

  useEffect(() => {
    optionsRef.current = { preferredEventKey, onRefresh };
  }, [preferredEventKey, onRefresh]);

  const fetchEventsFromDB = useCallback(
    () => loadDashboardRecords(eventAPI.getEvents, 'events'),
    [],
  );
  const fetchEventAttendance = useCallback(
    eventId => loadDashboardRecords(
      params => attendanceAPI.getAttendanceByEvent(eventId, params), 'attendance',
    ),
    [],
  );

  const handleRefresh = useCallback(async ({ background = false, refreshEvents = false } = {}) => {
    if (isRefreshingRef.current) {
      /* Kapag may scan na dumating habang may existing request pa, kailangan
      nito ng follow-up, imbes na mawala o magsimula ng overlapping/stale
      request. */
      queuedRefreshRef.current = {
        background: background && (queuedRefreshRef.current?.background ?? true),
        refreshEvents: refreshEvents || Boolean(queuedRefreshRef.current?.refreshEvents),
      };
      return;
    }
    isRefreshingRef.current = true;
    if (!background || !hasLoadedRef.current) setLoading(true);
    const requestedEventKey = optionsRef.current.preferredEventKey;
    try {
      let freshEvents = eventsRef.current;
      if (!background || refreshEvents || !lastEventsFetchRef.current ||
          !resolveActiveEvent(freshEvents, requestedEventKey) ||
          Date.now() - lastEventsFetchRef.current >= EVENT_REFRESH_MS) {
        freshEvents = await fetchEventsFromDB();
        if (!mountedRef.current) return;
        eventsRef.current = freshEvents;
        lastEventsFetchRef.current = Date.now();
      }
      const active = resolveActiveEvent(freshEvents, requestedEventKey);
      const eventId = String(getEventKey(active) || "").trim();
      const records = eventId ? await fetchEventAttendance(eventId) : [];
      if (!mountedRef.current) return;
      if (requestedEventKey !== optionsRef.current.preferredEventKey) {
        queuedRefreshRef.current = { background: true, refreshEvents: true };
        return;
      }
      /* Commit lang kapag complete at successful ang results. Isang failed
      na susunod na page ay hindi dapat palitan ang huling magandang list ng
      partial o walang laman na attendance. */
      setEvents(freshEvents);
      /* Pwedeng lumipat ang page boundaries habang on-going pa ang
      multi-page fetch dahil sa mga bagong scan. Isang member ay dapat
      lumitaw lang isang beses para sa event na ito. */
      const uniqueRecords = new Map(records.map(record => [getAttendanceKey(record), record]));
      setAttendanceLogs([...uniqueRecords.values()]);
      setError("");
      setLastRefreshedAt(new Date());
      hasLoadedRef.current = true;
      /* Pwedeng isama ng parent reloads ang lahat ng member at lahat ng
      event. I-keep lang ito sa explicit Refresh, hindi sa bawat background
      attendance update. */
      if (!background && typeof optionsRef.current.onRefresh === "function") {
        Promise.resolve().then(() => optionsRef.current.onRefresh?.())
          .catch(refreshError => console.error("Error refreshing parent attendance:", refreshError));
      }
    } catch (refreshError) {
      console.error("Error refreshing live attendance:", refreshError);
      if (mountedRef.current) setError("Unable to update live attendance. Retrying automatically.");
    } finally {
      isRefreshingRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
        const queued = queuedRefreshRef.current;
        queuedRefreshRef.current = null;
        if (queued) refreshRef.current?.(queued);
      }
    }
  }, [fetchEventsFromDB, fetchEventAttendance]);

  useEffect(() => { refreshRef.current = handleRefresh; }, [handleRefresh]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      queuedRefreshRef.current = null;
    };
  }, []);

  useEffect(() => {
    handleRefresh({ refreshEvents: true });
  }, [preferredEventKey, handleRefresh]);

  useEffect(() => {
    const refreshVisible = (refreshEvents = false) => {
      if (document.visibilityState === "visible") {
        refreshRef.current?.({ background: true, refreshEvents });
      }
    };
    /* Dito din idinudrive ang re-evaluation ng activeEvent (via setNow),
    sumasabay lang sa existing interval na ito imbes na magpatakbo ng
    pangalawang timer. */
    const tick = () => {
      setNow(Date.now());
      refreshVisible();
    };
    const onReturn = () => refreshVisible(true);
    const onRecorded = () => refreshVisible();
    const onStorage = event => {
      if (event.key === ATTENDANCE_UPDATED_KEY) refreshVisible();
    };
    /* Ang timer na ito ay independent sa pagbabago ng parent props, kaya
    hindi maaapektuhan ng renders ang interval o maantala ang susunod na
    update. */
    const interval = setInterval(tick, AUTO_REFRESH_MS);
    window.addEventListener('focus', onReturn);
    window.addEventListener('online', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener(ATTENDANCE_UPDATED_EVENT, onRecorded);
    window.addEventListener('storage', onStorage);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onReturn);
      window.removeEventListener('online', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener(ATTENDANCE_UPDATED_EVENT, onRecorded);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const activeEvent = useMemo(
    () => resolveActiveEvent(events, preferredEventKey, now),
    [events, preferredEventKey, now],
  );

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
        scannedBy: attendanceScannedBy(record),
        barangay:
          record.barangay || record.barangayName || record.barangay_name || "",
        scanTime:
          record.scanTime || record.timestamp || record.createdAt || null,
      }))
      .sort((a, b) => (new Date(b.scanTime).getTime() || 0) - (new Date(a.scanTime).getTime() || 0));
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

  if (
    variant === "secretary" ||
    variant === "admin" ||
    variant === "operator"
  ) {
    return (
      <LiveAttendanceView
        operatorView={variant === "operator"}
        activeEvent={activeEvent}
        selectedEventLabel={selectedEventLabel}
        liveRows={liveRows}
        filteredAttendance={filteredAttendance}
        paginatedAttendance={paginatedAttendance}
        selectedBarangay={selectedBarangay}
        availableBarangays={availableBarangays}
        onBarangayChange={(value) => {
          setSelectedBarangay(value);
          setCurrentPage(1);
        }}
        loading={loading}
        error={error}
        lastRefreshedAt={lastRefreshedAt}
        onRefresh={handleRefresh}
        refreshIntervalSeconds={AUTO_REFRESH_MS / 1000}
        currentPage={safePage}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        onPageChange={setCurrentPage}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            LIVE ATTENDANCE
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Check-ins update automatically every {AUTO_REFRESH_MS / 1000} seconds.
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
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-coop-green px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-coop-darkGreen active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coop-green/50"
        >
          <RefreshCw
            className={`w-4 h-4 transition-transform ${loading ? "animate-spin" : ""}`}
          />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </PageHeader>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {!activeEvent && !loading ? (
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
                <Select
                  value={selectedBarangay}
                  onChange={(e) => setSelectedBarangay(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-coop-green focus:outline-none focus:ring-2 focus:ring-coop-green/20"
                >
                  {availableBarangays.map((barangay) => (
                    <option key={barangay} value={barangay}>
                      {barangay === "all" ? "All barangays" : barangay}
                    </option>
                  ))}
                </Select>
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
            <DataTable className="min-w-full text-left text-sm text-slate-600">
              <thead className="bg-white">
                <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wide text-xs font-semibold">
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Barangay</th>
                  <th className="px-4 py-3">Scanned by</th>
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
                              Passbook No.:{" "}
                              {row.memberId || row.memberKey || "N/A"}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {timeLabel}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {row.barangay || "Unassigned"}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{attendanceScannedBy(row)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan="4"
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No check-ins yet for this event.
                    </td>
                  </tr>
                )}
              </tbody>
            </DataTable>
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
