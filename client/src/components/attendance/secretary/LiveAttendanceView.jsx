import { Button as ActionButton } from '../../ui/button';
import { Select } from '../../ui/input';
import { PageHeader } from '../../ui/workspace';
import { Table as DataTable } from '../../ui/table';
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
      <PageHeader separateBreadcrumb className="sla-header">
        <div>
          <p className="sla-eyebrow attendance-breadcrumb"><span>Attendance management</span><span aria-hidden="true">/</span><strong>Live attendance</strong></p>
          <h1>Live attendance</h1>
          <p className="sla-description">Track member check-ins for the active event.</p>
        </div>
        <div className="sla-header-actions">
        <ActionButton variant="outline" className="sla-button" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />{loading ? 'Refreshing…' : 'Refresh'}
        </ActionButton>
        </div>
      </PageHeader>

      {error && <div className="sla-error" role="alert">{error}</div>}

      {activeEvent && <section className="sla-event" aria-labelledby="sla-event-title">
        <div className="sla-event-icon"><Activity size={22} aria-hidden="true" /></div>
        <div className="sla-event-info">
          <p className="sla-eyebrow">Current event</p>
          <div className="sla-event-title-row">
            <h2 id="sla-event-title">{selectedEventLabel}</h2>
          </div>
          <p className="sla-event-updates"><Clock size={14} aria-hidden="true" /><span>Updates every {refreshIntervalSeconds} seconds while this tab is visible.</span></p>
        </div>
        <span className="sla-status sla-status-active" role="status"><span className="sla-status-dot" aria-hidden="true" />{loading ? 'Refreshing' : error ? 'Refresh failed' : 'Active'}</span>
      </section>}

      {activeEvent && <AttendanceMetricGrid label="Active event attendance overview" busy={loading} items={[
        ['Total check-ins', liveRows.length.toLocaleString(), 'Recorded for the active event', Users],
        ['Filtered check-ins', filteredAttendance.length.toLocaleString(), selectedBarangay === 'all' ? 'All barangays' : selectedBarangay, MapPin],
        ['Last refresh', lastRefreshedAt ? formatTime(lastRefreshedAt) : 'Not yet', error ? 'Latest refresh failed' : 'Philippine time', Clock],
      ]} />}

      {!activeEvent ? (
        <section className="sla-panel sla-idle" aria-labelledby="sla-idle-title" aria-busy={loading}>
          <div className="sla-idle-heading">
            <h2>Live check-ins</h2>
            <span className="sla-status">{loading ? 'Checking' : error ? 'Connection issue' : 'Awaiting event'}</span>
          </div>
          <div className="sla-empty sla-idle-body" role="status">
            <span className="sla-idle-icon">{loading ? <RefreshCw size={26} className="animate-spin" aria-hidden="true" /> : <CalendarOff size={26} aria-hidden="true" />}</span>
            <h3 id="sla-idle-title">{loading ? 'Checking for an active event…' : error ? 'Unable to confirm the active event' : 'No active event right now'}</h3>
            <p>{error ? 'Use Refresh to try again. We will also keep checking automatically.' : operatorView ? 'Check with the Secretary or Admin about the event schedule. Member check-ins will appear here once an event is active.' : 'Start an event in Event Management. Member check-ins will appear here automatically once the event is active.'}</p>
          </div>
          <div className="sla-idle-footer"><Clock size={14} aria-hidden="true" /><span>Checks for updates every {refreshIntervalSeconds} seconds while this tab is visible.</span></div>
        </section>
      ) : <>
        <section className="sla-filters" aria-labelledby="sla-filter-title">
          <div className="sla-filter-heading"><h2 id="sla-filter-title">Filter check-ins</h2><button className="sla-text-button" disabled={selectedBarangay === 'all'} onClick={() => onBarangayChange('all')}>Reset filter</button></div>
          <label>Barangay<Select value={selectedBarangay} onChange={e => onBarangayChange(e.target.value)}>
            {availableBarangays.map(barangay => <option key={barangay} value={barangay}>{barangay === 'all' ? 'All barangays' : barangay}</option>)}
            {selectedBarangay !== 'all' && !availableBarangays.includes(selectedBarangay) && <option value={selectedBarangay}>{selectedBarangay}</option>}
          </Select></label>
        </section>
        <section className="sla-panel" aria-labelledby="sla-register-title" aria-busy={loading}>
          <div className="sla-panel-heading"><h2 id="sla-register-title">Check-in register</h2><p>Member details and recorded check-in times.</p></div>
          <div className="sla-scope"><span>{filteredAttendance.length.toLocaleString()} of {liveRows.length.toLocaleString()} check-ins</span><span>{selectedBarangay === 'all' ? 'All barangays' : selectedBarangay}</span></div>
          <div className="sla-table-scroll" role="region" aria-label="Live check-in records" tabIndex={0}>
            <DataTable>
              <thead><tr><th scope="col">Member / Passbook</th><th scope="col">Check-in time</th><th scope="col">Barangay</th><th scope="col">Scanned by</th></tr></thead>
              <tbody>{paginatedAttendance.map(row => (
                <tr key={row.recordId || row.memberKey}>
                  <td><strong>{row.memberName}</strong><span className="sla-secondary">Passbook No.: {row.memberId || row.memberKey || 'N/A'}</span></td>
                  <td>{row.scanTime ? formatDateTime(row.scanTime) : 'Unknown time'}</td>
                  <td>{row.barangay || 'Unassigned'}</td>
                  <td>{attendanceScannedBy(row)}</td>
                </tr>
              ))}</tbody>
            </DataTable>
          </div>
          {paginatedAttendance.length === 0 && <div className="sla-empty" role="status">
            <strong>{loading ? 'Loading check-ins…' : error ? 'Check-ins could not be loaded' : selectedBarangay !== 'all' ? 'No check-ins for this barangay' : 'No check-ins yet for this event'}</strong>
            <p>{error ? 'The list will retry automatically.' : selectedBarangay !== 'all' ? 'Choose another barangay or reset the filter.' : 'Recorded check-ins will appear here as members arrive.'}</p>
            {selectedBarangay !== 'all' && <ActionButton variant="outline" className="sla-button" onClick={() => onBarangayChange('all')}>Reset filter</ActionButton>}
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
