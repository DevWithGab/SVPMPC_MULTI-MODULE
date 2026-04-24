const Event = require('../models/Event');
const { v4: uuidv4 } = require('uuid');

// Create event
const createEvent = async (req, res) => {
  try {
    const { eventName, eventDate, eventTime, location, description, createdBy } = req.body;

    if (!eventName || !eventDate || !eventTime || !location || !createdBy) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const newEvent = new Event({
      eventId: uuidv4(),
      eventName,
      eventDate,
      eventTime,
      location,
      description,
      createdBy,
      status: 'upcoming',
    });

    const saved = await newEvent.save();
    res.status(201).json({
      message: 'Event created successfully',
      event: saved,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating event', error: error.message });
  }
};

// Get all events
const getAllEvents = async (req, res) => {
  try {
    const events = await Event.find();
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
    const { eventId } = req.params;
    const event = await Event.findOne({ eventId });

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
    const { eventId } = req.params;
    const updates = req.body;

    const event = await Event.findOneAndUpdate({ eventId }, updates, { new: true });

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.status(200).json({
      message: 'Event updated successfully',
      event: event,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating event', error: error.message });
  }
};

// Delete event
const deleteEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findOneAndDelete({ eventId });

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.status(200).json({
      message: 'Event deleted successfully',
    });
  } catch (error) {
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
