const mongoose = require('mongoose');
const Event = require('../models/Event');
const { v4: uuidv4 } = require('uuid');
const { createAuditLog } = require('../../../shared/services/auditLoggingService');

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
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM

    // Find active events where eventDate is today or past, and endTime has passed
    const eventsToUpdate = await Event.find({
      status: 'active',
      $or: [
        { eventDate: { $lt: new Date(currentDate) } },
        { 
          eventDate: new Date(currentDate),
          endTime: { $lt: currentTime }
        }
      ]
    });

    for (const event of eventsToUpdate) {
      await Event.findOneAndUpdate({ eventId: event.eventId }, { status: 'completed' });
    }

    if (eventsToUpdate.length > 0) {
      console.log(`Updated ${eventsToUpdate.length} events to completed`);
    }
  } catch (error) {
    console.error('Error updating completed events:', error);
  }
};

// Create event
const createEvent = async (req, res) => {
  try {
    const { eventName, eventDate, eventTime, startTime, endTime, location, description, createdBy, status } = req.body;

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
      status: status || 'upcoming',
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

// Get all events (supports filtering via query params)
const getAllEvents = async (req, res) => {
  try {
    // Check and update completed events
    await checkAndUpdateCompletedEvents();

    // Build filter from query params
    const { q, location, status } = req.query;
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

    const events = await Event.find(filter).sort({ eventDate: -1, startTime: -1 });
    res.status(200).json({
      count: events.length,
      events: events,
    });
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
    const updates = req.body;

    // Get original event for audit trail
    const originalEvent = await Event.findOne(filter);
    if (!originalEvent) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const event = await Event.findOneAndUpdate(filter, updates, { new: true });

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

// Delete event
const deleteEvent = async (req, res) => {
  try {
    const eventId = req.params.eventId || req.params.id;
    const filter = getEventFilter(eventId);
    const event = await Event.findOneAndDelete(filter);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

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
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
};
