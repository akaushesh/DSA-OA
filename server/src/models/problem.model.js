import mongoose, { Schema } from 'mongoose';

const testCaseSchema = new Schema({
  input: { type: String, default: '' },
  expectedOutput: { type: String, default: '' },
  isHidden: { type: Boolean, default: false },
});

const exampleSchema = new Schema({
  input: String,
  output: String,
  explanation: String,
});

const problemSchema = new Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
  category: { type: String, default: 'General', index: true },
  tags: [String],
  constraints: String,
  examples: [exampleSchema],
  timeLimit: { type: Number, default: 1800 }, // seconds per problem in per_problem mode
  memoryLimit: { type: Number, default: 256 }, // MB
  testCases: [testCaseSchema],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const Problem = mongoose.model('Problem', problemSchema, 'problems');
