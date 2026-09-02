import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { User } from '../models/user.model.js';
import { Problem } from '../models/problem.model.js';
import { QuestionSet } from '../models/questionset.model.js';
import { Submission } from '../models/submission.model.js';
import { Attempt } from '../models/attempt.model.js';
import { ApiError } from '../utils/ApiError.js';

export const getStats = asyncHandler(async (req, res) => {
  const [users, problems, sets, submissions, attempts] = await Promise.all([
    User.countDocuments(),
    Problem.countDocuments(),
    QuestionSet.countDocuments(),
    Submission.countDocuments(),
    Attempt.countDocuments(),
  ]);
  return res.json(new ApiResponse(200, 'Stats fetched', { users, problems, sets, submissions, attempts }));
});

export const listUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const users = await User.find()
    .select('-password -refreshToken')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));
  const total = await User.countDocuments();
  return res.json(new ApiResponse(200, 'Users fetched', { users, total }));
});

export const updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) throw new ApiError(400, 'Invalid role');
  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password -refreshToken');
  if (!user) throw new ApiError(404, 'User not found');
  return res.json(new ApiResponse(200, 'Role updated', { user }));
});
