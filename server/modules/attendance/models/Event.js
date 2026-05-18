const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      unique: true,
      required: true,
    },
    eventName: {
      type: String,
      required: true,
    },
    eventDate: {
      type: Date,
      required: true,
    },
    eventTime: {
      type: String,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    status: {
      type: String,
      enum: ['upcoming', 'active', 'completed'],
      default: 'upcoming',
    },
    createdBy: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Indexes for better query performance
eventSchema.index({ status: 1 });
eventSchema.index({ eventDate: -1 });
eventSchema.index({ status: 1, eventDate: -1 });

module.exports = mongoose.model('Event', eventSchema);
