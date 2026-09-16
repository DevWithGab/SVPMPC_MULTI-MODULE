import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
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
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-coop-green border border-green-200">
              {scanCount} record{scanCount === 1 ? "" : "s"}
            </span>
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
