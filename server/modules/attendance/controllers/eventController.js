const mongoose = require('mongoose');
const Event = require('../models/Event');
const { v4: uuidv4 } = require('uuid');
const { createAuditLog } = require('../../../shared/services/auditLoggingService');
const { safeErrorMessage } = require('../../../middleware/errorHandler');

const getPhtParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(date)).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
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

const validateEventDetails = (event) => {
  if (typeof event.eventName !== 'string' || !event.eventName.trim()) return 'Event name is required';
  if (typeof event.location !== 'string' || !event.location.trim()) return 'Location is required';
  return null;
};

const validateSchedule = (event) => {
  if (!event.eventDate || !Number.isFinite(new Date(event.eventDate).getTime())) return 'A valid event date is required';
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timePattern.test(event.startTime) || !timePattern.test(event.endTime)) return 'Valid start and end times are required';
  if (event.endTime <= event.startTime) return 'End time must be after start time';
  return null;
};

const scheduledStatus = (event) => {
  const now = new Date();
  return now >= getEventEndDateTime(event) ? 'closed' : now >= getPhtDateTime(event) ? 'active' : 'upcoming';
};

const refreshEventStatus = async (event) => {
  if (!event || !['draft', 'pending_approval', 'upcoming', 'active'].includes(event.status)) return event;
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
    const events = await Event.find({ status: { $in: ['draft', 'pending_approval', 'upcoming', 'active'] } });
    for (const event of events) await refreshEventStatus(event);
  } catch (error) {
    console.error('Error updating completed events:', error);
  }
};

const eventStatusTimer = setInterval(checkAndUpdateCompletedEvents, 60 * 1000);
eventStatusTimer.unref();

// All events follow their scheduled Philippine time without approval.
const handleCreateEvent = async (req, res) => {
  try {
    const { eventName, eventDate, eventTime, startTime, endTime, location, description, type, createdBy } = req.body;

    if (!eventName || !eventDate || !startTime || !endTime || !location || !createdBy) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const detailsError = validateEventDetails({ eventName, location });
    if (detailsError) return res.status(400).json({ message: detailsError });

    const newEvent = new Event({
      eventId: uuidv4(),
      eventName: eventName.trim(),
      eventDate,
      eventTime: startTime, // keep eventTime for backward compatibility, same as startTime
      startTime,
      endTime,
      location: location.trim(),
      description,
      type: type || 'General Assembly',
      status: 'upcoming',
      createdBy,
    });

    const scheduleError = validateSchedule(newEvent);
    if (scheduleError) return res.status(400).json({ message: scheduleError });
    newEvent.status = scheduledStatus(newEvent);
    const saved = await newEvent.save();

    // log the audit event
    await createAuditLog({
      userId: req.user?.userId || req.user?.id || createdBy,
      userName: req.user?.fullName || req.user?.name || req.user?.username || createdBy,
      userRole: req.user?.role || 'secretary',
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

const createEvent = handleCreateEvent;
const createEventAsAdmin = handleCreateEvent; // Compatibility for existing clients.

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

    await refreshEventStatus(event);
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

    await refreshEventStatus(originalEvent);
    const candidate = { ...originalEvent.toObject(), ...updates };
    const detailsError = validateEventDetails(candidate);
    if (detailsError) return res.status(400).json({ message: detailsError });
    if (updates.eventName !== undefined) updates.eventName = updates.eventName.trim();
    if (updates.location !== undefined) updates.location = updates.location.trim();
    const scheduleError = validateSchedule(candidate);
    if (scheduleError) return res.status(400).json({ message: scheduleError });
    if (originalEvent.status === 'closed' && ['eventDate', 'startTime', 'endTime'].some(field =>
      updates[field] !== undefined && String(field === 'eventDate' ? new Date(updates[field]).getTime() : updates[field]) !== String(field === 'eventDate' ? new Date(originalEvent[field]).getTime() : originalEvent[field]))) {
      return res.status(400).json({ message: 'Use Reopen with a reason to change a closed event schedule' });
    }
    updates.eventTime = candidate.startTime;
    updates.status = originalEvent.status === 'closed' ? 'closed' : scheduledStatus(candidate);
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

// Reopening requires a reason and a new schedule that has not ended.
const reopenEvent = async (req, res) => {
  const eventId = req.params.eventId || req.params.id;
  const event = await Event.findOne(getEventFilter(eventId));
  if (!event) return res.status(404).json({ message: 'Event not found' });
  await refreshEventStatus(event);
  if (event.status !== 'closed') return res.status(400).json({ message: 'Only closed events can be reopened' });

  const { eventDate, startTime, endTime, reason } = req.body || {};
  if (typeof reason !== 'string' || !reason.trim()) return res.status(400).json({ message: 'A reason for reopening is required' });
  if (!eventDate || !startTime || !endTime) {
    return res.status(400).json({ message: 'A new date, start time, and end time are required to reopen this event' });
  }

  const scheduleError = validateSchedule({ eventDate, startTime, endTime });
  if (scheduleError) return res.status(400).json({ message: scheduleError });
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

// Secretary can delete events in any state; retain the audit history.
const deleteEvent = async (req, res) => {
  try {
    const eventId = req.params.eventId || req.params.id;
    const filter = getEventFilter(eventId);
    const existing = await Event.findOne(filter);

    if (!existing) {
      return res.status(404).json({ message: 'Event not found' });
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
  reopenEvent,
  refreshEventStatus,
  getPhtDateTime,
  getEventEndDateTime,
};
