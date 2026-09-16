import React, { useEffect, useMemo, useState } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
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
import { Card, CardHeader, CardTitle, CardContent } from "../../ui/card";

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
const getAttendanceLogEventName = (log) =>
  normalizeAttendanceRecord(log).eventName || "Unknown Event";
const getAttendanceLogTime = (log) => normalizeAttendanceRecord(log).scanTime;
const getAttendanceLogStatus = (log) => normalizeAttendanceRecord(log).status;
const getAttendanceLogId = (log) =>
  log.id ||
  log._id ||
  `${getAttendanceLogMemberName(log)}-${getAttendanceLogTime(log)}`;

const getAttendanceStatusMeta = (status) => {
  const normalizedStatus = String(status || "present").toLowerCase();

  if (normalizedStatus === "absent") {
    return {
      label: "Absent",
      textClass: "text-red-600",
      bgClass: "bg-red-50",
      borderClass: "border-red-200",
      dotClass: "bg-red-500",
    };
  }

  return {
    label: "Present",
    textClass: "text-green-700",
    bgClass: "bg-green-50",
    borderClass: "border-green-200",
    dotClass: "bg-green-500",
  };
};

const Dashboard = ({
  members,
  attendanceLogs,
  events,
  currentEvent,
  setCurrentEvent,
  setActiveSection,
}) => {
  const [isEventSelectorOpen, setIsEventSelectorOpen] = useState(false);
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
    // Count by member ID, not name — two members can share a display name,
    // which would otherwise undercount how many people actually attended.
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
  const firstTrendRate = attendanceChartData[0]?.rate || 0;
  const lastTrendRate = attendanceChartData.at(-1)?.rate || 0;
  const trendIsUp = lastTrendRate >= firstTrendRate;

  const oneWeekAgoMs = useMemo(() => Date.now() - 7 * 24 * 60 * 60 * 1000, []);
  const newMembersThisWeek = members.filter((member) => {
    const joined = member.joinDate || member.createdAt;
    if (!joined) return false;
    const joinedDate = new Date(joined);
    return (
      !Number.isNaN(joinedDate.getTime()) &&
      joinedDate.getTime() >= oneWeekAgoMs
    );
  }).length;

  // Real last-scan time for the Present card, scoped to the same event the
  // present/absent counts above are for — was a hardcoded "Just now".
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
      desc: "Open the live scan view",
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
      label: "View Reports",
      desc: "Export attendance data",
      icon: FileText,
      section: "reports",
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Dashboard Header & Event Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            DASHBOARD
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Real-time attendance intelligence &amp; controls
          </p>
        </div>

        <div className="relative">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
            Active Event Session
          </label>
          <div
            onClick={() => setIsEventSelectorOpen(!isEventSelectorOpen)}
            className="flex items-center justify-between w-full md:w-80 px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-green-500 cursor-pointer transition-all"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "#2D7A3E" }}
              >
                <Calendar className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate uppercase tracking-wide">
                  {currentEvent
                    ? getEventName(currentEvent)
                    : "No active event"}
                </p>
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isEventSelectorOpen ? "rotate-180" : ""}`}
            />
          </div>

          <AnimatePresence>
            {isEventSelectorOpen && (
              <Motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl p-2 z-50"
              >
                {activeEvents.length > 0 ? (
                  activeEvents.map((ev) => {
                    const isSelected =
                      currentEvent &&
                      getEventKey(currentEvent) === getEventKey(ev);

                    return (
                      <button
                        key={getEventKey(ev)}
                        onClick={() => {
                          setCurrentEvent(ev);
                          setIsEventSelectorOpen(false);
                        }}
                        className={`w-full text-left p-3 rounded-lg transition-all mb-1 last:mb-0 ${
                          isSelected
                            ? "text-white border"
                            : "hover:bg-slate-50 text-slate-600"
                        }`}
                        style={
                          isSelected
                            ? {
                                backgroundColor: "#2D7A3E",
                                borderColor: "#F2E416",
                              }
                            : {}
                        }
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-6 h-6 rounded-md flex items-center justify-center ${
                              isSelected ? "bg-white/20" : "bg-slate-100"
                            }`}
                          >
                            <Calendar
                              className={`w-3 h-3 ${
                                isSelected ? "text-white" : "text-slate-400"
                              }`}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold tracking-tight truncate">
                              {ev.eventName || ev.name}
                            </p>
                            <p className="text-xs font-medium opacity-60 uppercase">
                              {getEventDate(ev)} • {ev.status}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-sm font-bold text-slate-400">
                    No active event yet.
                  </div>
                )}
              </Motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-full -mr-12 -mt-12 group-hover:bg-slate-100 transition-all duration-700" />
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  Registered
                </label>
                <h3 className="text-4xl font-bold text-slate-900 tracking-tight">
                  {totalMembers}
                </h3>
              </div>
              <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500">
                <Users className="w-7 h-7 text-slate-900" />
              </div>
            </div>
            <div
              className="mt-4 flex items-center text-xs font-bold uppercase tracking-wider"
              style={{ color: "#2D7A3E" }}
            >
              <Activity className="w-3 h-3 mr-1" />
              {newMembersThisWeek > 0
                ? `+${newMembersThisWeek} new this week`
                : "No new members this week"}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden group">
          <div
            className="absolute top-0 right-0 w-24 h-24 rounded-full -mr-12 -mt-12 group-hover:opacity-80 transition-all duration-700"
            style={{ backgroundColor: "#2D7A3E", opacity: 0.1 }}
          />
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <label
                  className="text-xs font-bold uppercase tracking-wider mb-2 block"
                  style={{ color: "#2D7A3E", opacity: 0.6 }}
                >
                  Present
                </label>
                <h3
                  className="text-4xl font-bold tracking-tight"
                  style={{ color: "#2D7A3E" }}
                >
                  {currentEvent ? presentMembers : "—"}
                </h3>
              </div>

              <div className="w-14 h-14 bg-green-50 border border-green-200 rounded-xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500 text-coop-green">
                <CheckCircle2 className="w-7 h-7" />
              </div>
            </div>
            <div
              className="mt-4 flex items-center text-xs font-bold uppercase tracking-wider"
              style={{ color: "#2D7A3E" }}
            >
              <Clock className="w-3 h-3 mr-1" />
              {!currentEvent
                ? "No active event"
                : lastScanTime
                  ? `Last Scan: ${formatTime(lastScanTime)}`
                  : "No scans recorded yet"}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-full -mr-12 -mt-12 group-hover:bg-red-100 transition-all duration-700" />
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-red-600/60 uppercase tracking-wider mb-2 block">
                  Absent
                </label>
                <h3 className="text-4xl font-bold text-red-700 tracking-tight">
                  {currentEvent ? absentMembers : "—"}
                </h3>
              </div>
              <div className="w-14 h-14 bg-red-50 border border-red-100 rounded-xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500 text-red-600">
                <History className="w-7 h-7" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs font-bold text-red-400 uppercase tracking-wider truncate">
              {currentEvent
                ? `For ${getEventName(currentEvent)}`
                : "No active event"}
            </div>
          </div>
        </div>

        <div
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden group"
          style={{
            background: "linear-gradient(135deg, #2D7A3E 0%, #163A1E 100%)",
          }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-125 transition-all duration-700" />
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <label
                  className="text-xs font-bold uppercase tracking-wider mb-2 block"
                  style={{ color: "#F2E416" }}
                >
                  Success Rate
                </label>
                <h3 className="text-4xl font-bold text-white tracking-tight">
                  {attendancePercentage}%
                </h3>
              </div>
              <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500 text-white/80">
                <Target className="w-7 h-7" />
              </div>
            </div>
            <div className="mt-6 h-2 w-full bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/5">
              <Motion.div
                initial={{ width: 0 }}
                animate={{ width: `${attendancePercentage}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="h-full rounded-full shadow-lg"
                style={{ backgroundColor: "#F2E416" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3
                className="font-bold uppercase tracking-wider"
                style={{ color: "#2D7A3E" }}
              >
                Attendance Overview
              </h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wide mt-1">
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

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3
                className="font-bold uppercase tracking-wider"
                style={{ color: "#2D7A3E" }}
              >
                Attendance Trend
              </h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wide mt-1">
                {attendanceChartData.length > 1
                  ? `${trendIsUp ? "Increasing" : "Decreasing"} over time`
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

      {/* Quick Actions */}
      <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden bg-white">
        <CardHeader className="p-5 pb-4 space-y-0">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-coop-green" />
            <CardTitle className="text-sm font-bold text-slate-900">
              QUICK ACTIONS
            </CardTitle>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 ml-6">
            Jump to common attendance tasks
          </p>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.section}
                type="button"
                onClick={() => setActiveSection?.(action.section)}
                className="flex flex-col items-center justify-center gap-3 p-5 rounded-xl border border-slate-200 hover:border-coop-green hover:bg-green-50 transition-colors group text-center"
              >
                <div className="p-3 bg-green-50 rounded-xl group-hover:bg-white group-hover:shadow-sm transition-all">
                  <action.icon className="w-5 h-5 text-coop-green" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800">
                    {action.label}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                    {action.desc}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
export default Dashboard;
