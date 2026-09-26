import mongoose, { Schema } from 'mongoose';

const attemptSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  questionSetId: { type: Schema.Types.ObjectId, ref: 'QuestionSet', required: true },
  startedAt: { type: Date, default: Date.now },
  endedAt: Date,
  timingMode: { type: String, enum: ['per_problem', 'collective'] },
  totalTimeLimit: Number,  // copied from set at start
  preferredLanguage: { type: String, enum: ['cpp', 'java'], default: 'cpp' },
  submissions: [{ type: Schema.Types.ObjectId, ref: 'Submission' }],
  score: { type: Number, default: 0 },
  maxPossibleScore: { type: Number, default: 0 },
  status: { type: String, enum: ['in_progress', 'completed', 'timed_out', 'stopped_by_admin'], default: 'in_progress' },
  stoppedByAdmin: { type: Boolean, default: false },
  problemTimerElapsedSec: { type: Map, of: Number, default: {} },
  pinnedSubmissions: { type: Map, of: Schema.Types.ObjectId, default: {} }, // admin override: { [problemId]: submissionId }

}, { timestamps: true });

attemptSchema.index({ userId: 1, startedAt: -1 });
attemptSchema.index({ questionSetId: 1, status: 1 });
attemptSchema.index({ status: 1, startedAt: -1 });

export const Attempt = mongoose.model('Attempt', attemptSchema, 'attempts');
