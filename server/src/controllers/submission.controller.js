import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { Submission } from '../models/submission.model.js';
import { Problem } from '../models/problem.model.js';
import { Attempt } from '../models/attempt.model.js';
import { runAllTestCases } from '../services/judge0.service.js';
import { calculateProblemScore, calculateAttemptScoreBreakdown } from '../utils/scoring.js';

export const submitCode = asyncHandler(async (req, res) => {
  const { problemId, questionSetId, attemptId, language, code } = req.body;
  if (!problemId || !language || !code) throw new ApiError(400, 'problemId, language, code required');
  if (!['java', 'cpp'].includes(language)) throw new ApiError(400, 'Language must be java or cpp');

  const problem = await Problem.findById(problemId);
  if (!problem) throw new ApiError(404, 'Problem not found');

  // Validate attempt timing if applicable
  if (attemptId) {
    const attempt = await Attempt.findById(attemptId);
    if (!attempt || attempt.userId.toString() !== req.user._id.toString()) throw new ApiError(403, 'Invalid attempt');
    if (attempt.status !== 'in_progress') throw new ApiError(400, 'Attempt already completed');

    if (attempt.timingMode === 'collective') {
      const elapsed = (Date.now() - attempt.startedAt.getTime()) / 1000;
      if (elapsed > attempt.totalTimeLimit) throw new ApiError(400, 'Time limit exceeded');
    }
  }

  // Create submission record
  const submission = await Submission.create({
    userId: req.user._id,
    problemId,
    questionSetId,
    attemptId,
    language,
    code,
    status: 'running',
    totalTests: problem.testCases.length,
  });

  // Return immediately with pending ID, run async
  res.status(202).json(new ApiResponse(202, 'Submission queued', { submissionId: submission._id }));

  // Run judge async (after response sent)
  try {
    const result = await runAllTestCases({
      language,
      code,
      testCases: problem.testCases,
      timeLimit: Math.ceil((problem.timeLimit || 1800) / 1000) || 2,
      memoryLimit: problem.memoryLimit || 256,
    });

    const score = calculateProblemScore(problem.difficulty, result.passedTests, result.totalTests);

    await Submission.findByIdAndUpdate(submission._id, {
      status: 'done',
      verdict: result.verdict,
      passedTests: result.passedTests,
      totalTests: result.totalTests,
      runtime: result.runtime,
      memory: result.memory,
      score,
      compileError: result.compileError,
      testResults: result.testResults,
    });

    // Link submission to attempt and update attempt score taking MAX per question
    if (attemptId) {
      await Attempt.findByIdAndUpdate(attemptId, { $addToSet: { submissions: submission._id } });

      const attempt = await Attempt.findById(attemptId)
        .populate({
          path: 'questionSetId',
          populate: { path: 'problems', select: 'difficulty' },
        })
        .populate('submissions', 'problemId score passedTests totalTests');

      if (attempt?.questionSetId?.problems && attempt?.submissions) {
        const { totalScore } = calculateAttemptScoreBreakdown(
          attempt.questionSetId.problems,
          attempt.submissions
        );
        attempt.score = totalScore;
        await attempt.save();
      }
    }
  } catch (err) {
    await Submission.findByIdAndUpdate(submission._id, { status: 'error', verdict: 'RE' });
  }
});

export const getSubmission = asyncHandler(async (req, res) => {
  const submission = await Submission.findById(req.params.id);
  if (!submission) throw new ApiError(404, 'Submission not found');
  if (submission.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Forbidden');
  }
  return res.json(new ApiResponse(200, 'Submission fetched', { submission }));
});

export const mySubmissions = asyncHandler(async (req, res) => {
  const { problemId, attemptId, page = 1, limit = 50 } = req.query;
  const filter = { userId: req.user._id };
  if (problemId) filter.problemId = problemId;
  if (attemptId) filter.attemptId = attemptId;
  
  const submissions = await Submission.find(filter)
    .populate('problemId', 'title difficulty category')
    .sort({ submittedAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));
    
  return res.json(new ApiResponse(200, 'Submissions fetched', { submissions }));
});
