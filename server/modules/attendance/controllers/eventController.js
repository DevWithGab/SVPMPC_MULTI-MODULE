const mongoose = require('mongoose');
const Event = require('../models/Event');
const { v4: uuidv4 } = require('uuid');
const { createAuditLog } = require('../../../shared/services/auditLoggingService');

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

// Function to check and update completed events
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

// Create event.
// `autoApprove` is decided by which route wired this handler up (see the
// createEvent/createEventAsAdmin split below), never by req.user.role.
// authorizeSecretaryOnly deliberately lets Admin accounts use the Secretary
// routes too, so branching on role here would let an Admin-owned account
// skip the approval workflow simply by creating the event through the
// Secretary Portal — exactly the bug where Secretary-created events showed
// up already "Upcoming" and never reached the Admin's Pending Approvals list.
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
      eventTime: startTime, // keep eventTime for backward compatibility, set to startTime
      startTime,
      endTime,
      location,
      description,
      type: type || 'General Assembly',
      status: autoApprove ? 'upcoming' : 'pending_approval',
      createdBy,
    });

    const saved = await newEvent.save();

    // Log audit event
    await createAuditLog({
      userId: req.user?.id || createdBy,
      userName: req.user?.name || createdBy,
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
    // Log failed attempt
    await createAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || 'Unknown',
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

    res.status(500).json({ message: 'Error creating event', error: error.message });
  }
};

// Used by the Secretary, legacy, and member routers: always lands in
// pending_approval so it appears in the Admin's Pending Approvals queue.
const createEvent = (req, res) => handleCreateEvent(req, res, { autoApprove: false });

// Used only by the Admin router: an Admin-authored event has no one above it
// to approve it, so it publishes straight to upcoming.
const createEventAsAdmin = (req, res) => handleCreateEvent(req, res, { autoApprove: true });

// Get all events (supports filtering via query params) - with pagination
const getAllEvents = async (req, res) => {
  try {
    // Check and update completed events
    await checkAndUpdateCompletedEvents();

    const { q, location, status } = req.query;
    const { page, limit, skip } = require('../../../shared/utils/pagination').getPaginationParams(req.query);

    // Build filter from query params
    const filter = {};

    if (location) {
      filter.location = location;
    }

    if (status) {
      filter.status = status;
    }

    if (q) {
      const regex = new RegExp(q, 'i');
      // search in eventName and location
      filter.$or = [{ eventName: regex }, { location: regex }];
    }

    // Get total count for pagination
    const total = await Event.countDocuments(filter);

    // Get paginated events
    const events = await Event.find(filter)
      .sort({ eventDate: -1, startTime: -1 })
      .skip(skip)
      .limit(limit);

    const { buildPaginatedResponse } = require('../../../shared/utils/pagination');
    res.status(200).json(buildPaginatedResponse(events, total, page, limit));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching events', error: error.message });
  }
};

// Get event by ID
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
    res.status(500).json({ message: 'Error fetching event', error: error.message });
  }
};

// Update event
const updateEvent = async (req, res) => {
  try {
    const eventId = req.params.eventId || req.params.id;
    const filter = getEventFilter(eventId);
    const allowedFields = ['eventName', 'eventDate', 'eventTime', 'startTime', 'endTime', 'location', 'description', 'type'];
    const updates = Object.fromEntries(allowedFields.filter((field) => req.body[field] !== undefined).map((field) => [field, req.body[field]]));

    // Get original event for audit trail
    const originalEvent = await Event.findOne(filter);
    if (!originalEvent) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (!['draft', 'pending_approval', 'rejected'].includes(originalEvent.status)) {
      return res.status(400).json({ message: 'Only draft, pending, or rejected events can be edited' });
    }

    updates.status = originalEvent.status === 'rejected' ? 'rejected' : originalEvent.status;
    const event = await Event.findOneAndUpdate(filter, updates, { new: true, runValidators: true });

    // Log audit event
    await createAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || 'Unknown',
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
    // Log failed attempt
    await createAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || 'Unknown',
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

    res.status(500).json({ message: 'Error updating event', error: error.message });
  }
};

const transitionEvent = async (req, res, nextStatus, allowedStatuses, message) => {
  const eventId = req.params.eventId || req.params.id;
  const event = await Event.findOne(getEventFilter(eventId));
  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (!allowedStatuses.includes(event.status)) return res.status(400).json({ message: `Event cannot be ${message.toLowerCase()} from its current status` });
  event.status = nextStatus;
  if (nextStatus !== 'rejected') event.rejectionReason = undefined;
  if (req.body?.reason) event.rejectionReason = req.body.reason;
  await event.save();
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
  event.status = 'upcoming';
  await event.save();
  return res.json({ message: 'Event approved successfully', event });
};
const rejectEvent = (req, res) => {
  if (!req.body?.reason?.trim()) return res.status(400).json({ message: 'A rejection reason is required' });
  return transitionEvent(req, res, 'rejected', ['pending_approval'], 'rejected');
};
// Reopening a closed event needs a new future schedule — its old date/time
// already passed, so leaving it untouched would just have the 60s status
// timer (refreshEventStatus) close it again on the next tick. The Admin
// must also give a reason, which is kept on the event for the audit trail.
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
    userId: req.user?.id,
    userName: req.user?.name || 'Unknown',
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

// Delete event — Admin only, and only once an event is Closed. Events still
// in play (pending/upcoming/active) go through reject/cancel/reopen instead,
// so a live event can't be wiped out by mistake.
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

    // Log audit event
    await createAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || 'Unknown',
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
    // Log failed attempt
    await createAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || 'Unknown',
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

    res.status(500).json({ message: 'Error deleting event', error: error.message });
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
