import { Activity, ArrowRight, CalendarDays, CheckCircle2, History, MapPin, QrCode, Zap } from "lucide-react";
import AttendanceMetricGrid from "../shared/AttendanceMetricGrid";
import useScannerDashboardEvents from '../../../hooks/useScannerDashboardEvents';
import { formatDate, formatDateTime, formatLongDate, formatTimeRange, getManilaHour } from "../../../utils/date";
import "../secretary/Dashboard.css";
import "./Dashboard.css";

const getTimestamp = (record) => record.timestamp || record.date || record.scanTime || record.createdAt || "";
const timestampMs = (record) => new Date(getTimestamp(record)).getTime() || 0;
const EMPTY_EVENTS = [];

export default function Dashboard({ user, attendanceLogs = [], events = EMPTY_EVENTS, setActiveTab }) {
  const { activeEvents, refreshError } = useScannerDashboardEvents(Array.isArray(events) ? events : EMPTY_EVENTS);
  const records = Array.isArray(attendanceLogs) ? attendanceLogs : [];
  const recentRecords = [...records].sort((a, b) => timestampMs(b) - timestampMs(a)).slice(0, 5);
  const hasActiveEvent = activeEvents.length > 0;
  const hour = getManilaHour();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="secretary-dashboard scanner-operator-dashboard">
      <header className="sd-header">
        <div>
          <p className="sd-eyebrow">Attendance management / Scanner operator</p>
          <h1>Scanner dashboard</h1>
          <p className="sd-description">{greeting}, {user?.name || "Operator"}. Scan member QR codes and monitor event attendance.</p>
          <p className="sod-date">{formatLongDate()} &middot; Philippine time (PHT)</p>
        </div>
        <button type="button" onClick={() => setActiveTab("scanner")} disabled={!hasActiveEvent} className="sd-button sd-primary">
          <QrCode size={16} aria-hidden="true" />
          {hasActiveEvent ? "Start scanning" : "No active event"}
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </header>

      <AttendanceMetricGrid label="Scanner overview" items={[
        ['Active events', activeEvents.length.toLocaleString(), hasActiveEvent ? 'Available for attendance scanning' : 'No events currently active', CalendarDays],
        ['Attendance records', records.length.toLocaleString(), 'Records loaded in the attendance view', CheckCircle2],
        ['Scanning availability', hasActiveEvent ? 'Ready' : 'Standby', hasActiveEvent ? 'An active event is available' : 'Waiting for an active event', Zap],
      ]} />

      <section className="sd-panel sod-events" aria-labelledby="sod-events-title">
        {refreshError && <p role="status" className="px-5 pt-4 text-sm text-amber-800">Unable to refresh event availability. Retrying automatically.</p>}
        <div className="sd-panel-heading">
          <div>
            <h2 id="sod-events-title">Active event sessions</h2>
            <p>{hasActiveEvent ? 'Choose an active event in the scanner to begin recording attendance.' : 'Scanning becomes available when an approved event is active.'}</p>
          </div>
          <span className={`sd-status ${hasActiveEvent ? 'sd-status-active' : 'sd-status-neutral'}`}>
            {hasActiveEvent ? `${activeEvents.length} active` : 'Standby'}
          </span>
        </div>
        {hasActiveEvent ? (
          <ul className="sod-event-list">
            {activeEvents.map((event, index) => (
              <li key={event.eventId || event._id || event.id || index}>
                <span className="sod-icon"><CalendarDays size={17} aria-hidden="true" /></span>
                <div>
                  <h3>{event.eventName || event.name || 'Untitled event'}</h3>
                  <p>
                    {event.eventDate || event.date ? formatDate(event.eventDate || event.date) : 'Date unavailable'}
                    {(event.startTime || event.endTime) && ` / ${formatTimeRange(event.startTime, event.endTime)} PHT`}
                  </p>
                </div>
                <span className="sod-location"><MapPin size={14} aria-hidden="true" />{event.location || 'Location not specified'}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="sd-data-state">
            <CalendarDays size={26} aria-hidden="true" />
            <strong>No active event right now</strong>
            <p>Check with the Secretary or Admin about the event schedule. You can still review attendance and your scan history.</p>
          </div>
        )}
      </section>

      <section className="sd-panel sod-recent" aria-labelledby="sod-recent-title">
        <div className="sd-panel-heading">
          <div><h2 id="sod-recent-title">Recent attendance</h2><p>Latest records from the shared attendance view.</p></div>
          <button type="button" className="sd-link" onClick={() => setActiveTab("live")}>
            View attendance <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
        {recentRecords.length ? (
          <div className="sd-table-scroll">
            <table className="sod-attendance-table" aria-label="Recent attendance records">
              <thead><tr><th scope="col">Member</th><th scope="col">Event</th><th scope="col">Recorded at (PHT)</th></tr></thead>
              <tbody>
                {recentRecords.map((record, index) => {
                  const memberName = record.member_name || record.memberName || record.name || 'Unknown member';
                  const eventName = record.eventName || (typeof record.event === 'string' ? record.event : record.event?.eventName || record.event?.name) || 'Unknown event';
                  const timestamp = getTimestamp(record);
                  const formattedTime = timestamp && !Number.isNaN(new Date(timestamp).getTime()) ? formatDateTime(timestamp) : 'Unknown time';
                  return (
                    <tr key={record.id ?? record._id ?? index}>
                      <td><strong>{memberName}</strong></td>
                      <td>{eventName}</td>
                      <td>{formattedTime}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="sd-data-state">
            <QrCode size={26} aria-hidden="true" />
            <strong>No attendance records yet</strong>
            <p>{hasActiveEvent ? 'Start scanning member QR codes to record attendance.' : 'Attendance records will appear here once scanning begins for an active event.'}</p>
          </div>
        )}
        {recentRecords.length > 0 && <p className="sd-panel-footer">Showing {recentRecords.length} of {records.length.toLocaleString()} loaded records.</p>}
      </section>

      <nav className="sod-workspace" aria-label="Scanner workspace">
        <h2>Workspace</h2>
        <div className="sod-shortcuts">
          <button type="button" onClick={() => setActiveTab("live")}>
            <span className="sod-icon"><Activity size={17} aria-hidden="true" /></span>
            <span><strong>Live attendance</strong><small>Review check-ins and event participation.</small></span>
            <ArrowRight size={15} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => setActiveTab("myscans")}>
            <span className="sod-icon"><History size={17} aria-hidden="true" /></span>
            <span><strong>My scans</strong><small>View records you personally scanned across events.</small></span>
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      </nav>
    </div>
  );
}
