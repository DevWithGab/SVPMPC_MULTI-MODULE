import React from 'react';
import { CalendarDays, Clock3, MapPin, FileText, Hash } from 'lucide-react';
import { formatDate, formatTimeRange } from '../../../utils/date';
import './EventDetails.css';

export default function EventDetails({ event, name, formattedDate, statusLabel, category = 'Attendance event', closedNote }) {
  return <div className="event-details">
    <div className="event-details-summary">
      <div className="event-details-heading"><p>{category}</p><h3>{name || event.eventName || event.name || 'Untitled event'}</h3></div>
      <span className={`event-details-status event-details-status-${event.status}`}><span aria-hidden="true" />{statusLabel || event.status}</span>
    </div>
    {event.status === 'rejected' && <div className="event-details-rejection"><strong>Event Rejected - Revision required</strong>{event.rejectionReason && <p>Reason: {event.rejectionReason}</p>}</div>}
    <dl className="event-details-fields">
      <div className="event-details-schedule"><dt><CalendarDays size={16} aria-hidden="true" />Scheduled date</dt><dd>{formattedDate || formatDate(event.eventDate || event.date)}</dd></div>
      <div className="event-details-schedule"><dt><Clock3 size={16} aria-hidden="true" />Time (PHT)</dt><dd>{formatTimeRange(event.startTime || event.eventTime, event.endTime)}</dd></div>
      <div className="event-details-location"><dt><MapPin size={16} aria-hidden="true" />Location</dt><dd>{event.location || 'Not specified'}</dd></div>
      <div className="event-details-description"><dt><FileText size={16} aria-hidden="true" />Description</dt><dd className={!event.description ? 'event-details-empty' : undefined}>{event.description || 'No description provided.'}</dd></div>
      {event.reopenReason && <div className="event-details-reopen"><dt>Reason for reopening</dt><dd>{event.reopenReason}</dd></div>}
      <div className="event-details-reference"><dt><Hash size={14} aria-hidden="true" />Event reference</dt><dd>{event.eventId || event._id || event.id || 'Not recorded'}</dd></div>
    </dl>
    {event.status === 'closed' && <p className="event-details-note">{closedNote || 'This event is closed. Recorded details are read-only.'}</p>}
  </div>;
}
