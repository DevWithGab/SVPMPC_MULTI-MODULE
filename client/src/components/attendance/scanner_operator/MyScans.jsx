import { useEffect, useState } from "react";
import { QrCode } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Pagination, PaginationInfo } from "../../ui/pagination";
import { usePagination } from "../../../hooks/usePagination";
import { attendanceAPI } from "../../../services/api";
import { formatDateTime } from "../../../utils/date";

const PAGE_SIZE = 10;

// Every attendance record this operator has personally scanned in, across
// every event — not just the last few from this browser session. Filtered
// server-side by the same `scannedBy` value QRScanner.jsx stamps on each
// scan (the operator's name/username).
export default function MyScans({ user }) {
  const { page, limit, setPage } = usePagination(1, PAGE_SIZE);
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const scannedBy = user?.name || user?.username || "";

  useEffect(() => {
    if (!scannedBy) {
      setRecords([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    attendanceAPI
      .getAllAttendance({ page, limit, scannedBy })
      .then((response) => {
        if (cancelled) return;
        setRecords(response?.attendance || []);
        setTotal(response?.pagination?.total ?? 0);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Error fetching my scans:", err);
        setError(err?.message || "Unable to load your scan history.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [scannedBy, page, limit]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          MY SCANS
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Every attendance record you've personally scanned in, across all
          events.
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-100 p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-sm font-bold text-slate-900">
              Scan History
            </CardTitle>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-coop-green border border-green-200">
              {total} record{total === 1 ? "" : "s"}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div className="px-5 py-4 text-sm font-medium text-red-600 bg-red-50 border-b border-red-100">
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 text-[10px] font-semibold uppercase tracking-wide">
                  <th className="px-5 py-3">Member</th>
                  <th className="px-5 py-3">Event</th>
                  <th className="px-5 py-3">Barangay</th>
                  <th className="px-5 py-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 stagger-in">
                {loading ? (
                  <tr>
                    <td colSpan="4" className="px-5 py-12 text-center text-slate-400">
                      Loading your scan history...
                    </td>
                  </tr>
                ) : records.length > 0 ? (
                  records.map((record, index) => (
                    <tr
                      key={record._id || record.attendanceId || index}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="px-5 py-3 font-semibold text-slate-900">
                        {record.memberName || "Unknown member"}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {record.eventName || "Unknown event"}
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {record.barangay || "Unassigned"}
                      </td>
                      <td className="px-5 py-3 text-slate-400">
                        {record.scanTime
                          ? formatDateTime(record.scanTime)
                          : "Unknown time"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="px-5 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <QrCode className="w-8 h-8 text-slate-300" />
                        <p className="font-medium">
                          You haven't scanned any members yet
                        </p>
                        <p className="text-xs">
                          Records you scan will show up here
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {total > 0 && (
            <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <PaginationInfo currentPage={page} limit={limit} total={total} />
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                hasPrevPage={page > 1}
                hasNextPage={page < totalPages}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
