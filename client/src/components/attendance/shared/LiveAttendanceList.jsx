import { useState, useEffect, useMemo, useCallback } from "react";
import { Activity, RefreshCw, Users } from "lucide-react";
import { eventAPI, memberAPI } from "../../../services/api";
import { formatDateTime } from "../../../utils/date";

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
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

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
    } catch (eventError) {
      console.error("Error fetching events:", eventError);
      setError(eventError?.message || "Unable to load events.");
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  const fetchLiveAttendance = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const memberData = await memberAPI.getAllMembers();

      if (memberData.status === "fulfilled" || memberData) {
        setMembers(memberData.members || []);
      } else {
        throw memberData.reason;
      }
    } catch (fetchError) {
      setError(fetchError?.message || "Unable to load members.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setAttendanceLogs(attendanceLogsSource);
    if (eventsSource.length > 0) {
      setEvents(eventsSource);
    }
  }, [attendanceLogsSource, eventsSource]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([fetchLiveAttendance(), fetchEventsFromDB()]);
    if (typeof onRefresh === "function") {
      onRefresh();
    }
  }, [fetchLiveAttendance, fetchEventsFromDB, onRefresh]);

  useEffect(() => {
    handleRefresh();
  }, [handleRefresh]);

  const getEventKey = (event) =>
    event?.eventId ||
    event?.id ||
    event?._id ||
    event?.name ||
    event?.eventName;

  const getMemberKey = (member) =>
    member?.memberId || member?.id || member?._id || member?.qrCode;

  const getMemberDisplayName = (member) =>
    String(member?.memberName || member?.name || "Unknown member");

  const getAttendanceKey = (record) =>
    record?.memberId ||
    record?.member_id ||
    record?.member?.memberId ||
    record?.member?.member_id ||
    record?.memberName ||
    record?.name;

  const availableBarangays = useMemo(() => {
    const barangays = new Set();
    members.forEach((member) => {
      const barangay =
        member?.barangay || member?.barangayName || member?.barangay_name;
      if (barangay) barangays.add(barangay);
    });
    attendanceLogs.forEach((record) => {
      const barangay =
        record.barangay || record.barangayName || record.barangay_name;
      if (barangay) barangays.add(barangay);
    });
    return ["all", ...Array.from(barangays).sort()];
  }, [attendanceLogs, members]);

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
    if (!members.length) {
      return [];
    }

    const normalizedRecords = attendanceLogs.map((record) => ({
      ...record,
      eventKey:
        record.eventId || record.event_id || record.event || record.eventName,
      memberKey: getAttendanceKey(record),
      status: String(record.status || "present").toLowerCase(),
    }));

    const selectedEventRows = normalizedRecords.filter((record) => {
      const recordEventKey = String(record.eventKey || "");
      return recordEventKey === activeEventKey;
    });

    const attendanceMap = new Map();
    selectedEventRows.forEach((record) => {
      const memberKey = String(getAttendanceKey(record) || "");
      if (!memberKey) return;
      attendanceMap.set(memberKey, record);
    });

    return members.map((member) => {
      const memberKey = String(getMemberKey(member) || "");
      const record = attendanceMap.get(memberKey);
      const isPresent = Boolean(record);
      const derivedStatus =
        record?.status || (isPresent ? "present" : "absent");

      return {
        member,
        memberKey,
        record,
        status: derivedStatus,
        eventName: selectedEventLabel,
        scanTime:
          record?.scanTime || record?.timestamp || record?.createdAt || null,
      };
    });
  }, [attendanceLogs, members, activeEventKey, selectedEventLabel]);

  const filteredAttendance = useMemo(() => {
    return liveRows.filter((row) => {
      const barangay =
        row.member?.barangay ||
        row.member?.barangayName ||
        row.member?.barangay_name;

      const matchesBarangay =
        selectedBarangay === "all" || barangay === selectedBarangay;

      const matchesStatus =
        selectedStatus === "all" || row.status === selectedStatus;

      return matchesBarangay && matchesStatus;
    });
  }, [liveRows, selectedBarangay, selectedStatus]);

  const presentCount = useMemo(
    () => filteredAttendance.filter((row) => row.status === "present").length,
    [filteredAttendance],
  );

  const absentCount = useMemo(
    () => filteredAttendance.filter((row) => row.status === "absent").length,
    [filteredAttendance],
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-lg shadow-slate-200/40">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.3em] text-slate-600">
              <Activity className="w-4 h-4 text-coop-green" />
              Live Attendance
            </div>
            <h2 className="mt-4 text-2xl font-black text-slate-950">
              Live attendance list
            </h2>
            <p className="mt-2 text-slate-500 max-w-2xl">
              View the latest attendance records captured across the attendance
              system in real time.
            </p>
            <div
              className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ring-1 ${
                activeEvent
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                  : "bg-red-50 text-red-700 ring-red-100"
              }`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
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
            className="inline-flex items-center gap-2 rounded-2xl bg-coop-green px-5 py-3 text-sm font-black text-white shadow-lg shadow-coop-green/20 transition hover:bg-coop-darkGreen disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className="w-4 h-4" />
            {loading || loadingEvents ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-[2rem] border border-red-200 bg-red-50 p-6 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-[2rem] border border-slate-200 bg-white shadow-lg shadow-slate-200/40 overflow-hidden">
        <div className="flex flex-col gap-4 px-6 py-4 border-b border-slate-200 bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-slate-500">
              Attendance records
            </p>
            <p className="text-3xl font-black text-slate-950">
              {filteredAttendance.length}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-slate-500">
            <span className="rounded-full bg-green-50 px-3 py-1 font-bold text-coop-green">
              Present: {presentCount}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-600">
              Absent: {absentCount}
            </span>
          </div>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <label className="space-y-2 text-sm font-semibold text-slate-700">
              Filter by barangay
              <select
                value={selectedBarangay}
                onChange={(e) => setSelectedBarangay(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-coop-green focus:ring-2 focus:ring-coop-green/20"
              >
                {availableBarangays.map((barangay) => (
                  <option key={barangay} value={barangay}>
                    {barangay === "all" ? "All baranggays" : barangay}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-semibold text-slate-700">
              Filter by status
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-coop-green focus:ring-2 focus:ring-coop-green/20"
              >
                <option value="all">All statuses</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
              </select>
            </label>

            <div className="space-y-2 text-sm font-semibold text-slate-700">
              <span className="block text-slate-400">Showing</span>
              <div className="rounded-2xl bg-slate-100 px-4 py-3 text-slate-700">
                {filteredAttendance.length} /{" "}
                {members.length || attendanceLogs.length} members
              </div>
            </div>

            <div className="space-y-2 text-sm font-semibold text-slate-700">
              <span className="block text-slate-400">Last refresh</span>
              <div className="rounded-2xl bg-slate-100 px-4 py-3 text-slate-700">
                {loading ? "Refreshing..." : "Ready"}
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-600">
            <thead className="bg-white">
              <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-[0.2em] text-xs font-bold">
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Barangay</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredAttendance.length > 0 ? (
                filteredAttendance.slice(0, 10).map((record, index) => {
                  const memberName = getMemberDisplayName(record.member);
                  const eventName =
                    record.eventName || record.event || "All events";
                  const scanTime = record.scanTime;
                  const timeLabel = scanTime
                    ? formatDateTime(scanTime)
                    : record.status === "absent"
                      ? "Not recorded"
                      : "Unknown time";
                  const statusLabel =
                    record.status === "absent" ? "Absent" : "Present";

                  return (
                    <tr
                      key={record.record?._id || record.memberKey || index}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-4 font-bold text-slate-900">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-coop-green text-xs font-black text-white">
                            {memberName
                              .split(" ")
                              .filter(Boolean)
                              .map((part) => part[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase() || "?"}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">
                              {memberName}
                            </div>
                            <div className="text-xs text-slate-500">
                              ID:{" "}
                              {record.member?.memberId ||
                                record.memberKey ||
                                "N/A"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">{eventName}</td>
                      <td className="px-4 py-4 text-slate-500">{timeLabel}</td>
                      <td className="px-4 py-4 text-slate-500">
                        {record.member?.barangay || "Unassigned"}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.2em] ${
                            record.status === "absent"
                              ? "bg-slate-100 text-slate-600"
                              : "bg-green-100 text-coop-green"
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan="5"
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No members match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
