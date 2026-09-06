import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { QuestionSet } from '../models/questionset.model.js';
import { Problem } from '../models/problem.model.js';
import { Attempt } from '../models/attempt.model.js';
import { Submission } from '../models/submission.model.js';
import { normalizeStarterCode } from '../utils/starterCode.js';
import { calculateProblemScore, getDifficultyPoints } from '../utils/scoring.js';
import { runAllTestCases } from '../services/judge0.service.js';

// Helper to normalize and resolve problems into valid ObjectIds
async function resolveProblemIds(rawProblems, userId) {
  if (!rawProblems) return [];
  let problems = rawProblems;
  if (typeof problems === 'string') {
    try {
      problems = JSON.parse(problems);
    } catch {
      problems = [];
    }
  }
  if (!Array.isArray(problems)) return [];

  const resolvedIds = [];
  for (const item of problems) {
    if (!item) continue;
    // If it's a string that contains stringified JSON of an item
    let resolvedItem = item;
    if (typeof resolvedItem === 'string' && resolvedItem.trim().startsWith('{')) {
      try {
        resolvedItem = JSON.parse(resolvedItem);
      } catch {}
    }

    if (typeof resolvedItem === 'string' && mongoose.Types.ObjectId.isValid(resolvedItem)) {
      resolvedIds.push(new mongoose.Types.ObjectId(resolvedItem));
    } else if (resolvedItem instanceof mongoose.Types.ObjectId) {
      resolvedIds.push(resolvedItem);
    } else if (typeof resolvedItem === 'object') {
      const rawStarter = resolvedItem.starterCode ?? resolvedItem.starter_code ?? resolvedItem.starter ?? resolvedItem.boilerplate ?? resolvedItem.template ?? resolvedItem.code;
      const normalizedItem = {
        ...resolvedItem,
        starterCode: normalizeStarterCode(rawStarter),
      };
      if (resolvedItem._id && mongoose.Types.ObjectId.isValid(resolvedItem._id)) {
        await Problem.findByIdAndUpdate(resolvedItem._id, { ...normalizedItem, createdBy: userId }).catch(() => {});
        resolvedIds.push(new mongoose.Types.ObjectId(resolvedItem._id));
      } else if (resolvedItem.title) {
        const created = await Problem.create({ ...normalizedItem, createdBy: userId });
        resolvedIds.push(created._id);
      }
    }
  }
  return resolvedIds;
}

// Admin & User: create question set (also handles JSON upload)
export const createQuestionSet = asyncHandler(async (req, res) => {
  const { name, description, category, problems, timingMode, totalTimeLimit, isPublished } = req.body;
  if (!name || !category) throw new ApiError(400, 'name and category required');
  const problemIds = await resolveProblemIds(problems, req.user._id);
  const set = await QuestionSet.create({ name, description, category, problems: problemIds, timingMode, totalTimeLimit, isPublished, createdBy: req.user._id });
  return res.status(201).json(new ApiResponse(201, 'Question set created', { set }));
});

// Admin & User: import from JSON (creates problems + set in one shot)
export const importQuestionSet = asyncHandler(async (req, res) => {
  const { name, description, category, timingMode, totalTimeLimit, isPublished, problems: rawProblems } = req.body;
  if (!name || !category) throw new ApiError(400, 'name and category required');
  const problemIds = await resolveProblemIds(rawProblems, req.user._id);
  if (!problemIds.length) throw new ApiError(400, 'At least one valid problem required');

  const set = await QuestionSet.create({
    name,
    description,
    category,
    timingMode: timingMode || 'collective',
    totalTimeLimit: totalTimeLimit || 3600,
    problems: problemIds,
    isPublished: isPublished !== undefined ? isPublished : true,
    createdBy: req.user._id,
  });
  return res.status(201).json(new ApiResponse(201, 'Question set imported', { set, problemsCreated: problemIds.length }));
});

export const listQuestionSets = asyncHandler(async (req, res) => {
  const { category, page = 1, limit = 20, adminView } = req.query;
  const filter = adminView === 'true' ? {} : { isPublished: true };
  if (category) filter.category = category;
  const sets = await QuestionSet.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));
  const total = await QuestionSet.countDocuments(filter);
  return res.json(new ApiResponse(200, 'Question sets fetched', { sets, total }));
});

export const getQuestionSet = asyncHandler(async (req, res) => {
  const set = await QuestionSet.findById(req.params.id).populate('problems');
  if (!set) throw new ApiError(404, 'Question set not found');
  return res.json(new ApiResponse(200, 'Question set fetched', { set }));
});

export const updateQuestionSet = asyncHandler(async (req, res) => {
  const existing = await QuestionSet.findById(req.params.id);
  if (!existing) throw new ApiError(404, 'Question set not found');

  if (existing.createdBy && existing.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Forbidden: You can only edit question sets created by you');
  }

  const updateData = { ...req.body };
  if (req.body.problems !== undefined) {
    updateData.problems = await resolveProblemIds(req.body.problems, req.user._id);
  }

  const set = await QuestionSet.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
  return res.json(new ApiResponse(200, 'Question set updated', { set }));
});

export const deleteQuestionSet = asyncHandler(async (req, res) => {
  const existing = await QuestionSet.findById(req.params.id);
  if (!existing) throw new ApiError(404, 'Question set not found');

  if (existing.createdBy && existing.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Forbidden: You can only delete question sets created by you');
  }

  await QuestionSet.findByIdAndDelete(req.params.id);
  return res.json(new ApiResponse(200, 'Question set deleted', {}));
});

// Admin: Reevaluate question set scores for all candidates using the last attempt made DURING test time
export const reevaluateQuestionSet = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const set = await QuestionSet.findById(id).populate('problems');
  if (!set) throw new ApiError(404, 'Question set not found');

  const problems = (set.problems || []).filter(Boolean);
  const problemMap = new Map();
  problems.forEach((p) => {
    problemMap.set(p._id.toString(), p);
  });

  // Find all attempts for this question set
  const attempts = await Attempt.find({ questionSetId: id });
  const attemptIds = attempts.map((a) => a._id);

  // Find all submissions associated with this question set and its attempts
  const submissions = await Submission.find({
    $or: [
      { questionSetId: set._id },
      { attemptId: { $in: attemptIds } },
    ],
  }).sort({ submittedAt: 1, createdAt: 1 });

  let submissionsRejudged = 0;
  let attemptsUpdated = 0;

  // Process each attempt: only consider submissions made DURING the test time
  for (const attempt of attempts) {
    const attemptStart = new Date(attempt.startedAt || attempt.createdAt || 0).getTime();
    // 15 seconds grace window for in-flight requests when test ends
    const attemptEnd = attempt.endedAt
      ? new Date(attempt.endedAt).getTime() + 15000
      : attemptStart + (attempt.totalTimeLimit || 3600) * 1000 + 15000;

    // Filter strictly to in-test submissions (tagged with attemptId or in attempt.submissions, and within test window)
    const inTestSubs = submissions.filter((s) => {
      const matchAttemptId = s.attemptId && s.attemptId.toString() === attempt._id.toString();
      const matchInArray = attempt.submissions && attempt.submissions.some((subId) => subId.toString() === s._id.toString());
      if (!matchAttemptId && !matchInArray) return false;

      const sTime = new Date(s.submittedAt || s.createdAt || 0).getTime();
      return sTime >= attemptStart - 5000 && sTime <= attemptEnd;
    });

    const subsByProblem = {};
    inTestSubs.forEach((s) => {
      const pId = (s.problemId?._id || s.problemId)?.toString();
      if (!pId) return;
      if (!subsByProblem[pId]) subsByProblem[pId] = [];
      subsByProblem[pId].push(s);
    });

    // Sort chronologically so last element is the last attempt made in test time
    Object.keys(subsByProblem).forEach((pId) => {
      subsByProblem[pId].sort((a, b) => {
        const timeA = new Date(a.submittedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.submittedAt || b.createdAt || 0).getTime();
        return timeA - timeB;
      });
    });

    let totalScore = 0;
    let maxPossibleScore = 0;

    for (const p of problems) {
      const pId = p._id.toString();
      const rules = getDifficultyPoints(p.difficulty);
      maxPossibleScore += rules.totalPoints;

      const probSubs = subsByProblem[pId] || [];
      if (probSubs.length > 0) {
        // Last attempt made in test time for this question
        const lastSub = probSubs[probSubs.length - 1];

        // Re-judge last attempt against current problem test cases if code exists
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

    // Keep only in-test submissions in attempt.submissions
    attempt.submissions = inTestSubs.map((s) => s._id);
    attempt.score = totalScore;
    attempt.maxPossibleScore = maxPossibleScore;
    await attempt.save();
    attemptsUpdated++;
  }

  return res.json(
    new ApiResponse(200, `Question set scores reevaluated successfully. Updated ${attemptsUpdated} attempt(s) and re-judged ${submissionsRejudged} last in-test submission(s).`, {
      questionSetId: id,
      attemptsUpdated,
      submissionsRejudged,
      totalAttempts: attempts.length,
    })
  );
});
