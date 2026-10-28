import { createElement } from 'react';
import { Button as ActionButton } from '../../ui/button';
import { PageHeader, Panel, PanelHeader } from '../../ui/workspace';
import { Table as DataTable } from '../../ui/table';
import { Activity, ArrowRight, CalendarDays, CheckCircle2, Clock3, History, LockKeyhole, MapPin, QrCode } from 'lucide-react';
import AttendanceMetricGrid from '../shared/AttendanceMetricGrid';
import useScannerDashboardEvents from '../../../hooks/useScannerDashboardEvents';
import { formatDate, formatDateTime, formatLongDate, formatTimeRange, formatTimeString, getManilaHour } from '../../../utils/date';
import '../secretary/Dashboard.css';
import './Dashboard.css';

const getTimestamp = record => record.timestamp || record.date || record.scanTime || record.createdAt || '';
const timestampMs = record => new Date(getTimestamp(record)).getTime() || 0;
const EMPTY_EVENTS = [];
const eventKey = (event, index) => event.eventId || event._id || event.id || index;
const eventName = event => event.eventName || event.name || 'Untitled event';
const eventSchedule = event => [
  event.eventDate || event.date ? formatDate(event.eventDate || event.date) : 'Date unavailable',
  formatTimeRange(event.startTime, event.endTime),
].filter(Boolean).join(' / ');

export default function Dashboard({ user, attendanceLogs = [], events = EMPTY_EVENTS, setActiveTab }) {
  const { activeEvents, upcomingEvents, refreshError } = useScannerDashboardEvents(Array.isArray(events) ? events : EMPTY_EVENTS);
  const records = Array.isArray(attendanceLogs) ? attendanceLogs : [];
  const recentRecords = [...records].sort((a, b) => timestampMs(b) - timestampMs(a)).slice(0, 5);
  const hasActiveEvent = activeEvents.length > 0;
  const nextEvent = upcomingEvents[0];
  const hour = getManilaHour();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return <div className="secretary-dashboard scanner-operator-dashboard">
    <PageHeader separateBreadcrumb className="sd-header">
      <div>
        <p className="sd-eyebrow attendance-breadcrumb"><span>Attendance management</span><span aria-hidden="true">/</span><strong>Dashboard</strong></p>
        <h1>Scanner dashboard</h1>
        <p className="sd-description">{formatLongDate()} &middot; Philippine time</p>
        <p className="sod-date">{greeting}, {user?.name || 'Operator'}. Your attendance scanning workspace.</p>
      </div>
      <ActionButton type="button" onClick={() => setActiveTab('scanner')} disabled={!hasActiveEvent} className="sd-button sd-primary">
        <QrCode size={18} aria-hidden="true" /> Start scanning <ArrowRight size={16} aria-hidden="true" />
      </ActionButton>
    </PageHeader>

    <AttendanceMetricGrid label="Scanner overview" items={[
      ['Active events', activeEvents.length.toLocaleString(), hasActiveEvent ? 'Open for scanning now' : 'No session in progress', CalendarDays],
      ['Attendance records', records.length.toLocaleString(), 'Recorded attendance entries', CheckCircle2],
      ['Upcoming events', upcomingEvents.length.toLocaleString(), upcomingEvents.length ? 'Scheduled sessions ahead' : 'No sessions scheduled', Clock3],
    ]} />
    {refreshError && <p role="status" className="sod-refresh-warning">Unable to refresh event availability. Retrying automatically.</p>}

    <div className="sod-dashboard-layout">
      <div className="sod-main-column">
      <Panel as="section" className="sd-panel sod-events" aria-labelledby="sod-events-title">
        <PanelHeader as="div" className="sd-panel-heading">
          <div><h2 id="sod-events-title">Session status</h2><p>Scanning availability at a glance.</p></div>
          <span className={`sod-availability ${hasActiveEvent ? 'sod-availability-ready' : ''}`}><span aria-hidden="true" />{hasActiveEvent ? 'Ready to scan' : 'Standby'}</span>
        </PanelHeader>
        <div className={`sod-session-visual ${hasActiveEvent ? 'sod-visual-active' : ''}`}>
          <ol className="sod-session-stages" aria-label="Session scanning timeline">
            {[
              ['Waiting', 'Before start time', Clock3],
              ['Scanning open', 'During the event', QrCode],
              ['Session closed', 'At the end time', LockKeyhole],
            ].map(([label, hint, icon], index) => <li key={label} className={(hasActiveEvent ? index === 1 : index === 0) ? 'sod-stage-current' : hasActiveEvent && index === 0 ? 'sod-stage-complete' : ''} aria-current={(hasActiveEvent ? index === 1 : index === 0) ? 'step' : undefined}>
              <span className="sod-stage-icon">{createElement(icon, { size: 23, 'aria-hidden': true })}</span><strong>{label}</strong><span className="sod-stage-hint">{hint}</span>
            </li>)}
          </ol>
          <p className="sod-visual-summary" role="status">{hasActiveEvent ? 'Scanning is open for active sessions.' : 'No active event right now'}</p>
          {!hasActiveEvent && (nextEvent ? <div className="sod-next-schedule">
            <div className="sod-next-identity"><CalendarDays size={18} aria-hidden="true" /><div><span>Next session</span><strong>{eventName(nextEvent)}</strong><small>{formatDate(nextEvent.eventDate || nextEvent.date)}</small></div></div>
            <dl><div><dt>Opens (PHT)</dt><dd>{formatTimeString(nextEvent.startTime)}</dd></div><div><dt>Closes (PHT)</dt><dd>{formatTimeString(nextEvent.endTime)}</dd></div></dl>
          </div> : null)}
        </div>
        {hasActiveEvent ? <ul className="sod-event-list">{activeEvents.map((event, index) => <li key={eventKey(event, index)}>
          <span className="sod-session-icon"><QrCode size={21} aria-hidden="true" /></span>
          <div><h3>{eventName(event)}</h3><p className="sod-session-time"><Clock3 size={14} aria-hidden="true" />{eventSchedule(event)}</p><p className="sod-location"><MapPin size={14} aria-hidden="true" />{event.location || 'Location not specified'}</p></div>
          <span className="sod-session-label">Open</span>
        </li>)}</ul> : null}
        <div className="sod-session-footer"><Clock3 size={14} aria-hidden="true" /><span>Availability updates automatically with the event schedule.</span></div>
      </Panel>
      <Panel as="section" className="sd-panel sod-recent" aria-labelledby="sod-recent-title">
        <PanelHeader as="div" className="sd-panel-heading"><div><h2 id="sod-recent-title">Recent attendance</h2><p>The latest member check-ins.</p></div><button type="button" className="sd-link" onClick={() => setActiveTab('live')}>View all <ArrowRight size={14} aria-hidden="true" /></button></PanelHeader>
        {recentRecords.length ? <div className="sd-table-scroll" role="region" aria-label="Recent attendance" tabIndex={0}><DataTable className="sod-attendance-table" aria-label="Recent attendance records">
          <thead><tr><th scope="col">Member</th><th scope="col">Event</th><th scope="col">Recorded at (PHT)</th></tr></thead>
          <tbody>{recentRecords.map((record, index) => {
            const memberName = record.member_name || record.memberName || record.name || 'Unknown member';
            const name = record.eventName || (typeof record.event === 'string' ? record.event : record.event?.eventName || record.event?.name) || 'Unknown event';
            const timestamp = getTimestamp(record);
            return <tr key={record.id ?? record._id ?? index}><td><strong>{memberName}</strong></td><td>{name}</td><td>{timestamp && !Number.isNaN(new Date(timestamp).getTime()) ? formatDateTime(timestamp) : 'Unknown time'}</td></tr>;
          })}</tbody>
        </DataTable></div> : <div className="sod-recent-empty"><History size={23} aria-hidden="true" /><strong>No attendance records yet</strong><p>Member check-ins will appear here once scanning begins.</p></div>}
        {recentRecords.length > 0 && <p className="sd-panel-footer">Showing the latest {recentRecords.length} of {records.length.toLocaleString()} records.</p>}
      </Panel>
      </div>
      <div className="sod-side-column">
      <Panel as="section" className="sd-panel sod-upcoming" aria-labelledby="sod-upcoming-title">
        <PanelHeader as="div" className="sd-panel-heading"><div><h2 id="sod-upcoming-title">Coming up next</h2><p>Your next scheduled sessions.</p></div><CalendarDays size={19} aria-hidden="true" /></PanelHeader>
        {upcomingEvents.length ? <ol className="sod-upcoming-list">{upcomingEvents.slice(0, 3).map((event, index) => <li key={eventKey(event, index)}>
          {index === 0 && <span className="sod-next-label">Next session</span>}
          <h3>{eventName(event)}</h3><p><Clock3 size={14} aria-hidden="true" />{eventSchedule(event)}</p><p><MapPin size={14} aria-hidden="true" />{event.location || 'Location not specified'}</p>
        </li>)}</ol> : <div className="sod-upcoming-empty"><CalendarDays size={23} aria-hidden="true" /><strong>No upcoming sessions</strong><p>New events will appear here when scheduled by the secretary.</p></div>}
      </Panel>
      <nav className="sod-workspace sd-panel" aria-label="Scanner workspace">
        <h2>Quick access</h2><p>Attendance views and your scanning history.</p>
        <button type="button" onClick={() => setActiveTab('live')}><span className="sod-link-icon"><Activity size={20} aria-hidden="true" /></span><span><strong>Live attendance</strong><small>Monitor member check-ins.</small></span><ArrowRight size={16} aria-hidden="true" /></button>
        <button type="button" onClick={() => setActiveTab('myscans')}><span className="sod-link-icon"><History size={20} aria-hidden="true" /></span><span><strong>My scans</strong><small>Review the entries you recorded.</small></span><ArrowRight size={16} aria-hidden="true" /></button>
        <p className="sod-workspace-tip"><QrCode size={16} aria-hidden="true" />Scan each member's QR code once per event.</p>
      </nav>
      </div>
    </div>
  </div>;
}
