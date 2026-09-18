import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Users,
  BarChart3,
  UserCheck,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  MapPin,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { StatCard } from "../shared";
import { formatTime, formatLongDate, getManilaHour } from "../../../utils/date";
import { attendanceAPI, eventAPI } from "../../../services/api";

const EVENT_STATUS_META = {
  active: {
    label: "Active",
    dot: "bg-coop-green",
    text: "text-coop-green",
    bg: "bg-green-50",
    border: "border-green-200",
  },
  upcoming: {
    label: "Upcoming",
    dot: "bg-amber-500",
    text: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  closed: {
    label: "Closed",
    dot: "bg-red-500",
    text: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
  },
};

const getStatusMeta = (status) =>
  EVENT_STATUS_META[status] || EVENT_STATUS_META.closed;

const getEventDateValue = (event) => {
  const raw = event.eventDate || event.date;
  const parsed = raw ? new Date(raw) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
};

const QuickActionTile = ({ icon: Icon, label, subtitle, onClick, accent = false }) => (
  <button
    type="button"
    onClick={onClick}
    className={`group flex flex-col items-start gap-3 rounded-xl p-4 text-left transition-all duration-150 active:scale-[0.97] ${
      accent
        ? "bg-coop-green hover:bg-coop-darkGreen shadow-sm hover:shadow-md"
        : "border border-slate-200 hover:border-coop-green hover:bg-green-50"
    }`}
  >
    <div
      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110 ${
        accent ? "bg-white/20" : "bg-green-50"
      }`}
    >
      <Icon
        className={`w-5 h-5 ${accent ? "text-white" : "text-coop-green"}`}
      />
    </div>
    <div className="min-w-0">
      <p
        className={`text-sm font-semibold leading-tight ${accent ? "text-white" : "text-slate-900"}`}
      >
        {label}
      </p>
      <p
        className={`text-xs mt-0.5 leading-tight ${accent ? "text-green-100/80" : "text-slate-400"}`}
      >
        {subtitle}
      </p>
    </div>
  </button>
);

export default function SecretaryDashboard({
  user,
  attendanceLogs,
  events: initialEvents = [],
  setActiveTab,
}) {
  const [events, setEvents] = useState(initialEvents);
  const [attendanceRecords, setAttendanceRecords] = useState(
    attendanceLogs || [],
  );

  useEffect(() => {
    let mounted = true;
    const fetchEvents = async () => {
      try {
        const res = await eventAPI.getAllEvents();
        if (!mounted) return;
        // Response shape: { events: [...] } or array - handle both
        const fetched = Array.isArray(res)
          ? res
          : res?.events || res?.data || [];
        setEvents(fetched);
      } catch (err) {
        console.error("Failed to fetch events for secretary dashboard:", err);
      }
    };

    // Fetch fresh events from DB on mount
    fetchEvents();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchAttendance = async () => {
      try {
        const response = await attendanceAPI.getAllAttendance();
        const fetched = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : response?.attendance || response?.data?.attendance || [];

        if (!mounted) return;
        setAttendanceRecords(fetched);
      } catch (err) {
        console.error(
          "Failed to fetch attendance for secretary dashboard:",
          err,
        );
        if (mounted) {
          setAttendanceRecords(attendanceLogs || []);
        }
      }
    };

    fetchAttendance();

    return () => {
      mounted = false;
    };
  }, [attendanceLogs]);

  // Calculate stats
  const totalEvents = events.length;
  const activeEvents = events.filter(
    (event) => event.status === "active",
  ).length;
  const upcomingEventsCount = events.filter(
    (event) => event.status === "upcoming",
  ).length;
  const closedEventsCount = events.filter(
    (event) => event.status === "closed",
  ).length;
  const totalAttendance = attendanceRecords.length;
  const todayAttendance = attendanceRecords.filter((log) => {
    const scanTime = log.scanTime || log.timestamp || log.createdAt;
    if (!scanTime) return false;
    return new Date(scanTime).toDateString() === new Date().toDateString();
  }).length;

  // Get recent events
  const recentEvents = events.slice(0, 5);

  // Nearest upcoming/active event, for the hero spotlight
  const spotlightEvent = useMemo(() => {
    const now = new Date();
    const candidates = events
      .filter(
        (event) => event.status === "active" || event.status === "upcoming",
      )
      .map((event) => ({ event, date: getEventDateValue(event) }))
      .filter(({ date }) => date)
      .sort((a, b) => a.date - b.date);

    const upcoming = candidates.find(({ date }) => date >= now);
    return (upcoming || candidates[0])?.event || null;
  }, [events]);

  const greeting = useMemo(() => {
    const hour = getManilaHour();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const today = useMemo(() => formatLongDate(), []);

  return (
    <div className="space-y-6 pb-12">
      {/* Header — same title style, size, and color as every other page */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {greeting}, {user?.name || "Secretary"}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Here&apos;s what&apos;s happening across your General Assembly
            events today · {today}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {spotlightEvent && (
            <button
              type="button"
              onClick={() => setActiveTab("events")}
              className="group flex items-center gap-3 bg-white hover:bg-green-50 border border-slate-200 hover:border-coop-green rounded-xl px-4 py-3 text-left transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-coop-green" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {spotlightEvent.status === "active"
                    ? "Happening now"
                    : "Next up"}
                </p>
                <p className="text-sm font-semibold text-slate-900 truncate max-w-[180px]">
                  {spotlightEvent.eventName || spotlightEvent.name}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>
          )}
          <Button
            onClick={() => setActiveTab("events")}
            className="bg-coop-green hover:bg-coop-darkGreen text-white font-semibold px-5 py-2.5 rounded-lg shrink-0"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Event
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-in">
        <StatCard
          title="Total Events"
          value={totalEvents}
          subtitle="All events created"
          icon={Calendar}
        />
        <StatCard
          title="Active Events"
          value={activeEvents}
          subtitle="Currently running"
          icon={Clock}
        />
        <StatCard
          title="Total Attendance"
          value={totalAttendance}
          subtitle="All time records"
          icon={Users}
        />
        <StatCard
          title="Today's Attendance"
          value={todayAttendance}
          subtitle="Today's records"
          icon={CheckCircle2}
          accent
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Events */}
        <Card className="lg:col-span-2 border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
          <CardHeader className="border-b border-slate-100 p-5">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-coop-green" />
              Recent Events
            </CardTitle>
            <p className="text-slate-400 text-xs mt-1">
              Latest event activities
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 stagger-in">
              {recentEvents.map((event) => {
                const meta = getStatusMeta(event.status);
                const eventDate = getEventDateValue(event);

                return (
                  <button
                    key={
                      event.eventId ||
                      event.id ||
                      event._id ||
                      event.eventName ||
                      event.name ||
                      JSON.stringify(event)
                    }
                    type="button"
                    onClick={() => setActiveTab("events")}
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-200 flex flex-col items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-slate-900 leading-none">
                        {eventDate ? eventDate.getDate() : "--"}
                      </span>
                      <span className="text-[10px] font-semibold uppercase text-slate-400 mt-0.5">
                        {eventDate
                          ? eventDate.toLocaleDateString("en-US", {
                              month: "short",
                            })
                          : ""}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {event.eventName || event.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">
                          {event.location || "No location set"}
                        </span>
                        <span className="text-slate-300">&bull;</span>
                        <span className="shrink-0">
                          {event.eventTime ||
                            (eventDate ? formatTime(eventDate) : "")}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shrink-0 ${meta.bg} ${meta.text} ${meta.border}`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${meta.dot}`}
                      />
                      {meta.label}
                    </span>
                  </button>
                );
              })}

              {recentEvents.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-12 text-slate-400">
                  <Calendar className="w-8 h-8 text-slate-300" />
                  <p className="font-medium">No events found.</p>
                  <p className="text-xs">
                    Create your first event to get started.
                  </p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 text-center">
              <Button
                variant="outline"
                onClick={() => setActiveTab("events")}
                className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green font-semibold rounded-lg"
              >
                Manage All Events
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Event Breakdown */}
        <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
          <CardHeader className="border-b border-slate-100 p-5">
            <CardTitle className="text-sm font-bold text-slate-900">
              Event Breakdown
            </CardTitle>
            <p className="text-slate-400 text-xs mt-1">
              Status across all events
            </p>
          </CardHeader>
          <CardContent className="p-5 space-y-4 stagger-in">
            {[
              {
                label: "Active",
                count: activeEvents,
                meta: EVENT_STATUS_META.active,
              },
              {
                label: "Upcoming",
                count: upcomingEventsCount,
                meta: EVENT_STATUS_META.upcoming,
              },
              {
                label: "Closed",
                count: closedEventsCount,
                meta: EVENT_STATUS_META.closed,
              },
            ].map(({ label, count, meta }) => {
              const percent =
                totalEvents > 0 ? Math.round((count / totalEvents) * 100) : 0;
              return (
                <div key={label}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="flex items-center gap-2 font-medium text-slate-700">
                      <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                      {label}
                    </span>
                    <span className="text-slate-400 font-medium">{count}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${meta.dot} transition-all duration-700 ease-out`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {totalEvents === 0 && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <AlertCircle className="w-4 h-4" />
                No events yet to break down.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions — full-width row so all four tiles get equal room
          instead of being squeezed into a narrow sidebar column. */}
      <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-100 p-5">
          <CardTitle className="text-sm font-bold text-slate-900">
            Quick Actions
          </CardTitle>
          <p className="text-slate-400 text-xs mt-1">Common tasks</p>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-in">
          <QuickActionTile
            icon={Plus}
            label="Create Event"
            subtitle="New assembly"
            onClick={() => setActiveTab("events")}
            accent
          />
          <QuickActionTile
            icon={UserCheck}
            label="Manual Attendance"
            subtitle="Mark present"
            onClick={() => setActiveTab("manual")}
          />
          <QuickActionTile
            icon={BarChart3}
            label="View Reports"
            subtitle="Export data"
            onClick={() => setActiveTab("reports")}
          />
          <QuickActionTile
            icon={Users}
            label="Directory"
            subtitle="Member QR codes"
            onClick={() => setActiveTab("directory")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
