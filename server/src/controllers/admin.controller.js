import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { User } from '../models/user.model.js';
import { Problem } from '../models/problem.model.js';
import { QuestionSet } from '../models/questionset.model.js';
import { Submission } from '../models/submission.model.js';
import { Attempt } from '../models/attempt.model.js';
import { ApiError } from '../utils/ApiError.js';

export const getStats = asyncHandler(async (req, res) => {
  const [users, problems, sets, submissions, attempts, activeAttempts] = await Promise.all([
    User.countDocuments(),
    Problem.countDocuments(),
    QuestionSet.countDocuments(),
    Submission.countDocuments(),
    Attempt.countDocuments(),
    Attempt.countDocuments({ status: 'in_progress' }),
  ]);
  return res.json(new ApiResponse(200, 'Stats fetched', { users, problems, sets, submissions, attempts, activeAttempts }));
});

export const listUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, search, role } = req.query;
  const filter = {};
  if (role && role !== 'all') filter.role = role;
  if (search) {
    filter.$or = [
      { username: { $regex: search, $options: 'i' } },
      { fullName: { $regex: search, $options: 'i' } },
    ];
  }

  const users = await User.find(filter)
    .select('-password -refreshToken')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  // Quick stats per user
  const usersWithStats = await Promise.all(
    users.map(async (u) => {
      const [attemptsCount, activeAttemptsCount, setsCount] = await Promise.all([
        Attempt.countDocuments({ userId: u._id }),
        Attempt.countDocuments({ userId: u._id, status: 'in_progress' }),
        QuestionSet.countDocuments({ createdBy: u._id }),
      ]);
      return {
        ...u.toObject(),
        stats: {
          attemptsCount,
          activeAttemptsCount,
          setsCount,
        },
      };
    })
  );

  const total = await User.countDocuments(filter);
  return res.json(new ApiResponse(200, 'Users fetched', { users: usersWithStats, total }));
});

export const getUserDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id).select('-password -refreshToken');
  if (!user) throw new ApiError(404, 'User not found');

  const [questionSets, attempts, submissions] = await Promise.all([
    QuestionSet.find({ createdBy: id })
      .populate('problems', 'title difficulty category timeLimit')
      .sort({ createdAt: -1 }),
    Attempt.find({ userId: id })
      .populate({
        path: 'questionSetId',
        select: 'name category timingMode totalTimeLimit problems',
        populate: { path: 'problems', select: 'title difficulty' },
      })
      .populate('submissions', 'problemId verdict passedTests totalTests')
      .sort({ startedAt: -1 }),
    Submission.find({ userId: id })
      .populate('problemId', 'title difficulty category')
      .sort({ submittedAt: -1 })
      .limit(30),
  ]);

  const completedAttempts = attempts.filter((a) => a.status === 'completed');
  const activeAttempts = attempts.filter((a) => a.status === 'in_progress');
  const stoppedAttempts = attempts.filter((a) => a.status === 'stopped_by_admin');
  const acSubmissions = submissions.filter((s) => s.verdict === 'AC');

  // Overall accuracy across attempts
  let totalProblemsInAttempts = 0;
  let totalSolvedProblems = 0;
  attempts.forEach((a) => {
    const probs = a.questionSetId?.problems || [];
    totalProblemsInAttempts += probs.length;
    const acSubs = (a.submissions || []).filter((s) => s.verdict === 'AC');
    const uniqueAcProblems = new Set(acSubs.map((s) => (s.problemId?._id || s.problemId)?.toString()));
    totalSolvedProblems += uniqueAcProblems.size;
  });

  const accuracyPercent =
    totalProblemsInAttempts > 0 ? Math.round((totalSolvedProblems / totalProblemsInAttempts) * 100) : 0;

  return res.json(
    new ApiResponse(200, 'User details fetched', {
      user,
      questionSets,
      attempts,
      recentSubmissions: submissions,
      stats: {
        totalSets: questionSets.length,
        totalAttempts: attempts.length,
        completedAttempts: completedAttempts.length,
        activeAttempts: activeAttempts.length,
        stoppedAttempts: stoppedAttempts.length,
        totalSubmissions: submissions.length,
        acSubmissions: acSubmissions.length,
        accuracyPercent,
      },
    })
  );
});

export const updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) throw new ApiError(400, 'Invalid role');
  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password -refreshToken');
  if (!user) throw new ApiError(404, 'User not found');
  return res.json(new ApiResponse(200, 'Role updated', { user }));
});
