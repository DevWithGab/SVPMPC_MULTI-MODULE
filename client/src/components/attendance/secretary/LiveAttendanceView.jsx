import { Activity, CalendarOff, Clock, MapPin, RefreshCw, Users } from 'lucide-react';
import AttendanceMetricGrid from '../shared/AttendanceMetricGrid';
import { Pagination, PaginationInfo } from '../../ui/pagination';
import { formatDateTime, formatTime } from '../../../utils/date';
import './LiveAttendance.css';
import { attendanceScannedBy } from '../../../utils/attendanceScannedBy';

export default function LiveAttendanceView({
  activeEvent, selectedEventLabel, liveRows, filteredAttendance, paginatedAttendance,
  selectedBarangay, availableBarangays, onBarangayChange, loading, error,
  lastRefreshedAt, onRefresh, currentPage, totalPages, pageSize, onPageChange,
  operatorView = false,
  refreshIntervalSeconds = 3,
}) {
  return (
    <div className="secretary-live-attendance">
      <header className="sla-header">
        <div>
          <p className="sla-eyebrow">Attendance management / {operatorView ? 'Scanner operator' : 'Live attendance'}</p>
          <h1>Live attendance</h1>
          <p className="sla-description">Track member check-ins for the active event.</p>
        </div>
        <button className="sla-button" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />{loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {error && <div className="sla-error" role="alert">{error}</div>}

      <section className="sla-event" aria-labelledby="sla-event-title">
        <div className="sla-event-icon">{activeEvent ? <Activity size={20} aria-hidden="true" /> : <CalendarOff size={20} aria-hidden="true" />}</div>
        <div className="sla-event-info">
          <p className="sla-eyebrow">Active event</p>
          <h2 id="sla-event-title">{loading && !activeEvent ? 'Checking for an active event…' : selectedEventLabel}</h2>
          <p>Updates automatically every {refreshIntervalSeconds} seconds while this tab is visible.</p>
        </div>
        <span className={`sla-status${activeEvent ? ' sla-status-active' : ''}`}>{loading ? 'Refreshing' : error ? 'Refresh failed' : activeEvent ? 'Active' : 'No active event'}</span>
      </section>

      {activeEvent && <AttendanceMetricGrid label="Active event attendance overview" busy={loading} items={[
        ['Total check-ins', liveRows.length.toLocaleString(), 'Recorded for the active event', Users],
        ['Filtered check-ins', filteredAttendance.length.toLocaleString(), selectedBarangay === 'all' ? 'All barangays' : selectedBarangay, MapPin],
        ['Last refresh', lastRefreshedAt ? formatTime(lastRefreshedAt) : 'Not yet', error ? 'Latest refresh failed' : 'Philippine time', Clock],
      ]} />}

      {!activeEvent ? (
        <div className="sla-panel sla-empty" role="status">
          {loading ? <RefreshCw size={28} className="animate-spin" aria-hidden="true" /> : <CalendarOff size={28} aria-hidden="true" />}
          <strong>{loading ? 'Loading live attendance…' : error ? 'Unable to confirm the active event' : 'No active event right now'}</strong>
          <p>{error ? 'The event and its check-ins will be checked again automatically.' : operatorView ? 'Check with the Secretary or Admin about the event schedule. Member check-ins will appear here once an event is active.' : 'Start an event from Event Management to see member check-ins here.'}</p>
        </div>
      ) : <>
        <section className="sla-filters" aria-labelledby="sla-filter-title">
          <div className="sla-filter-heading"><h2 id="sla-filter-title">Filter check-ins</h2><button className="sla-text-button" disabled={selectedBarangay === 'all'} onClick={() => onBarangayChange('all')}>Reset filter</button></div>
          <label>Barangay<select value={selectedBarangay} onChange={e => onBarangayChange(e.target.value)}>
            {availableBarangays.map(barangay => <option key={barangay} value={barangay}>{barangay === 'all' ? 'All barangays' : barangay}</option>)}
            {selectedBarangay !== 'all' && !availableBarangays.includes(selectedBarangay) && <option value={selectedBarangay}>{selectedBarangay}</option>}
          </select></label>
        </section>
        <section className="sla-panel" aria-labelledby="sla-register-title" aria-busy={loading}>
          <div className="sla-panel-heading"><h2 id="sla-register-title">Check-in register</h2><p>Member details and recorded check-in times.</p></div>
          <div className="sla-scope"><span>{filteredAttendance.length.toLocaleString()} of {liveRows.length.toLocaleString()} check-ins</span><span>{selectedBarangay === 'all' ? 'All barangays' : selectedBarangay}</span></div>
          <div className="sla-table-scroll" role="region" aria-label="Live check-in records" tabIndex={0}>
            <table>
              <thead><tr><th scope="col">Member / Passbook</th><th scope="col">Check-in time</th><th scope="col">Barangay</th><th scope="col">Scanned by</th></tr></thead>
              <tbody>{paginatedAttendance.map(row => (
                <tr key={row.recordId || row.memberKey}>
                  <td><strong>{row.memberName}</strong><span className="sla-secondary">Passbook No.: {row.memberId || row.memberKey || 'N/A'}</span></td>
                  <td>{row.scanTime ? formatDateTime(row.scanTime) : 'Unknown time'}</td>
                  <td>{row.barangay || 'Unassigned'}</td>
                  <td>{attendanceScannedBy(row)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {paginatedAttendance.length === 0 && <div className="sla-empty" role="status">
            <strong>{loading ? 'Loading check-ins…' : error ? 'Check-ins could not be loaded' : selectedBarangay !== 'all' ? 'No check-ins for this barangay' : 'No check-ins yet for this event'}</strong>
            <p>{error ? 'The list will retry automatically.' : selectedBarangay !== 'all' ? 'Choose another barangay or reset the filter.' : 'Recorded check-ins will appear here as members arrive.'}</p>
            {selectedBarangay !== 'all' && <button className="sla-button" onClick={() => onBarangayChange('all')}>Reset filter</button>}
          </div>}
          <footer className="sla-pagination">
            <PaginationInfo currentPage={currentPage} limit={pageSize} total={filteredAttendance.length} />
            {filteredAttendance.length > 0 && <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} hasPrevPage={currentPage > 1} hasNextPage={currentPage < totalPages} />}
          </footer>
        </section>
      </>}
    </div>
  );
}
