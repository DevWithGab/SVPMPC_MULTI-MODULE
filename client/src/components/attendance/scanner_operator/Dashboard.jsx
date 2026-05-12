import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { formatDateTime } from "../../../utils/date";

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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-lg shadow-slate-200/40">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400 font-bold">
              Scanner Operator Portal
            </p>
            <h1 className="text-3xl font-black text-slate-950">
              Welcome, {user?.name || "Operator"}
            </h1>
            <p className="mt-2 text-slate-500 max-w-2xl">
              Use the scanner dashboard to process attendance quickly and
              accurately for your assigned events.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/40">
          <p className="text-sm text-slate-500 uppercase tracking-[0.25em] font-bold mb-3">
            Active Events
          </p>
          <p className="text-4xl font-black text-slate-950">
            {activeEventCount}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Active events available for scanning.
          </p>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/40">
          <p className="text-sm text-slate-500 uppercase tracking-[0.25em] font-bold mb-3">
            Recent scans
          </p>
          <p className="text-4xl font-black text-slate-950">{scanCount}</p>
          <p className="mt-2 text-sm text-slate-500">
            Total scans during this session.
          </p>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/40">
          <p className="text-sm text-slate-500 uppercase tracking-[0.25em] font-bold mb-3">
            Scanner Status
          </p>
          <p className="text-4xl font-black text-slate-950">
            {scannerStatusLabel}
          </p>
          <p className="mt-2 text-sm text-slate-500">{scannerStatusMessage}</p>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-lg shadow-slate-200/40">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-950">Quick actions</h2>
            <p className="mt-2 text-slate-500">
              Jump straight to scanning or review your active event queue.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("scanner")}
            className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white shadow-lg shadow-coop-green/20 transition ${hasActiveEvent ? "bg-coop-green hover:bg-coop-darkGreen" : "bg-slate-600 bg-opacity-90 hover:bg-slate-700"}`}
          >
            {hasActiveEvent ? "Start Scanner" : "Open Scanner"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-lg shadow-slate-200/40">
        <div className="flex items-center justify-between gap-4 flex-col sm:flex-row">
          <div>
            <h2 className="text-xl font-black text-slate-950">
              Recent attendance list
            </h2>
            <p className="mt-2 text-slate-500">
              View the latest records captured during your session.
            </p>
          </div>
          <p className="text-sm font-bold text-slate-500">
            {scanCount} record{scanCount === 1 ? "" : "s"} total
          </p>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-600">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-[0.2em] text-xs font-bold">
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Time</th>
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
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-4 font-bold text-slate-900">
                        {memberName}
                      </td>
                      <td className="px-4 py-4">{eventName}</td>
                      <td className="px-4 py-4 text-slate-500">
                        {formattedTime}
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
                    No attendance records available yet. Start scanning to
                    populate this list.
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
