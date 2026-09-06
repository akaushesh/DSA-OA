import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { Attempt } from '../models/attempt.model.js';
import { QuestionSet } from '../models/questionset.model.js';
import { Submission } from '../models/submission.model.js';
import { calculateAttemptScoreBreakdown, getDifficultyPoints } from '../utils/scoring.js';

export const startAttempt = asyncHandler(async (req, res) => {
  const { questionSetId, timingMode, totalTimeLimit, preferredLanguage } = req.body;
  if (!questionSetId) throw new ApiError(400, 'questionSetId required');

  const set = await QuestionSet.findById(questionSetId).populate('problems', 'difficulty');
  if (!set) throw new ApiError(404, 'Question set not found');

  // Check if user has an in_progress attempt for this set
  const existing = await Attempt.findOne({ userId: req.user._id, questionSetId, status: 'in_progress' })
    .populate({
      path: 'questionSetId',
      populate: { path: 'problems', select: 'title difficulty category timeLimit starterCode' },
    });
  if (existing) {
    if (preferredLanguage && !existing.preferredLanguage) {
      existing.preferredLanguage = preferredLanguage;
      await existing.save();
    }
    return res.json(new ApiResponse(200, 'Resuming existing attempt', { attempt: existing, isResume: true }));
  }

  const maxPossibleScore = (set.problems || []).reduce(
    (acc, p) => acc + getDifficultyPoints(p.difficulty).totalPoints,
    0
  );

  const attempt = await Attempt.create({
    userId: req.user._id,
    questionSetId,
    timingMode: timingMode || set.timingMode || 'per_problem',
    totalTimeLimit: totalTimeLimit || set.totalTimeLimit || 3600,
    maxPossibleScore,
    preferredLanguage: preferredLanguage || 'cpp',
  });

  return res.status(201).json(new ApiResponse(201, 'Attempt started', { attempt }));
});

export const endAttempt = asyncHandler(async (req, res) => {
  const attempt = await Attempt.findById(req.params.id)
    .populate({
      path: 'questionSetId',
      populate: { path: 'problems', select: 'difficulty' },
    })
    .populate('submissions', 'problemId score passedTests totalTests');

  if (!attempt) throw new ApiError(404, 'Attempt not found');
  if (attempt.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Forbidden');
  }
  if (attempt.status !== 'in_progress') throw new ApiError(400, 'Attempt already ended');

  if (attempt.questionSetId?.problems && attempt.submissions) {
    const { totalScore, maxPossibleScore } = calculateAttemptScoreBreakdown(
      attempt.questionSetId.problems,
      attempt.submissions
    );
    attempt.score = totalScore;
    attempt.maxPossibleScore = maxPossibleScore;
  }

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
        select: 'title difficulty category timeLimit constraints inputFormat outputFormat description examples testCases starterCode',
      },
    })
    .populate({
      path: 'submissions',
      select: 'problemId score language code status verdict passedTests totalTests runtime memory compileError testResults submittedAt',
    });

  if (!attempt) throw new ApiError(404, 'Attempt not found');
  if (attempt.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Forbidden');
  }

  // Filter strictly to submissions made during test time
  const attemptStart = new Date(attempt.startedAt || attempt.createdAt || 0).getTime();
  const attemptEnd = attempt.endedAt
    ? new Date(attempt.endedAt).getTime() + 15000
    : attemptStart + (attempt.totalTimeLimit || 3600) * 1000 + 15000;

  const inTestSubmissions = (attempt.submissions || []).filter((s) => {
    if (!s) return false;
    const sTime = new Date(s.submittedAt || s.createdAt || 0).getTime();
    return sTime >= attemptStart - 5000 && sTime <= attemptEnd;
  });

  let scoreBreakdown = { totalScore: attempt.score || 0, maxPossibleScore: attempt.maxPossibleScore || 0, problemScores: {} };
  if (attempt.questionSetId?.problems && inTestSubmissions.length > 0) {
    scoreBreakdown = calculateAttemptScoreBreakdown(
      attempt.questionSetId.problems,
      inTestSubmissions
    );
    if (attempt.score !== scoreBreakdown.totalScore || attempt.maxPossibleScore !== scoreBreakdown.maxPossibleScore) {
      attempt.score = scoreBreakdown.totalScore;
      attempt.maxPossibleScore = scoreBreakdown.maxPossibleScore;
      await attempt.save();
    }
  }

  return res.json(new ApiResponse(200, 'Attempt review fetched', { attempt, scoreBreakdown }));
});

export const myAttempts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const attempts = await Attempt.find({ userId: req.user._id })
    .populate({
      path: 'questionSetId',
      select: 'name category problems timingMode totalTimeLimit',
      populate: { path: 'problems', select: 'title difficulty' },
    })
    .populate('submissions', 'problemId score verdict passedTests totalTests submittedAt')
    .sort({ startedAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));
  return res.json(new ApiResponse(200, 'Attempts fetched', { attempts }));
});

// Admin: all attempts with live status counts and deep populates
export const allAttempts = asyncHandler(async (req, res) => {
  const { userId, questionSetId, status, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (userId) filter.userId = userId;
  if (questionSetId) filter.questionSetId = questionSetId;
  if (status && status !== 'all') filter.status = status;

  const attempts = await Attempt.find(filter)
    .populate('userId', 'username fullName email')
    .populate({
      path: 'questionSetId',
      select: 'name category timingMode totalTimeLimit problems description',
      populate: {
        path: 'problems',
        select: 'title difficulty category timeLimit starterCode',
      },
    })
    .populate({
      path: 'submissions',
      select: 'problemId score language code status verdict passedTests totalTests runtime memory submittedAt',
    })
    .sort({ startedAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await Attempt.countDocuments(filter);
  const [activeCount, completedCount, timedOutCount] = await Promise.all([
    Attempt.countDocuments({ status: 'in_progress' }),
    Attempt.countDocuments({ status: 'completed' }),
    Attempt.countDocuments({ status: 'timed_out' }),
  ]);

  return res.json(new ApiResponse(200, 'Attempts fetched', {
    attempts,
    total,
    counts: {
      total,
      active: activeCount,
      completed: completedCount,
      timedOut: timedOutCount,
    },
  }));
});

// Admin: Adjust remaining time for user's ongoing attempt
export const adjustAttemptTime = asyncHandler(async (req, res) => {
  const { additionalSeconds = 300, problemId } = req.body;
  const attempt = await Attempt.findById(req.params.id);
  if (!attempt) throw new ApiError(404, 'Attempt not found');

  if (attempt.timingMode === 'collective') {
    attempt.totalTimeLimit = Math.max(60, (attempt.totalTimeLimit || 3600) + Number(additionalSeconds));
  } else if (attempt.timingMode === 'per_problem') {
    if (problemId) {
      const curElapsed = attempt.problemTimerElapsedSec?.get(problemId) || 0;
      attempt.problemTimerElapsedSec.set(problemId, Math.max(0, curElapsed - Number(additionalSeconds)));
    } else {
      // If no specific problemId provided, add time to all problem timers by decreasing elapsed
      if (attempt.problemTimerElapsedSec) {
        for (const [pId, elapsed] of attempt.problemTimerElapsedSec.entries()) {
          attempt.problemTimerElapsedSec.set(pId, Math.max(0, elapsed - Number(additionalSeconds)));
        }
      }
    }
  }

  await attempt.save();
  return res.json(new ApiResponse(200, 'Attempt time adjusted successfully', { attempt }));
});

// Admin: Reset an attempt back to in_progress with clean timers
export const resetAttempt = asyncHandler(async (req, res) => {
  const attempt = await Attempt.findById(req.params.id);
  if (!attempt) throw new ApiError(404, 'Attempt not found');

  attempt.status = 'in_progress';
  attempt.startedAt = new Date();
  attempt.endedAt = undefined;
  attempt.problemTimerElapsedSec = new Map();
  await attempt.save();

  return res.json(new ApiResponse(200, 'Attempt reset to in-progress', { attempt }));
});

// Admin: Stop an ongoing user test immediately
export const stopAttempt = asyncHandler(async (req, res) => {
  const attempt = await Attempt.findById(req.params.id)
    .populate({
      path: 'questionSetId',
      populate: { path: 'problems', select: 'difficulty' },
    })
    .populate('submissions', 'problemId score passedTests totalTests');

  if (!attempt) throw new ApiError(404, 'Attempt not found');
  if (attempt.status !== 'in_progress') throw new ApiError(400, 'Attempt is not currently in progress');

  if (attempt.questionSetId?.problems && attempt.submissions) {
    const { totalScore, maxPossibleScore } = calculateAttemptScoreBreakdown(
      attempt.questionSetId.problems,
      attempt.submissions
    );
    attempt.score = totalScore;
    attempt.maxPossibleScore = maxPossibleScore;
  }

  attempt.status = 'stopped_by_admin';
  attempt.stoppedByAdmin = true;
  attempt.endedAt = new Date();
  await attempt.save();

  return res.json(new ApiResponse(200, 'Assessment stopped by admin', { attempt }));
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
