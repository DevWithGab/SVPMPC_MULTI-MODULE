import { useEffect, useState } from "react";
import { QrCode, RefreshCw, UserRound } from "lucide-react";
import { Pagination, PaginationInfo } from "../../ui/pagination";
import { usePagination } from "../../../hooks/usePagination";
import { attendanceAPI } from "../../../services/api";
import { formatDateTime } from "../../../utils/date";
import "../secretary/Dashboard.css";
import "./MyScans.css";

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
  const [refreshVersion, setRefreshVersion] = useState(0);

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
  }, [scannedBy, page, limit, refreshVersion]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="secretary-dashboard operator-my-scans">
      <header className="sd-header">
        <div>
          <p className="sd-eyebrow">Attendance management / Scanner operator</p>
          <h1>My scans</h1>
          <p className="sd-description">Review attendance records you personally scanned across all events.</p>
        </div>
        <button type="button" className="sd-button" disabled={loading || !scannedBy} onClick={() => setRefreshVersion(value => value + 1)}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <section className="sd-panel oms-operator" aria-label="Scan history scope">
        <span className="oms-icon"><UserRound size={18} aria-hidden="true" /></span>
        <div>
          <p className="sd-eyebrow">Scanner operator</p>
          <h2>{scannedBy || 'Operator unavailable'}</h2>
          <p className="sd-secondary">Your recorded check-ins across events, including previous sessions.</p>
        </div>
      </section>

      <section className="sd-panel" aria-labelledby="oms-history-title" aria-busy={loading}>
        <div className="sd-panel-heading">
          <div>
            <h2 id="oms-history-title">Scan history</h2>
            <p>Member details, event names, and recorded check-in times.</p>
          </div>
          <span className="sd-status sd-status-neutral">
            {loading ? 'Loading records…' : error ? 'Refresh failed' : `${total.toLocaleString()} record${total === 1 ? '' : 's'}`}
          </span>
        </div>
          {error && (
            <div className="oms-error" role="alert">
              {error} Use Refresh to try again.
            </div>
          )}

          <div className="sd-table-scroll" role="region" aria-label="Personal scan history" tabIndex={0}>
            <table className="oms-table">
              <thead>
                <tr>
                  <th scope="col">Member / Passbook</th>
                  <th scope="col">Event</th>
                  <th scope="col">Barangay</th>
                  <th scope="col">Check-in time (PHT)</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4" className="px-5 py-12 text-center text-slate-400">
                      <div className="sd-data-state" role="status">
                        <RefreshCw size={24} className="animate-spin" aria-hidden="true" />
                        <strong>Loading your scan history…</strong>
                      </div>
                    </td>
                  </tr>
                ) : !error && records.length > 0 ? (
                  records.map((record, index) => (
                    <tr
                      key={record._id || record.attendanceId || index}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="px-5 py-3 font-semibold text-slate-900">
                        {record.memberName || "Unknown member"}
                        <span className="sd-secondary">Passbook No.: {record.memberId || 'N/A'}</span>
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
                      <div className="sd-data-state" role="status">
                        <QrCode size={26} aria-hidden="true" />
                        <strong>{error ? 'Unable to load your scan history' : !scannedBy ? 'Operator information unavailable' : "You haven't scanned any members yet"}</strong>
                        <p>{error ? 'Refresh to try loading your records again.' : !scannedBy ? 'Sign in with your operator account to view your records.' : 'Use Scan Attendance to record a member. Your check-ins will appear here.'}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {!loading && !error && total > 0 && (
            <footer className="oms-pagination">
              <PaginationInfo currentPage={page} limit={limit} total={total} />
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                hasPrevPage={page > 1}
                hasNextPage={page < totalPages}
              />
            </footer>
          )}
      </section>
    </div>
  );
}
