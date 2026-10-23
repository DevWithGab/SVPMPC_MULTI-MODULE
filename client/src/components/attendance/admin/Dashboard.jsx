import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Clock,
  Activity,
  CheckCircle2,
  History,
  Target,
  Calendar,
  Users,
  UserPlus,
  FileText,
  ScanLine,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDate, formatTime } from "../../../utils/date";
import AttendanceMetricGrid from "../shared/AttendanceMetricGrid";
import "../secretary/Dashboard.css";
import "./Dashboard.css";

const getEventKey = (event) =>
  event?.eventId || event?._id || event?.id || event?.eventName || event?.name;
const getEventName = (event) =>
  event?.eventName || event?.name || "Untitled Event";
const getEventDate = (event) =>
  event?.eventDate || event?.date
    ? formatDate(event?.eventDate || event?.date)
    : "No date";

/* this is for normalizing attendance records */
const normalizeAttendanceRecord = (record) => ({
  ...record,
  memberId: record.memberId || record.member_id,
  eventId: record.eventId || record.event_id,
  memberName:
    record.memberName ||
    record.member_name ||
    record.member?.memberName ||
    record.member?.member_name,
  eventName:
    record.eventName ||
    record.event ||
    record.event?.eventName ||
    record.event?.name,
  scanTime:
    record.scanTime || record.timestamp || record.createdAt || record.date,
  status: String(
    record.status || record.entryStatus || record.attendanceStatus || "present",
  ).toLowerCase(),
});

const getAttendanceLogMemberName = (log) =>
  normalizeAttendanceRecord(log).memberName || "Unknown Member";
const getAttendanceLogMemberId = (log) =>
  normalizeAttendanceRecord(log).memberId || getAttendanceLogMemberName(log);
const getAttendanceLogTime = (log) => normalizeAttendanceRecord(log).scanTime;
const getAttendanceLogStatus = (log) => normalizeAttendanceRecord(log).status;
const Dashboard = ({
  members,
  attendanceLogs,
  events,
  currentEvent,
  setCurrentEvent,
  setActiveSection,
  refreshError = false,
}) => {
  const activeEvents = useMemo(
    () =>
      Array.isArray(events)
        ? events.filter((event) => event?.status === "active")
        : [],
    [events],
  );

  useEffect(() => {
    if (!activeEvents.length) {
      if (currentEvent) setCurrentEvent(null);
      return;
    }

    const currentEventKey = getEventKey(currentEvent);
    const isCurrentEventActive = activeEvents.some(
      (event) => getEventKey(event) === currentEventKey,
    );

    if (!currentEvent || !isCurrentEventActive) {
      setCurrentEvent(activeEvents[0]);
    }
  }, [activeEvents, currentEvent, setCurrentEvent]);

  const getLogEventId = (log) => {
    const record = normalizeAttendanceRecord(log);
    return record.eventId || record.event?.eventId || record.event?.id;
  };

  const getEventAttendance = (event) => {
    const eventId = getEventKey(event);
    const eventLogs = attendanceLogs.filter(
      (log) => String(getLogEventId(log)) === String(eventId),
    );
    /* Count by member ID, hindi by name - kasi posible na magkapareho ang display
    name ng dalawang members, kaya kung name lang ang gagamitin, maundercount
    yung totoong bilang ng dumalo. */
    const presentIds = new Set(
      eventLogs
        .filter((log) => getAttendanceLogStatus(log) !== "absent")
        .map((log) => getAttendanceLogMemberId(log)),
    );
    const present = presentIds.size;
    return { present, absent: Math.max(members.length - present, 0) };
  };

  const attendanceChartData = [...(Array.isArray(events) ? events : [])]
    .filter((event) => getEventKey(event))
    .sort((first, second) => {
      const firstDate = new Date(first.eventDate || first.date || 0);
      const secondDate = new Date(second.eventDate || second.date || 0);
      return firstDate - secondDate;
    })
    .slice(-6)
    .map((event) => {
      const { present, absent } = getEventAttendance(event);
      return {
        name: getEventName(event).slice(0, 18),
        present,
        absent,
        rate: members.length ? Math.round((present / members.length) * 100) : 0,
      };
    });

  // Analytics Calculations for the selected event.
  const totalMembers = members.length;
  const selectedEventAttendance = currentEvent
    ? getEventAttendance(currentEvent)
    : { present: 0, absent: totalMembers };
  const presentMembers = selectedEventAttendance.present;
  const absentMembers = totalMembers - presentMembers;
  const attendancePercentage =
    totalMembers > 0 ? Math.round((presentMembers / totalMembers) * 100) : 0;
  /* Recent momentum ito (last point kumpara sa isa bago nito), hindi first-vs-last
  sa buong window - kasi may volatile series na pwedeng tumaas nang malayo sa
  starting point niya pero konti lang ang pagkababa sa huli, kaya nalalabel na
  "Decreasing" yung bawat recent uptick kung ang window ay nagsimula sa local peak. */
  const previousTrendRate =
    attendanceChartData.length > 1
      ? attendanceChartData.at(-2)?.rate || 0
      : 0;
  const lastTrendRate = attendanceChartData.at(-1)?.rate || 0;
  const trendIsUp = lastTrendRate >= previousTrendRate;

  const [oneWeekAgoMs] = useState(() => Date.now() - 7 * 24 * 60 * 60 * 1000);
  const newMembersThisWeek = members.filter((member) => {
    const joined = member.joinDate || member.createdAt;
    if (!joined) return false;
    const joinedDate = new Date(joined);
    return (
      !Number.isNaN(joinedDate.getTime()) &&
      joinedDate.getTime() >= oneWeekAgoMs
    );
  }).length;

  /* Totoong last-scan time ito para sa Present card, scoped lang sa parehong
  event na kinukwenta ng present/absent counts sa taas. */
  const currentEventLogs = currentEvent
    ? attendanceLogs.filter(
        (log) =>
          String(getLogEventId(log)) === String(getEventKey(currentEvent)),
      )
    : [];
  const lastScanTime = currentEventLogs.reduce((latest, log) => {
    const logTime = getAttendanceLogTime(log);
    if (!logTime) return latest;
    const logDate = new Date(logTime);
    if (Number.isNaN(logDate.getTime())) return latest;
    return !latest || logDate > latest ? logDate : latest;
  }, null);

  const quickActions = [
    {
      label: "Live Attendance",
      desc: "Open the live attendance view",
      icon: ScanLine,
      section: "live",
    },
    {
      label: "Event Approvals",
      desc: "Review pending submissions",
      icon: Calendar,
      section: "events",
    },
    {
      label: "Member QR Management",
      desc: "Generate and manage QR codes",
      icon: UserPlus,
      section: "members",
    },
    {
      label: "Backup & Restore",
      desc: "Export or restore system data",
      icon: FileText,
      section: "backup",
    },
  ];

  return (
    <div className="secretary-dashboard attendance-admin-dashboard">
      <header className="sd-header">
        <div>
          <p className="sd-eyebrow">Attendance management / Overview</p>
          <h1>Attendance dashboard</h1>
          <p className="sd-description">
            Review event participation, attendance trends, and administrative
            tasks.
          </p>
          <p role="status" className={refreshError ? 'text-sm text-amber-800' : 'text-sm text-slate-500'}>
            {refreshError ? 'Unable to refresh attendance totals. Retrying automatically.' : 'Attendance totals update every 10 seconds.'}
          </p>
        </div>
        <button
          className="sd-button sd-primary"
          onClick={() => setActiveSection?.("live")}
        >
          Live attendance <ArrowRight size={15} aria-hidden="true" />
        </button>
      </header>

      <section className="sd-panel aad-event" aria-labelledby="aad-event-title">
        <div>
          <h2 id="aad-event-title">Active event session</h2>
          <p>
            {currentEvent
              ? `${getEventName(currentEvent)} ? ${getEventDate(currentEvent)}`
              : "No active event. Attendance counts will appear when an event is active."}
          </p>
        </div>
        <label>
          Choose an active event
          <select
            value={String(getEventKey(currentEvent) || "")}
            disabled={!activeEvents.length}
            onChange={(e) =>
              setCurrentEvent(
                activeEvents.find(
                  (event) => String(getEventKey(event)) === e.target.value,
                ) || null,
              )
            }
          >
            {!activeEvents.length && <option value="">No active event</option>}
            {activeEvents.length > 0 && !currentEvent && (
              <option value="" disabled>
                Select an event
              </option>
            )}
            {activeEvents.map((event) => (
              <option
                key={getEventKey(event)}
                value={String(getEventKey(event))}
              >
                {getEventName(event)} ? {getEventDate(event)}
              </option>
            ))}
          </select>
        </label>
      </section>

      <AttendanceMetricGrid
        label="Attendance overview"
        items={[
          [
            "Registered members",
            totalMembers.toLocaleString(),
            newMembersThisWeek > 0
              ? `+${newMembersThisWeek} new this week`
              : "No new members this week",
            Users,
          ],
          [
            "Present",
            currentEvent ? presentMembers.toLocaleString() : "?",
            !currentEvent
              ? "No active event"
              : lastScanTime
                ? `Last scan: ${formatTime(lastScanTime)}`
                : "No scans recorded yet",
            CheckCircle2,
          ],
          [
            "Absent",
            currentEvent ? absentMembers.toLocaleString() : "?",
            currentEvent
              ? `For ${getEventName(currentEvent)}`
              : "No active event",
            History,
          ],
          [
            "Attendance rate",
            `${attendancePercentage}%`,
            "Share of registered members present",
            Target,
          ],
        ]}
      />

      {/* Attendance Overview */}
      <div className="aad-charts">
        <div className="sd-panel aad-chart-panel">
          <div className="aad-chart-heading">
            <div>
              <h3 className="aad-chart-title">Attendance Overview</h3>
              <p className="aad-chart-caption">
                Present and absent members by event
              </p>
            </div>
            <Users className="w-5 h-5 text-slate-300" />
          </div>
          <div className="h-64">
            {attendanceChartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceChartData} barGap={6}>
                  <CartesianGrid vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip cursor={{ fill: "#f0fdf4" }} />
                  <Bar
                    dataKey="present"
                    name="Present"
                    fill="#2D7A3E"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="absent"
                    name="Absent"
                    fill="#e8f871"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                No attendance data available yet.
              </div>
            )}
          </div>
        </div>

        <div className="sd-panel aad-chart-panel">
          <div className="aad-chart-heading">
            <div>
              <h3 className="aad-chart-title">Attendance Trend</h3>
              <p className="aad-chart-caption">
                {attendanceChartData.length > 1
                  ? `${trendIsUp ? "Increasing" : "Decreasing"} `
                  : "Attendance rate over time"}
              </p>
            </div>
            {attendanceChartData.length > 1 &&
              (trendIsUp ? (
                <TrendingUp className="w-5 h-5 text-green-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-500" />
              ))}
          </div>
          <div className="h-64">
            {attendanceChartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={attendanceChartData}>
                  <CartesianGrid vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    unit="%"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value) => [`${value}%`, "Attendance rate"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    name="Attendance rate"
                    stroke="#2D7A3E"
                    strokeWidth={3}
                    dot={{
                      r: 4,
                      fill: "#F2E416",
                      stroke: "#2D7A3E",
                      strokeWidth: 2,
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                No trend data available yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <nav className="aad-workspace" aria-label="Attendance workspace">
        <div className="aad-workspace-heading">
          <h2>Workspace</h2>
          <p>Open common attendance tasks.</p>
        </div>
        <div className="aad-shortcuts">
          {quickActions.map((action) => (
            <button
              key={action.section}
              type="button"
              onClick={() => setActiveSection?.(action.section)}
            >
              <span className="aad-shortcut-icon">
                <action.icon size={17} aria-hidden="true" />
              </span>
              <span>
                <strong>{action.label}</strong>
                <small>{action.desc}</small>
              </span>
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};
export default Dashboard;
