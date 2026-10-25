import React from 'react';
import { formatDate, formatTimeRange } from '../../../utils/date';
import './EventDetails.css';

export default function EventDetails({ event, name, formattedDate, statusLabel, category = 'Attendance event', closedNote }) {
  return <div className="event-details">
    <div className="event-details-summary">
      <div><p>{category}</p><h3>{name || event.eventName || event.name || 'Untitled event'}</h3></div>
      <span className={`event-details-status event-details-status-${event.status}`}>{statusLabel || event.status}</span>
    </div>
    {event.status === 'rejected' && <div className="event-details-rejection">
      <strong>Event Rejected - Revision required</strong>
      {event.rejectionReason && <p>Reason: {event.rejectionReason}</p>}
    </div>}
    <dl className="event-details-fields">
      <div><dt>Event reference</dt><dd>{event.eventId || event._id || event.id || 'Not recorded'}</dd></div>
      <div><dt>Scheduled date</dt><dd>{formattedDate || formatDate(event.eventDate || event.date)}</dd></div>
      <div><dt>Time (PHT)</dt><dd>{formatTimeRange(event.startTime || event.eventTime, event.endTime)}</dd></div>
      <div><dt>Location</dt><dd>{event.location || 'Not specified'}</dd></div>
      <div><dt>Description</dt><dd>{event.description || 'No description provided.'}</dd></div>
    </dl>
    {event.status === 'closed' && <p className="event-details-note">{closedNote || 'This event is closed. Recorded details are read-only.'}</p>}
  </div>;
}