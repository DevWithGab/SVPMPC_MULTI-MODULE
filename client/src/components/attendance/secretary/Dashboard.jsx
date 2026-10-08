import React, { useEffect, useState } from 'react';
import { ArrowRight, RefreshCw, Loader2 } from 'lucide-react';
import { attendanceAPI, eventAPI } from '../../../services/api';
import { formatDate, formatTime, formatTimeRange, formatLongDate } from '../../../utils/date';
import { eventStatusLabels } from '../../../utils/eventManagement';
import { loadDashboardRecords, summarizeDashboard, recordTime, eventTime, validTimestamp } from '../../../utils/attendanceDashboard';
import './Dashboard.css';

const statusTone = status => ({ active: 'active', upcoming: 'upcoming', pending_approval: 'pending', rejected: 'revision' }[status] || 'neutral');
const eventName = event => event.eventName || event.name || 'Unnamed event';
const displayDate = value => validTimestamp(value) ? formatDate(value) : 'Date not recorded';

function Status({ status }) {
  return <span className={`sd-status sd-status-${statusTone(status)}`}>{eventStatusLabels[status] || 'Not recorded'}</span>;
}

function DataState({ loading, error, emptyTitle, emptyDescription, onRetry }) {
  return <div className="sd-data-state" role={error ? 'alert' : 'status'}>
    {loading && <Loader2 size={19} className="animate-spin" aria-hidden="true" />}
    <strong>{loading ? 'Loading records…' : error ? 'Unable to load this section' : emptyTitle}</strong>
    <p>{loading ? 'Preparing the latest overview.' : error ? 'Retry to see complete, up-to-date records.' : emptyDescription}</p>
    {error && !loading && <button className="sd-button" onClick={onRetry}>Retry</button>}
  </div>;
}

export default function SecretaryDashboard({ attendanceLogs, events: initialEvents, setActiveTab }) {
  const [events, setEvents] = useState(initialEvents || []);
  const [records, setRecords] = useState(attendanceLogs || []);
  const [loading, setLoading] = useState({ events: true, attendance: true });
  const [errors, setErrors] = useState({});
  const [updatedAt, setUpdatedAt] = useState(null);
  const [reload, setReload] = useState(0);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading({ events: true, attendance: true });
    setErrors({});
    const load = async (key, fetchPage, responseKey, setter) => {
      try {
        const rows = await loadDashboardRecords(fetchPage, responseKey);
        if (!cancelled) setter(rows);
        return true;
      } catch {
        if (!cancelled) setErrors(previous => ({ ...previous, [key]: true }));
        return false;
      } finally {
        if (!cancelled) setLoading(previous => ({ ...previous, [key]: false }));
      }
    };
    Promise.all([
      load('events', eventAPI.getEvents, 'events', setEvents),
      load('attendance', attendanceAPI.getAllAttendance, 'attendance', setRecords),
    ]).then(results => {
      if (!cancelled && results.every(Boolean)) {
        const timestamp = new Date();
        setUpdatedAt(timestamp);
        setNow(timestamp);
      }
    });
    return () => { cancelled = true; };
  }, [reload, initialEvents, attendanceLogs]);

  const { counts, agenda, latest, todayAttendance } = summarizeDashboard(events, records, now);
  const refreshing = loading.events || loading.attendance;
  const retry = () => setReload(value => value + 1);
  const metric = (value, source) => loading[source] || errors[source] ? '—' : value.toLocaleString();
  const eventReady = !loading.events && !errors.events;
  const attendanceReady = !loading.attendance && !errors.attendance;
  const workflow = [
    ['rejected', 'Needs revision', 'Review administrator feedback, edit the event, and resubmit.'],
    ['pending_approval', 'Pending approval', 'Submitted events awaiting administrator review.'],
    ['draft', 'Drafts', 'Events that have not entered the approval queue.'],
  ];

  return <div className="secretary-dashboard">
    <header className="sd-header">
      <div><p className="sd-eyebrow">Attendance management / Overview</p><h1>Attendance dashboard</h1><p className="sd-description">{formatLongDate(now)} <span>· Philippine time</span></p></div>
      <div className="sd-header-actions">
        <button className="sd-button" onClick={retry} disabled={refreshing}><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />{refreshing ? 'Refreshing…' : 'Refresh'}</button>
        <button className="sd-button sd-primary" onClick={() => setActiveTab('events')}>Manage events <ArrowRight size={15} aria-hidden="true" /></button>
      </div>
    </header>

    <section className="sd-metrics" aria-label="Attendance overview" aria-busy={refreshing}>
      {[
        ["Today's attendance", metric(todayAttendance, 'attendance'), 'Records dated today in PHT'],
        ['Total attendance', metric(records.length, 'attendance'), 'All recorded attendance entries'],
        ['Active events', metric(counts.active || 0, 'events'), 'Currently open for attendance'],
        ['Upcoming events', metric(counts.upcoming || 0, 'events'), 'Approved and scheduled'],
      ].map(([label, value, note]) => <div key={label}><p>{label}</p><strong>{value}</strong><span>{note}</span></div>)}
    </section>
    <div className="sd-freshness" role="status">{refreshing ? 'Updating the overview…' : errors.events || errors.attendance ? 'Some records could not be refreshed. Retry the affected section.' : updatedAt ? `Updated ${formatDate(updatedAt)}, ${formatTime(updatedAt)} PHT. Refresh to check for new records.` : 'Overview of recorded attendance.'}</div>

    <div className="sd-workspace">
      <div className="sd-main">
        <section className="sd-panel" aria-labelledby="sd-schedule-title">
          <div className="sd-panel-heading"><div><h2 id="sd-schedule-title">Event schedule</h2><p>Active events first, followed by the next scheduled assemblies.</p></div><button className="sd-link" onClick={() => setActiveTab('events')}>All events <ArrowRight size={14} aria-hidden="true" /></button></div>
          {eventReady && agenda.length ? <>
            <div className="sd-table-scroll" role="region" aria-label="Event schedule" tabIndex={0}><table className="sd-schedule-table"><thead><tr><th scope="col">Event</th><th scope="col">Schedule (PHT)</th><th scope="col">Status</th></tr></thead><tbody>
              {agenda.slice(0, 5).map((event, index) => <tr key={event.eventId || event.id || event._id || index}>
                <td><strong>{eventName(event)}</strong><span className="sd-secondary">{event.location || 'Location not recorded'}</span></td>
                <td>{displayDate(eventTime(event))}<span className="sd-secondary">{formatTimeRange(event.startTime || event.eventTime, event.endTime) || 'Time not recorded'}</span></td>
                <td><Status status={event.status} /></td>
              </tr>)}
            </tbody></table></div>
            <div className="sd-panel-footer">Showing {Math.min(agenda.length, 5)} of {agenda.length} active and upcoming events.</div>
          </> : <DataState loading={loading.events} error={errors.events} onRetry={retry} emptyTitle="No active or upcoming events" emptyDescription="Open Event Management to review approvals or schedule an assembly." />}
        </section>

        <section className="sd-panel" aria-labelledby="sd-attendance-title">
          <div className="sd-panel-heading"><div><h2 id="sd-attendance-title">Latest attendance</h2><p>The five most recent attendance entries across all events.</p></div><button className="sd-link" onClick={() => setActiveTab('live')}>Live attendance <ArrowRight size={14} aria-hidden="true" /></button></div>
          {attendanceReady && latest.length ? <div className="sd-table-scroll" role="region" aria-label="Latest attendance" tabIndex={0}><table className="sd-attendance-table"><thead><tr><th scope="col">Member</th><th scope="col">Event</th><th scope="col">Recorded (PHT)</th></tr></thead><tbody>
            {latest.slice(0, 5).map((record, index) => <tr key={record._id || record.id || index}>
              <td><strong>{record.memberName || record.member_name || record.name || 'Unknown member'}</strong><span className="sd-secondary">Passbook: {record.memberId || record.member_id || 'Not recorded'}</span></td>
              <td>{record.eventName || record.event_name || (typeof record.event === 'string' ? record.event : '') || 'Event not recorded'}</td>
              <td>{displayDate(recordTime(record))}<span className="sd-secondary">{validTimestamp(recordTime(record)) ? formatTime(recordTime(record)) : 'Time not recorded'}</span></td>
            </tr>)}
          </tbody></table></div> : <DataState loading={loading.attendance} error={errors.attendance} onRetry={retry} emptyTitle="No attendance recorded" emptyDescription="New attendance entries will appear here after members check in." />}
        </section>
      </div>

      <aside className="sd-sidebar">
        <section className="sd-panel" aria-labelledby="sd-workflow-title">
          <div className="sd-panel-heading"><div><h2 id="sd-workflow-title">Event workflow</h2><p>Review and approval across all events.</p></div></div>
          {eventReady ? <>
            <dl className="sd-workflow">{workflow.map(([status, label, description]) => <div key={status}><dt><span>{label}</span><small>{description}</small></dt><dd className={status === 'rejected' && counts[status] ? 'sd-revision-count' : ''}>{(counts[status] || 0).toLocaleString()}</dd></div>)}</dl>
            <div className="sd-workflow-footer"><button className="sd-link" onClick={() => setActiveTab('events')}>Open event register <ArrowRight size={14} aria-hidden="true" /></button></div>
            <details className="sd-status-details"><summary>All event statuses <span>{events.length.toLocaleString()} total</span></summary><dl>{Object.entries({ ...eventStatusLabels, unknown: 'Not recorded', ...Object.fromEntries(Object.keys(counts).filter(key => !eventStatusLabels[key] && key !== 'unknown').map(key => [key, key])) }).map(([status, label]) => <div key={status}><dt>{label}</dt><dd>{(counts[status] || 0).toLocaleString()}</dd></div>)}</dl></details>
          </> : <DataState loading={loading.events} error={errors.events} onRetry={retry} />}
        </section>

        <nav className="sd-tools" aria-label="Attendance workspace">
          <h2>Workspace</h2>
          {[
            ['reports', 'Attendance reports', 'Review participation and export records.'],
            ['directory', 'Member directory', 'Find members and access their QR codes.'],
          ].map(([tab, label, description]) => <button key={tab} onClick={() => setActiveTab(tab)}><span><strong>{label}</strong><small>{description}</small></span><ArrowRight size={15} aria-hidden="true" /></button>)}
        </nav>
      </aside>
    </div>
  </div>;
}
