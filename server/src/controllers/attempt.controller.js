import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { Attempt } from '../models/attempt.model.js';
import { QuestionSet } from '../models/questionset.model.js';
import { Submission } from '../models/submission.model.js';
import { User } from '../models/user.model.js';
import { calculateAttemptScoreBreakdown, getDifficultyPoints, calculateProblemScore } from '../utils/scoring.js';
import { runAllTestCases } from '../services/judge0.service.js';

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
    .populate('userId', 'username fullName email')
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
  const attemptOwnerId = (attempt.userId?._id || attempt.userId)?.toString();
  if (attemptOwnerId !== req.user._id.toString() && req.user.role !== 'admin') {
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
  const { page = 1, limit = 10 } = req.query;
  const filter = { userId: req.user._id };
  const [attempts, total] = await Promise.all([
    Attempt.find(filter)
      .populate({
        path: 'questionSetId',
        select: 'name category problems timingMode totalTimeLimit',
        populate: { path: 'problems', select: 'title difficulty' },
      })
      .populate('submissions', 'problemId score verdict passedTests totalTests submittedAt')
      .sort({ startedAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit)),
    Attempt.countDocuments(filter),
  ]);
  return res.json(new ApiResponse(200, 'Attempts fetched', { attempts, total, page: Number(page), limit: Number(limit) }));
});

// Admin: all attempts with live status counts and deep populates
export const allAttempts = asyncHandler(async (req, res) => {
  const { userId, questionSetId, status, search, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (userId) filter.userId = userId;
  if (questionSetId) filter.questionSetId = questionSetId;
  if (status && status !== 'all') filter.status = status;
  // server-side user search: match by username/fullName/email
  if (search) {
    const matchingUsers = await User.find({
      $or: [
        { username: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ],
    }).select('_id');
    filter.userId = { $in: matchingUsers.map(u => u._id) };
  }

  const [attempts, total, activeCount, completedCount, timedOutCount] = await Promise.all([
    Attempt.find(filter)
      .populate('userId', 'username fullName email')
      .populate({
        path: 'questionSetId',
        select: 'name category timingMode totalTimeLimit problems description',
        populate: {
          path: 'problems',
          select: 'title difficulty category timeLimit',
          // ponytail: starterCode stripped from list; only needed in editor, not admin monitor
        },
      })
      .populate({
        path: 'submissions',
        // ponytail: code excluded from list payload; saves ~80-90% payload size on each auto-refresh tick
        select: 'problemId score language status verdict passedTests totalTests runtime memory submittedAt',
      })
      .sort({ startedAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit)),
    Attempt.countDocuments(filter),
    Attempt.countDocuments({ status: 'in_progress' }),
    Attempt.countDocuments({ status: 'completed' }),
    Attempt.countDocuments({ status: 'timed_out' }),
  ]);

  return res.json(new ApiResponse(200, 'Attempts fetched', {
    attempts,
    total,
    page: Number(page),
    limit: Number(limit),
    counts: {
      total: await Attempt.countDocuments({}),
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

// Admin: Reevaluate single candidate attempt using the last attempt made DURING test time
export const reevaluateAttempt = asyncHandler(async (req, res) => {
  const attempt = await Attempt.findById(req.params.id)
    .populate({
      path: 'questionSetId',
      populate: { path: 'problems' },
    })
    .populate('userId', 'username fullName email');

  if (!attempt) throw new ApiError(404, 'Attempt not found');

  const set = attempt.questionSetId;
  const problems = (set?.problems || []).filter(Boolean);
  const problemMap = new Map();
  problems.forEach((p) => {
    problemMap.set(p._id.toString(), p);
  });

  // Find all submissions associated with this attempt
  const submissions = await Submission.find({
    $or: [
      { attemptId: attempt._id },
      { _id: { $in: attempt.submissions || [] } },
    ],
  }).sort({ submittedAt: 1, createdAt: 1 });

  const attemptStart = new Date(attempt.startedAt || attempt.createdAt || 0).getTime();
  const attemptEnd = attempt.endedAt
    ? new Date(attempt.endedAt).getTime() + 15000
    : attemptStart + (attempt.totalTimeLimit || 3600) * 1000 + 15000;

  // Filter strictly to in-test submissions
  let inTestSubs = submissions.filter((s) => {
    const sTime = new Date(s.submittedAt || s.createdAt || 0).getTime();
    return sTime >= attemptStart - 5000 && sTime <= attemptEnd;
  });

  // ponytail: fallback to all attempt submissions if none matched window (e.g. timestamps shifted)
  if (inTestSubs.length === 0 && submissions.length > 0) {
    inTestSubs = submissions;
  }

  const subsByProblem = {};
  inTestSubs.forEach((s) => {
    const pId = (s.problemId?._id || s.problemId)?.toString();
    if (!pId) return;
    if (!subsByProblem[pId]) subsByProblem[pId] = [];
    subsByProblem[pId].push(s);
  });

  Object.keys(subsByProblem).forEach((pId) => {
    subsByProblem[pId].sort((a, b) => {
      const timeA = new Date(a.submittedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.submittedAt || b.createdAt || 0).getTime();
      return timeA - timeB;
    });
  });

  let submissionsRejudged = 0;
  let totalScore = 0;
  let maxPossibleScore = 0;

  for (const p of problems) {
    const pId = p._id.toString();
    const rules = getDifficultyPoints(p.difficulty);
    maxPossibleScore += rules.totalPoints;

    const probSubs = subsByProblem[pId] || [];
    if (probSubs.length > 0) {
      const lastSub = probSubs[probSubs.length - 1];

      if (lastSub.code && p.testCases && p.testCases.length > 0) {
        try {
          const judgeRes = await runAllTestCases({
            language: lastSub.language,
            code: lastSub.code,
            testCases: p.testCases,
            timeLimit: Math.ceil((p.timeLimit || 1800) / 1000) || 2,
            memoryLimit: p.memoryLimit || 256,
          });

          const newScore = calculateProblemScore(p.difficulty, judgeRes.passedTests, judgeRes.totalTests);
          lastSub.verdict = judgeRes.verdict;
          lastSub.passedTests = judgeRes.passedTests;
          lastSub.totalTests = judgeRes.totalTests;
          lastSub.runtime = judgeRes.runtime;
          lastSub.memory = judgeRes.memory;
          lastSub.compileError = judgeRes.compileError;
          lastSub.testResults = judgeRes.testResults;
          lastSub.score = newScore;
          await lastSub.save();
          submissionsRejudged++;
        } catch (err) {
          console.error('Judge0 re-evaluation error for sub', lastSub._id, err);
          lastSub.score = calculateProblemScore(p.difficulty, lastSub.passedTests, lastSub.totalTests);
          await lastSub.save();
        }
      } else {
        lastSub.score = calculateProblemScore(p.difficulty, lastSub.passedTests, lastSub.totalTests);
        await lastSub.save();
      }

      totalScore += lastSub.score;
    }
  }

  // ponytail: ensure other submissions have calculated scores with current rules
  for (const s of inTestSubs) {
    const p = problemMap.get((s.problemId?._id || s.problemId)?.toString());
    if (p && (!s.score || s.score === 0)) {
      s.score = calculateProblemScore(p.difficulty, s.passedTests, s.totalTests);
      await s.save();
    }
  }

  attempt.submissions = inTestSubs.map((s) => s._id);
  attempt.score = totalScore;
  attempt.maxPossibleScore = maxPossibleScore;
  await attempt.save();

  return res.json(
    new ApiResponse(200, `Test reevaluated successfully. Re-judged ${submissionsRejudged} submission(s).`, {
      attemptId: attempt._id,
      submissionsRejudged,
      score: totalScore,
      maxPossibleScore,
    })
  );
});

