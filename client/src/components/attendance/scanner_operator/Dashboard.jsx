import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ShieldCheck,
  Activity,
  Zap,
} from "lucide-react";
import { formatDateTime } from "../../../utils/date";

const StatCard = ({ title, value, icon: Icon, color = "emerald", subtitle = "" }) => {
  const colorMap = {
    emerald: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100", icon: "text-emerald-600" },
    blue: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-100", icon: "text-blue-600" },
    amber: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-100", icon: "text-amber-600" },
  };
  
  const colorStyle = colorMap[color] || colorMap.emerald;

  return (
    <div className={`p-6 sm:p-7 rounded-3xl border ${colorStyle.border} bg-gradient-to-br from-white to-slate-50/50 shadow-md hover:shadow-lg transition-all duration-300 group relative overflow-hidden`}>
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <p className="text-xs font-extrabold text-slate-600 uppercase tracking-widest">{title}</p>
          <div className={`p-3 rounded-2xl ${colorStyle.bg} transition-transform group-hover:scale-110 duration-300`}>
            <Icon className={`w-5 h-5 ${colorStyle.icon}`} />
          </div>
        </div>
        <p className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tighter">{value}</p>
        {subtitle && <p className="text-xs text-slate-500 font-semibold mt-2">{subtitle}</p>}
      </div>
    </div>
  );
};

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
  const scannerStatusMessage = hasActiveEvent
    ? "Active event detected. Scanner is ready to record attendance."
    : "No active event available. Scanner is on standby.";

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-950 tracking-tight leading-tight">Welcome, {user?.name || "Operator"}</h2>
          <p className="text-slate-500 text-xs font-extrabold uppercase tracking-widest mt-2">Scanner Operator Portal</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-3 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl">
            <Activity className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-extrabold text-slate-700 uppercase tracking-widest">Live Scanner</span>
          </div>
        </div>
      </div>

      {/* Key Metrics - Enhanced Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        <StatCard 
          title="Active Events" 
          value={activeEventCount}
          subtitle={activeEventCount > 0 ? "Ready for scanning" : "No events active"}
          icon={CalendarDays} 
          color="emerald" 
        />
        <StatCard 
          title="Recent Scans" 
          value={scanCount}
          subtitle={scanCount > 0 ? "During this session" : "No scans yet"}
          icon={CheckCircle2} 
          color="blue" 
        />
        <StatCard 
          title="Scanner Status" 
          value={scannerStatusLabel}
          subtitle={hasActiveEvent ? "Scanning available" : "Awaiting event"}
          icon={Zap} 
          color={hasActiveEvent ? "emerald" : "amber"} 
        />
      </div>

      {/* Action Banner */}
      <div className="rounded-3xl border border-slate-200/60 bg-gradient-to-r from-emerald-50/80 to-blue-50/40 p-8 shadow-lg overflow-hidden relative">
        <div className="absolute -right-20 -top-20 w-40 h-40 bg-emerald-100 rounded-full opacity-20 blur-3xl"></div>
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Ready to start scanning?</h3>
            <p className="text-slate-600 font-semibold">Use the QR Scanner to quickly record member attendance for active events.</p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("scanner")}
            className={`inline-flex items-center gap-2 rounded-2xl px-7 py-4 text-sm font-black text-white shadow-lg transition-all duration-300 flex-shrink-0 ${
              hasActiveEvent 
                ? "bg-gradient-to-r from-emerald-600 to-emerald-700 hover:shadow-emerald-300/50 hover:scale-105" 
                : "bg-slate-400 cursor-not-allowed"
            }`}
          >
            <Zap className="w-5 h-5" />
            {hasActiveEvent ? "Start Scanner" : "No Active Events"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Recent Attendance Records */}
      <div className="rounded-3xl border border-slate-200/60 bg-white shadow-lg overflow-hidden">
        <div className="p-8 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-transparent">
          <div className="flex items-center justify-between gap-4 flex-col sm:flex-row">
            <div>
              <h3 className="text-xl font-black text-slate-900">Recent Attendance</h3>
              <p className="text-sm font-semibold text-slate-500 mt-1">Latest records from this session</p>
            </div>
            <div className="px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-full">
              <p className="text-xs font-extrabold text-emerald-700 uppercase tracking-widest">{scanCount} record{scanCount === 1 ? "" : "s"}</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-600">
            <thead>
              <tr className="border-b border-slate-100 text-slate-600 uppercase tracking-widest text-xs font-extrabold bg-gradient-to-r from-slate-50 to-transparent">
                <th className="px-6 py-4 font-extrabold">Member</th>
                <th className="px-6 py-4 font-extrabold">Event</th>
                <th className="px-6 py-4 font-extrabold">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
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
                      className="hover:bg-emerald-50/30 transition-colors duration-200"
                    >
                      <td className="px-6 py-4 font-bold text-slate-900">{memberName}</td>
                      <td className="px-6 py-4 font-semibold">{eventName}</td>
                      <td className="px-6 py-4 text-slate-500 font-semibold">{formattedTime}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="3" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Activity className="w-12 h-12 text-slate-200 mb-3" />
                      <p className="text-slate-500 font-semibold">No attendance records yet</p>
                      <p className="text-xs text-slate-400 mt-1">Start scanning to populate this list</p>
                    </div>
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
