import mongoose, { Schema } from 'mongoose';

const testResultSchema = new Schema({
  testCaseIndex: Number,
  isHidden: Boolean,
  passed: Boolean,
  stdout: String,
  stderr: String,
  time: Number,
  memory: Number,
});

const submissionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  problemId: { type: Schema.Types.ObjectId, ref: 'Problem', required: true },
  questionSetId: { type: Schema.Types.ObjectId, ref: 'QuestionSet' },
  attemptId: { type: Schema.Types.ObjectId, ref: 'Attempt' },
  language: { type: String, enum: ['java', 'cpp'], required: true },
  code: { type: String, required: true },
  status: { type: String, enum: ['pending','running','done','error'], default: 'pending' },
  verdict: { type: String, enum: ['AC','WA','TLE','MLE','RE','CE','Pending'], default: 'Pending' },
  passedTests: { type: Number, default: 0 },
  totalTests: { type: Number, default: 0 },
  runtime: Number,   // ms
  memory: Number,    // KB
  score: { type: Number, default: 0 },
  compileError: String,
  testResults: [testResultSchema],
  submittedAt: { type: Date, default: Date.now },
}, { timestamps: true });

export const Submission = mongoose.model('Submission', submissionSchema, 'submissions');
