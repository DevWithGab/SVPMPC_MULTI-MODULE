const mongoose = require('mongoose');
const Event = require('../models/Event');
const { v4: uuidv4 } = require('uuid');
const { createAuditLog } = require('../../../shared/services/auditLoggingService');
const { safeErrorMessage } = require('../../../middleware/errorHandler');

const getPhtParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, year: parts.year, month: parts.month, day: parts.day };
};

const getPhtDateTime = (event) => {
  const date = getPhtParts(event.eventDate).date;
  const [hours, minutes] = String(event.startTime || '00:00').split(':').map(Number);
  return new Date(`${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+08:00`);
};

const getEventEndDateTime = (event) => {
  const date = getPhtParts(event.eventDate).date;
  const [hours, minutes] = String(event.endTime || '23:59').split(':').map(Number);
  const start = getPhtDateTime(event);
  let end = new Date(`${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+08:00`);
  if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  return end;
};

const refreshEventStatus = async (event) => {
  if (!event || !['upcoming', 'active'].includes(event.status)) return event;
  const now = new Date();
  const nextStatus = now >= getEventEndDateTime(event)
    ? 'closed'
    : now >= getPhtDateTime(event) ? 'active' : 'upcoming';
  if (nextStatus !== event.status) {
    event.status = nextStatus;
    await event.save();
  }
  return event;
};

const getEventFilter = (identifier) => {
  if (!identifier) return null;
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    return { _id: identifier };
  }
  return { eventId: identifier };
};

// check and update finished events
const checkAndUpdateCompletedEvents = async () => {
  try {
    const events = await Event.find({ status: { $in: ['upcoming', 'active'] } });
    for (const event of events) await refreshEventStatus(event);
  } catch (error) {
    console.error('Error updating completed events:', error);
  }
};

const eventStatusTimer = setInterval(checkAndUpdateCompletedEvents, 60 * 1000);
eventStatusTimer.unref();

/* Ang route ang nagsasabi kung kailangan pa ng approval - para hindi
basta lumabas na "Upcoming" yung event na ginawa ng Secretary, at
ma-miss sa Pending Approvals list ng Admin. */
const handleCreateEvent = async (req, res, { autoApprove }) => {
  try {
    const { eventName, eventDate, eventTime, startTime, endTime, location, description, type, createdBy } = req.body;

    if (!eventName || !eventDate || !startTime || !endTime || !location || !createdBy) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const newEvent = new Event({
      eventId: uuidv4(),
      eventName,
      eventDate,
      eventTime: startTime, // keep eventTime for backward compatibility, same as startTime
      startTime,
      endTime,
      location,
      description,
      type: type || 'General Assembly',
      status: autoApprove ? 'upcoming' : 'pending_approval',
      createdBy,
    });

    const saved = await newEvent.save();

    // log the audit event
    await createAuditLog({
      userId: req.user?.userId || req.user?.id || createdBy,
      userName: req.user?.fullName || req.user?.name || req.user?.username || createdBy,
      userRole: req.user?.role || 'admin',
      action: 'event_created',
      module: 'attendance',
      entityType: 'event',
      entityId: saved.eventId,
      entityName: eventName,
      description: `Event "${eventName}" created for ${location}`,
      changes: {
        before: null,
        after: saved.toObject(),
      },
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json({
      message: 'Event created successfully',
      event: saved,
    });
  } catch (error) {
    // log the failed attempt
    await createAuditLog({
      userId: req.user?.userId || req.user?.id,
      userName: req.user?.fullName || req.user?.name || req.user?.username || 'Unknown',
      userRole: req.user?.role || 'admin',
      action: 'event_created',
      module: 'attendance',
      entityType: 'event',
      entityName: req.body.eventName,
      description: `Failed to create event "${req.body.eventName}"`,
      status: 'failed',
      errorMessage: error.message,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(500).json({ message: 'Error creating event', error: safeErrorMessage(error) });
  }
};

/* Ginagamit ng Secretary, legacy, at member routes - laging pending_approval
muna para makita ng Admin sa Pending Approvals list. */
const createEvent = (req, res) => handleCreateEvent(req, res, { autoApprove: false });

/* Admin route lang gumagamit nito - walang mag-a-approve sa Admin, kaya
diretso na sa "upcoming" status. */
const createEventAsAdmin = (req, res) => handleCreateEvent(req, res, { autoApprove: true });

// get all events, with filters and pagination
const getAllEvents = async (req, res) => {
  try {
    // check and update finished events
    await checkAndUpdateCompletedEvents();

    const { q, location, status } = req.query;
    const { page, limit, skip } = require('../../../shared/utils/pagination').getPaginationParams(req.query);

    // build filter from query params
    const filter = {};

    if (location) {
      filter.location = location;
    }

    if (status) {
      filter.status = status;
    }

    if (q) {
      const regex = new RegExp(q, 'i');
      // search eventName and location
      filter.$or = [{ eventName: regex }, { location: regex }];
    }

    // get total count for pagination
    const total = await Event.countDocuments(filter);

    // get events, one page at a time
    const events = await Event.find(filter)
      .sort({ eventDate: -1, startTime: -1 })
      .skip(skip)
      .limit(limit);

    const { buildPaginatedResponse } = require('../../../shared/utils/pagination');
    res.status(200).json(buildPaginatedResponse(events, total, page, limit));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching events', error: safeErrorMessage(error) });
  }
};

// find event by ID
const getEventById = async (req, res) => {
  try {
    const eventId = req.params.eventId || req.params.id;
    const filter = getEventFilter(eventId);
    const event = await Event.findOne(filter);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.status(200).json(event);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching event', error: safeErrorMessage(error) });
  }
};

// update the event
const updateEvent = async (req, res) => {
  try {
    const eventId = req.params.eventId || req.params.id;
    const filter = getEventFilter(eventId);
    const allowedFields = ['eventName', 'eventDate', 'eventTime', 'startTime', 'endTime', 'location', 'description', 'type'];
    const updates = Object.fromEntries(allowedFields.filter((field) => req.body[field] !== undefined).map((field) => [field, req.body[field]]));

    // get original event, needed for audit trail
    const originalEvent = await Event.findOne(filter);
    if (!originalEvent) {
      return res.status(404).json({ message: 'Event not found' });
    }

    /* Puwede lang i-edit ng Secretary yung event kung draft/pending/rejected
    pa - pag approved o closed na, Admin na ang bahala dun. Si Admin wala
    namang ganitong restriction: parehong route (Secretary at Admin) ang
    gumagamit nitong controller, pero 'admin' role lang ang makaka-edit
    kahit anong status, kasama na yung closed na event. */
    
    if (
      !['draft', 'pending_approval', 'rejected'].includes(originalEvent.status) &&
      !['admin', 'super_admin'].includes(req.user?.role)
    ) {
      return res.status(400).json({ message: 'Only draft, pending, or rejected events can be edited' });
    }

    if (['upcoming', 'active', 'closed'].includes(originalEvent.status)) {
      const changedLockedField = ['eventName', 'description', 'location'].some(field =>
        updates[field] !== undefined && updates[field] !== (originalEvent[field] ?? ''));
      if (changedLockedField) {
        return res.status(400).json({ message: 'The event name, description, and location cannot be changed after approval' });
      }
      delete updates.eventName;
      delete updates.description;
      delete updates.location;
    }

    updates.status = originalEvent.status === 'rejected' ? 'rejected' : originalEvent.status;
    const event = await Event.findOneAndUpdate(filter, updates, { new: true, runValidators: true });

    // log the audit event
    await createAuditLog({
      userId: req.user?.userId || req.user?.id,
      userName: req.user?.fullName || req.user?.name || req.user?.username || 'Unknown',
      userRole: req.user?.role || 'admin',
      action: 'event_updated',
      module: 'attendance',
      entityType: 'event',
      entityId: event.eventId,
      entityName: event.eventName,
      description: `Event "${event.eventName}" updated`,
      changes: {
        before: originalEvent.toObject(),
        after: event.toObject(),
      },
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(200).json({
      message: 'Event updated successfully',
      event: event,
    });
  } catch (error) {
    // log the failed attempt
    await createAuditLog({
      userId: req.user?.userId || req.user?.id,
      userName: req.user?.fullName || req.user?.name || req.user?.username || 'Unknown',
      userRole: req.user?.role || 'admin',
      action: 'event_updated',
      module: 'attendance',
      entityType: 'event',
      description: `Failed to update event`,
      status: 'failed',
      errorMessage: error.message,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(500).json({ message: 'Error updating event', error: safeErrorMessage(error) });
  }
};

const transitionEvent = async (req, res, nextStatus, allowedStatuses, message) => {
  const eventId = req.params.eventId || req.params.id;
  const event = await Event.findOne(getEventFilter(eventId));
  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (!allowedStatuses.includes(event.status)) return res.status(400).json({ message: `Event cannot be ${message.toLowerCase()} from its current status` });
  const before = event.toObject();
  event.status = nextStatus;
  if (nextStatus !== 'rejected') event.rejectionReason = undefined;
  if (req.body?.reason) event.rejectionReason = req.body.reason;
  await event.save();

  /* Ito yung ginagamit ng submit/cancel/resubmit/reject (may sarili naman
  si approveEvent sa baba). Parehong action string lang ang ginagamit kagaya
  ng reopenEvent, kaya di na kailangan gumawa ng bagong AuditLog.action value. */
  await createAuditLog({
    userId: req.user?.userId || req.user?.id,
    userName: req.user?.fullName || req.user?.name || req.user?.username || 'Unknown',
    userRole: req.user?.role || 'admin',
    action: 'event_status_changed',
    module: 'attendance',
    entityType: 'event',
    entityId: event.eventId,
    entityName: event.eventName,
    description: event.rejectionReason
      ? `Event "${event.eventName}" ${message.toLowerCase()}: ${event.rejectionReason}`
      : `Event "${event.eventName}" ${message.toLowerCase()}`,
    changes: { before, after: event.toObject() },
    status: 'success',
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  return res.json({ message: `Event ${message.toLowerCase()} successfully`, event });
};

const submitEvent = (req, res) => transitionEvent(req, res, 'pending_approval', ['draft', 'rejected'], 'submitted for approval');
const cancelEvent = (req, res) => transitionEvent(req, res, 'cancelled', ['draft', 'pending_approval', 'rejected'], 'cancelled');
const resubmitEvent = (req, res) => transitionEvent(req, res, 'pending_approval', ['rejected'], 'resubmitted');
const approveEvent = async (req, res) => {
  const eventId = req.params.eventId || req.params.id;
  const event = await Event.findOne(getEventFilter(eventId));
  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (!['draft', 'pending_approval'].includes(event.status)) return res.status(400).json({ message: 'Only pending events can be approved' });
  const before = event.toObject();
  event.status = 'upcoming';
  await event.save();

  await createAuditLog({
    userId: req.user?.userId || req.user?.id,
    userName: req.user?.fullName || req.user?.name || req.user?.username || 'Unknown',
    userRole: req.user?.role || 'admin',
    action: 'event_status_changed',
    module: 'attendance',
    entityType: 'event',
    entityId: event.eventId,
    entityName: event.eventName,
    description: `Event "${event.eventName}" approved`,
    changes: { before, after: event.toObject() },
    status: 'success',
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  return res.json({ message: 'Event approved successfully', event });
};
const rejectEvent = (req, res) => {
  if (!req.body?.reason?.trim()) return res.status(400).json({ message: 'A rejection reason is required' });
  return transitionEvent(req, res, 'rejected', ['pending_approval'], 'rejected');
};
/* Pag i-reopen ang closed event, kailangan ng bagong schedule sa hinaharap -
kasi yung luma, lagpas na, babalik lang agad sa closed pag na-check ulit ng
60s timer (refreshEventStatus). Required din ang reason galing sa Admin,
nilalagay sa event para sa audit trail. */
const reopenEvent = async (req, res) => {
  const eventId = req.params.eventId || req.params.id;
  const event = await Event.findOne(getEventFilter(eventId));
  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (event.status !== 'closed') return res.status(400).json({ message: 'Only closed events can be reopened' });

  const { eventDate, startTime, endTime, reason } = req.body || {};
  if (!reason?.trim()) return res.status(400).json({ message: 'A reason for reopening is required' });
  if (!eventDate || !startTime || !endTime) {
    return res.status(400).json({ message: 'A new date, start time, and end time are required to reopen this event' });
  }

  const before = event.toObject();

  event.eventDate = eventDate;
  event.startTime = startTime;
  event.endTime = endTime;
  event.eventTime = startTime; // keep eventTime for backward compatibility, set to startTime

  if (getEventEndDateTime(event) <= new Date()) {
    return res.status(400).json({ message: 'The new schedule must end in the future' });
  }
  event.status = new Date() >= getPhtDateTime(event) ? 'active' : 'upcoming';
  event.reopenReason = reason.trim();

  await event.save();

  await createAuditLog({
    userId: req.user?.userId || req.user?.id,
    userName: req.user?.fullName || req.user?.name || req.user?.username || 'Unknown',
    userRole: req.user?.role || 'admin',
    action: 'event_status_changed',
    module: 'attendance',
    entityType: 'event',
    entityId: event.eventId,
    entityName: event.eventName,
    description: `Event "${event.eventName}" reopened: ${reason.trim()}`,
    changes: { before, after: event.toObject() },
    status: 'success',
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  return res.json({ message: 'Event reopened successfully', event });
};

/* Pwede lang mag-delete ng event ang Admin, at closed na dapat muna. Yung
mga buhay pa (pending/upcoming/active) dapat sa reject/cancel/reopen
dumaan, para hindi mabura ng mali yung live na event. */
const deleteEvent = async (req, res) => {
  try {
    const eventId = req.params.eventId || req.params.id;
    const filter = getEventFilter(eventId);
    const existing = await Event.findOne(filter);

    if (!existing) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (existing.status !== 'closed') {
      return res.status(400).json({ message: 'Only closed events can be deleted' });
    }

    const event = await Event.findOneAndDelete(filter);

    // log the audit event
    await createAuditLog({
      userId: req.user?.userId || req.user?.id,
      userName: req.user?.fullName || req.user?.name || req.user?.username || 'Unknown',
      userRole: req.user?.role || 'admin',
      action: 'event_deleted',
      module: 'attendance',
      entityType: 'event',
      entityId: event.eventId,
      entityName: event.eventName,
      description: `Event "${event.eventName}" deleted`,
      changes: {
        before: event.toObject(),
        after: null,
      },
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(200).json({
      message: 'Event deleted successfully',
    });
  } catch (error) {
    // log the failed attempt
    await createAuditLog({
      userId: req.user?.userId || req.user?.id,
      userName: req.user?.fullName || req.user?.name || req.user?.username || 'Unknown',
      userRole: req.user?.role || 'admin',
      action: 'event_deleted',
      module: 'attendance',
      entityType: 'event',
      description: `Failed to delete event`,
      status: 'failed',
      errorMessage: error.message,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(500).json({ message: 'Error deleting event', error: safeErrorMessage(error) });
  }
};

module.exports = {
  createEvent,
  createEventAsAdmin,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  submitEvent,
  cancelEvent,
  resubmitEvent,
  approveEvent,
  rejectEvent,
  reopenEvent,
  refreshEventStatus,
  getPhtDateTime,
  getEventEndDateTime,
};
