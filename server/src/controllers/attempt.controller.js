import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { Attempt } from '../models/attempt.model.js';
import { QuestionSet } from '../models/questionset.model.js';

export const startAttempt = asyncHandler(async (req, res) => {
  const { questionSetId } = req.body;
  if (!questionSetId) throw new ApiError(400, 'questionSetId required');

  const set = await QuestionSet.findById(questionSetId);
  if (!set) throw new ApiError(404, 'Question set not found');

  // Check if user has an in_progress attempt for this set
  const existing = await Attempt.findOne({ userId: req.user._id, questionSetId, status: 'in_progress' });
  if (existing) return res.json(new ApiResponse(200, 'Resuming existing attempt', { attempt: existing }));

  const attempt = await Attempt.create({
    userId: req.user._id,
    questionSetId,
    timingMode: set.timingMode,
    totalTimeLimit: set.totalTimeLimit,
  });

  return res.status(201).json(new ApiResponse(201, 'Attempt started', { attempt }));
});

export const endAttempt = asyncHandler(async (req, res) => {
  const attempt = await Attempt.findById(req.params.id);
  if (!attempt) throw new ApiError(404, 'Attempt not found');
  if (attempt.userId.toString() !== req.user._id.toString()) throw new ApiError(403, 'Forbidden');
  if (attempt.status !== 'in_progress') throw new ApiError(400, 'Attempt already ended');

  attempt.status = req.body.timedOut ? 'timed_out' : 'completed';
  attempt.endedAt = new Date();
  await attempt.save();

  return res.json(new ApiResponse(200, 'Attempt ended', { attempt }));
});

export const deleteAttempt = asyncHandler(async (req, res) => {
  const attempt = await Attempt.findById(req.params.id);
  if (!attempt) throw new ApiError(404, 'Attempt not found');
  if (attempt.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Forbidden: You can only delete your own attempts');
  }

  await Attempt.findByIdAndDelete(req.params.id);
  return res.json(new ApiResponse(200, 'Attempt deleted successfully', {}));
});

export const getAttemptReview = asyncHandler(async (req, res) => {
  const attempt = await Attempt.findById(req.params.id)
    .populate({
      path: 'questionSetId',
      select: 'name category problems timingMode totalTimeLimit description',
      populate: {
        path: 'problems',
        select: 'title difficulty category timeLimit constraints description examples',
      },
    })
    .populate({
      path: 'submissions',
      select: 'problemId language code status verdict passedTests totalTests runtime memory compileError testResults submittedAt',
    });

  if (!attempt) throw new ApiError(404, 'Attempt not found');
  if (attempt.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Forbidden');
  }

  return res.json(new ApiResponse(200, 'Attempt review fetched', { attempt }));
});

export const myAttempts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const attempts = await Attempt.find({ userId: req.user._id })
    .populate('questionSetId', 'name category problems timingMode totalTimeLimit')
    .populate('submissions', 'problemId verdict passedTests totalTests submittedAt')
    .sort({ startedAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));
  return res.json(new ApiResponse(200, 'Attempts fetched', { attempts }));
});

// Admin: all attempts
export const allAttempts = asyncHandler(async (req, res) => {
  const { userId, questionSetId, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (userId) filter.userId = userId;
  if (questionSetId) filter.questionSetId = questionSetId;
  const attempts = await Attempt.find(filter)
    .populate('userId', 'username fullName')
    .populate('questionSetId', 'name category')
    .populate('submissions', 'problemId verdict passedTests totalTests')
    .sort({ startedAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));
  const total = await Attempt.countDocuments(filter);
  return res.json(new ApiResponse(200, 'Attempts fetched', { attempts, total }));
});

export const saveTimers = asyncHandler(async (req, res) => {
  const { problemTimerElapsedSec } = req.body;
  const attempt = await Attempt.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id, status: 'in_progress' },
    { problemTimerElapsedSec },
    { new: true }
  );
  if (!attempt) throw new ApiError(404, 'Attempt not found');
  res.json(new ApiResponse(200, 'Timers saved', {}));
});
