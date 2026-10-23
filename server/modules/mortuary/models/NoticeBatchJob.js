const mongoose = require('mongoose');

/* Ina-track dito ang background "generate every member's balance notice at one
threshold level as a single PDF" run - mirror ito ng shape ng
server/shared/models/ImportOperation.js (ang existing async-job pattern na nasa
codebase na ito), pinaliit lang sa kailangan ng isang PDF-generation job. */
const noticeBatchJobSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      unique: true,
      required: true,
    },
    level: {
      type: Number,
      enum: [1, 2, 3],
      required: true,
    },
    /* Ang unset ay nangangahulugang "every barangay" - naset kapag pinatakbo ng
    Treasurer ang batch na ito scoped sa isang barangay galing sa existing filter ng
    Member Balances. */
    barangay: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      default: 'processing',
    },
    totalMembers: {
      type: Number,
      default: 0,
    },
    fileName: {
      type: String,
      default: null,
    },
    error: {
      type: String,
      default: null,
    },
    createdBy: {
      type: String,
      required: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('NoticeBatchJob', noticeBatchJobSchema);
