import { Button as ActionButton } from '../../ui/button';
import { PageHeader, Panel, PanelHeader, SearchField } from '../../ui/workspace';
import { Table as DataTable } from '../../ui/table';
import { Select, Input } from '../../ui/input';
import { loadDashboardRecords } from '../../../utils/attendanceDashboard';
import { useEffect, useState } from 'react';
import { ChevronDown, Clock3, History, MapPin, QrCode, RefreshCw, Search } from 'lucide-react';
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
  const [eventFilter, setEventFilter] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const scannedBy = user?.name || user?.fullName || user?.username || '';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!scannedBy) {
        setRecords([]); setLoading(false); return;
      }
      setLoading(true); setError('');
      try {
        // The API scopes personal history to the authenticated operator.
        const history = await loadDashboardRecords(params => attendanceAPI.getAllAttendance({ ...params, mine: true }), 'attendance');
        if (!cancelled) setRecords(history);
      } catch (cause) {
        if (!cancelled) setError(cause?.message || 'Unable to load your scan history.');
      } finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [scannedBy, refreshVersion]);

  const eventValue = record => record.eventId || record.eventName || 'Unknown event';
  const barangayValue = record => record.barangay || 'Not recorded';
  const eventOptions = [...new Map(records.map(record => [eventValue(record), record.eventName || 'Unknown event'])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const barangayOptions = [...new Set(records.map(barangayValue))].sort((a, b) => a.localeCompare(b));
  const query = search.trim().toLowerCase();
  const filteredRecords = records.filter(record => (!eventFilter || eventValue(record) === eventFilter) && (!barangayFilter || barangayValue(record) === barangayFilter) && (!query || [record.memberName || record.member_name, record.memberId || record.member_id].some(value => String(value || '').toLowerCase().includes(query))));
  const total = filteredRecords.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(page, totalPages);
  const pagedRecords = filteredRecords.slice((currentPage - 1) * limit, currentPage * limit);
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
      <div className="oms-total"><span className="oms-total-icon"><History size={18} aria-hidden="true" /></span><div><span>Total check-ins</span><strong>{loading || error ? '...' : records.length.toLocaleString()}</strong></div><small>Across all events</small></div>
    </Panel>

    <Panel as="section" className="sd-panel oms-history" aria-labelledby="oms-history-title" aria-busy={loading}>
      <PanelHeader as="div" className="sd-panel-heading"><div><h2 id="oms-history-title">Scan history</h2><p>Member check-ins recorded by you, from newest to oldest.</p></div><span className="oms-order-label"><Clock3 size={14} aria-hidden="true" />{loading ? 'Loading records...' : error ? 'Refresh failed' : 'Newest first'}</span></PanelHeader>
      <SearchField className="oms-search-field"><Search size={16} aria-hidden="true" /><Input unstyled id="oms-search" aria-label="Search scan history by member name or passbook number" placeholder="Name or passbook number" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></SearchField>
      <div className="oms-filters">
        <label>Event<Select value={eventFilter} disabled={loading} onChange={event => { setEventFilter(event.target.value); setPage(1); }}>
          <option value="">All events</option>
          {eventOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select></label>
        <label>Barangay<Select value={barangayFilter} disabled={loading} onChange={event => { setBarangayFilter(event.target.value); setPage(1); }}>
          <option value="">All barangays</option>
          {barangayOptions.map(value => <option key={value} value={value}>{value}</option>)}
        </Select></label>
        <button type="button" disabled={!eventFilter && !barangayFilter} onClick={() => { setEventFilter(''); setBarangayFilter(''); setPage(1); }}>Reset</button>
      </div>
      {error && <div className="oms-error" role="alert">{error} Use Refresh to try again.</div>}
      <div className="sd-table-scroll oms-table-scroll" role="region" aria-label="Personal scan history" tabIndex={0}>
        <DataTable className="oms-table" aria-label="Your recorded check-ins">
          <colgroup><col className="oms-col-member" /><col className="oms-col-event" /><col className="oms-col-barangay" /><col className="oms-col-time" /></colgroup>
          <thead><tr><th scope="col">Member</th><th scope="col">Event</th><th scope="col">Barangay</th><th scope="col">Check-in <span className="oms-timezone">PHT</span></th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={4}><div className="oms-empty" role="status"><RefreshCw size={24} className="animate-spin" aria-hidden="true" /><strong>Loading your scan history...</strong></div></td></tr> : !error && pagedRecords.length ? pagedRecords.map((record, index) => {
            const timestamp = scanDate(record);
            const name = record.memberName || record.member_name || 'Unknown member';
            const id = record.memberId || record.member_id || 'Not recorded';
            return <tr key={record._id || record.attendanceId || index}>
              <td data-label="Member">
                <div className="oms-desktop-member"><strong className="oms-member-name">{name}</strong><span className="oms-passbook" title={`Passbook: ${id}`}>Passbook <span>{id}</span></span></div>
                <details className="oms-mobile-details" key={`${record.attendanceId || index}-${currentPage}-${eventFilter}-${barangayFilter}`}>
                  <summary><span>{name}</span><ChevronDown size={16} aria-hidden="true" /></summary>
                  <dl className="oms-detail-card">
                    <div><dt>Passbook number</dt><dd>{id}</dd></div>
                    <div><dt>Event</dt><dd>{record.eventName || 'Unknown event'}</dd></div>
                    <div><dt>Barangay</dt><dd>{barangayValue(record)}</dd></div>
                    <div><dt>Check-in (PHT)</dt><dd>{timestamp ? `${formatTime(timestamp)} · ${formatDate(timestamp)}` : 'Time not recorded'}</dd></div>
                  </dl>
                </details>
              </td>
              <td data-label="Event"><span className="oms-event-name">{record.eventName || 'Unknown event'}</span></td>
              <td data-label="Barangay"><span className="oms-location"><MapPin size={13} aria-hidden="true" />{record.barangay || 'Not recorded'}</span></td>
              <td data-label="Check-in (PHT)">{timestamp ? <time className="oms-checkin" dateTime={new Date(timestamp).toISOString()}><strong>{formatTime(timestamp)}</strong><span>{formatDate(timestamp)}</span></time> : <span className="oms-muted">Time not recorded</span>}</td>
            </tr>;
          }) : <tr><td colSpan={4}><div className="oms-empty" role="status"><QrCode size={28} aria-hidden="true" /><strong>{error ? 'Unable to load your scan history' : unavailable ? 'Operator information unavailable' : eventFilter || barangayFilter || query ? 'No matching scans' : 'No scans recorded yet'}</strong><p>{error ? 'Use Refresh to try again.' : unavailable ? 'Sign in with your operator account to view your records.' : eventFilter || barangayFilter || query ? 'Try another name, passbook number, or filter.' : 'Scan a member QR code to record a check-in. Your history will appear here.'}</p></div></td></tr>}</tbody>
        </DataTable>
      </div>
      {!loading && !error && total > 0 && <footer className="oms-pagination"><PaginationInfo currentPage={currentPage} limit={limit} total={total} /><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} hasPrevPage={currentPage > 1} hasNextPage={currentPage < totalPages} /></footer>}
    </Panel>
  </div>;
}
