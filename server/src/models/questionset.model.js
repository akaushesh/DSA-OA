import mongoose, { Schema } from 'mongoose';

const questionSetSchema = new Schema({
  name: { type: String, required: true, trim: true },
  description: String,
  category: { type: String, required: true, index: true },
  problems: [{ type: Schema.Types.ObjectId, ref: 'Problem' }],
  timingMode: { type: String, enum: ['per_problem', 'collective'], default: 'collective' },
  totalTimeLimit: { type: Number, default: 3600 }, // seconds — used in collective mode
  isPublished: { type: Boolean, default: false },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const QuestionSet = mongoose.model('QuestionSet', questionSetSchema, 'questionsets');
