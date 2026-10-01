import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  History,
  QrCode,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { StatCard } from "../shared";
import {
  formatDateTime,
  formatLongDate,
  getManilaHour,
} from "../../../utils/date";

export default function Dashboard({
  user,
  attendanceLogs,
  events,
  setActiveTab,
}) {
  const activeEventCount = Array.isArray(events)
    ? events.filter((event) => event?.status === "active").length
    : 0;
  const scanCount = attendanceLogs?.length ?? 0;
  const hasActiveEvent = activeEventCount > 0;
  const scannerStatusLabel = hasActiveEvent ? "Ready" : "Standby";

  const greeting = (() => {
    const hour = getManilaHour();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  })();

  const today = formatLongDate();

  return (
    <div className="space-y-6 pb-12">
      {/* Header — same title style, size, and color as every other page */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {greeting}, {user?.name || "Operator"}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Scan member QR codes at the door to record attendance for
            today&apos;s event · {today}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab("scanner")}
          disabled={!hasActiveEvent}
          className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold shrink-0 transition-colors ${
            hasActiveEvent
              ? "bg-coop-green hover:bg-coop-darkGreen text-white"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          }`}
        >
          <QrCode className="w-4 h-4" />
          {hasActiveEvent ? "Start Scanning" : "No Active Event"}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-in">
        <StatCard
          title="Active Events"
          value={activeEventCount}
          subtitle={activeEventCount > 0 ? "Ready for scanning" : "None active"}
          icon={CalendarDays}
        />
        <StatCard
          title="Scans This Session"
          value={scanCount}
          subtitle={scanCount > 0 ? "Recorded so far" : "No scans yet"}
          icon={CheckCircle2}
        />
        <StatCard
          title="Scanner Status"
          value={scannerStatusLabel}
          subtitle={hasActiveEvent ? "Scanning available" : "Awaiting event"}
          icon={Zap}
          accent={hasActiveEvent}
        />
      </div>

      {/* Quick links to the fuller attendance views */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setActiveTab("live")}
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-coop-green/40 hover:bg-green-50/40"
        >
          <div className="w-10 h-10 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-coop-green" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">
              Attendance Summary
            </p>
            <p className="text-xs text-slate-400 truncate">
              See everyone checked in to the active event
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("myscans")}
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-coop-green/40 hover:bg-green-50/40"
        >
          <div className="w-10 h-10 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
            <History className="w-5 h-5 text-coop-green" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">My Scans</p>
            <p className="text-xs text-slate-400 truncate">
              Everything you've personally scanned in
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
        </button>
      </div>

      {/* Recent Attendance */}
      <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-100 p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">
                Recent Attendance
              </CardTitle>
              <p className="text-slate-400 text-xs mt-1">
                Latest records from this session
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-coop-green border border-green-200">
                {scanCount} record{scanCount === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() => setActiveTab("myscans")}
                className="inline-flex items-center gap-1 text-xs font-semibold text-coop-green hover:text-coop-darkGreen transition-colors"
              >
                View All
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 text-[10px] font-semibold uppercase tracking-wide">
                  <th className="px-5 py-3">Member</th>
                  <th className="px-5 py-3">Event</th>
                  <th className="px-5 py-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 stagger-in">
                {attendanceLogs?.length > 0 ? (
                  attendanceLogs.slice(0, 5).map((record, index) => {
                    const memberName =
                      record.member_name ||
                      record.memberName ||
                      record.name ||
                      "Unknown member";
                    const eventName =
                      record.event || record.eventName || "Unknown event";
                    const timestamp =
                      record.timestamp ||
                      record.date ||
                      record.scanTime ||
                      record.createdAt ||
                      "";
                    const formattedTime = timestamp
                      ? formatDateTime(timestamp)
                      : "Unknown time";

                    return (
                      <tr
                        key={record.id ?? record._id ?? index}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="px-5 py-3 font-semibold text-slate-900">
                          {memberName}
                        </td>
                        <td className="px-5 py-3 text-slate-600">
                          {eventName}
                        </td>
                        <td className="px-5 py-3 text-slate-400">
                          {formattedTime}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="3" className="px-5 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <QrCode className="w-8 h-8 text-slate-300" />
                        <p className="font-medium">No attendance records yet</p>
                        <p className="text-xs">
                          Start scanning to populate this list
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
