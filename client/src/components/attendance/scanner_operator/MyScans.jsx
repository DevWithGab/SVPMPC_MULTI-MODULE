import { Button as ActionButton } from '../../ui/button';
import { PageHeader, Panel, PanelHeader } from '../../ui/workspace';
import { Table as DataTable } from '../../ui/table';
import { useEffect, useState } from 'react';
import { Clock3, History, MapPin, QrCode, RefreshCw } from 'lucide-react';
import { Pagination, PaginationInfo } from '../../ui/pagination';
import { usePagination } from '../../../hooks/usePagination';
import { attendanceAPI } from '../../../services/api';
import { formatDate, formatTime } from '../../../utils/date';
import '../secretary/Dashboard.css';
import './MyScans.css';

const PAGE_SIZE = 100;
const scanDate = record => {
  const value = record.scanTime || record.timestamp;
  return value && Number.isFinite(new Date(value).getTime()) ? value : null;
};

export default function MyScans({ user }) {
  const { page, limit, setPage } = usePagination(1, PAGE_SIZE);
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const scannedBy = user?.name || user?.fullName || user?.username || '';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!scannedBy) {
        setRecords([]); setTotal(0); setLoading(false); return;
      }
      setLoading(true); setError('');
      try {
        // The API scopes personal history to the authenticated operator.
        const response = await attendanceAPI.getAllAttendance({ page, limit, mine: true });
        if (!cancelled) { setRecords(response?.attendance || []); setTotal(response?.pagination?.total ?? 0); }
      } catch (cause) {
        if (!cancelled) setError(cause?.message || 'Unable to load your scan history.');
      } finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [scannedBy, page, limit, refreshVersion]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const unavailable = !scannedBy;

  return <div className="secretary-dashboard operator-my-scans">
    <PageHeader separateBreadcrumb className="sd-header">
      <div>
        <p className="sd-eyebrow attendance-breadcrumb"><span>Attendance management</span><span aria-hidden="true">/</span><strong>My scans</strong></p>
        <h1>My scans</h1><p className="sd-description">Your personal attendance check-in history across events.</p>
      </div>
      <ActionButton variant="outline" type="button" className="sd-button" disabled={loading || unavailable} onClick={() => setRefreshVersion(value => value + 1)}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />{loading ? 'Refreshing...' : 'Refresh'}</ActionButton>
    </PageHeader>

    <Panel as="section" className="sd-panel oms-operator" aria-label="Scan history scope">
      <div className="oms-identity"><span className="oms-identity-icon"><QrCode size={23} aria-hidden="true" /></span><div><p className="oms-role-label">Scanner operator</p><h2>{scannedBy || 'Operator unavailable'}</h2><p className="oms-identity-hint">Only check-ins recorded by your account.</p></div></div>
      <div className="oms-total"><span className="oms-total-icon"><History size={18} aria-hidden="true" /></span><div><span>Total check-ins</span><strong>{loading || error ? '...' : total.toLocaleString()}</strong></div><small>Across all events</small></div>
    </Panel>

    <Panel as="section" className="sd-panel oms-history" aria-labelledby="oms-history-title" aria-busy={loading}>
      <PanelHeader as="div" className="sd-panel-heading"><div><h2 id="oms-history-title">Scan history</h2><p>Member check-ins recorded by you, from newest to oldest.</p></div><span className="oms-order-label"><Clock3 size={14} aria-hidden="true" />{loading ? 'Loading records...' : error ? 'Refresh failed' : 'Newest first'}</span></PanelHeader>
      {error && <div className="oms-error" role="alert">{error} Use Refresh to try again.</div>}
      <div className="sd-table-scroll oms-table-scroll" role="region" aria-label="Personal scan history" tabIndex={0}>
        <DataTable className="oms-table" aria-label="Your recorded check-ins">
          <colgroup><col className="oms-col-member" /><col className="oms-col-event" /><col className="oms-col-barangay" /><col className="oms-col-time" /></colgroup>
          <thead><tr><th scope="col">Member</th><th scope="col">Event</th><th scope="col">Barangay</th><th scope="col">Check-in <span className="oms-timezone">PHT</span></th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={4}><div className="oms-empty" role="status"><RefreshCw size={24} className="animate-spin" aria-hidden="true" /><strong>Loading your scan history...</strong></div></td></tr> : !error && records.length ? records.map((record, index) => {
            const timestamp = scanDate(record);
            const name = record.memberName || record.member_name || 'Unknown member';
            const id = record.memberId || record.member_id || 'Not recorded';
            return <tr key={record._id || record.attendanceId || index}>
              <td data-label="Member"><strong className="oms-member-name">{name}</strong><span className="oms-passbook" title={`Passbook: ${id}`}>Passbook <span>{id}</span></span></td>
              <td data-label="Event"><span className="oms-event-name">{record.eventName || 'Unknown event'}</span></td>
              <td data-label="Barangay"><span className="oms-location"><MapPin size={13} aria-hidden="true" />{record.barangay || 'Not recorded'}</span></td>
              <td data-label="Check-in (PHT)">{timestamp ? <time className="oms-checkin" dateTime={new Date(timestamp).toISOString()}><strong>{formatTime(timestamp)}</strong><span>{formatDate(timestamp)}</span></time> : <span className="oms-muted">Time not recorded</span>}</td>
            </tr>;
          }) : <tr><td colSpan={4}><div className="oms-empty" role="status"><QrCode size={28} aria-hidden="true" /><strong>{error ? 'Unable to load your scan history' : unavailable ? 'Operator information unavailable' : 'No scans recorded yet'}</strong><p>{error ? 'Use Refresh to try again.' : unavailable ? 'Sign in with your operator account to view your records.' : 'Scan a member QR code to record a check-in. Your history will appear here.'}</p></div></td></tr>}</tbody>
        </DataTable>
      </div>
      {!loading && !error && total > 0 && <footer className="oms-pagination"><PaginationInfo currentPage={page} limit={limit} total={total} /><Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} hasPrevPage={page > 1} hasNextPage={page < totalPages} /></footer>}
    </Panel>
  </div>;
}
