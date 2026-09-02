import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { QuestionSet } from '../models/questionset.model.js';
import { Problem } from '../models/problem.model.js';

// Admin & User: create question set (also handles JSON upload)
export const createQuestionSet = asyncHandler(async (req, res) => {
  const { name, description, category, problems: problemIds, timingMode, totalTimeLimit, isPublished } = req.body;
  if (!name || !category) throw new ApiError(400, 'name and category required');
  const set = await QuestionSet.create({ name, description, category, problems: problemIds || [], timingMode, totalTimeLimit, isPublished, createdBy: req.user._id });
  return res.status(201).json(new ApiResponse(201, 'Question set created', { set }));
});

// Admin & User: import from JSON (creates problems + set in one shot)
export const importQuestionSet = asyncHandler(async (req, res) => {
  const { name, description, category, timingMode, totalTimeLimit, isPublished, problems: rawProblems } = req.body;
  if (!name || !category || !rawProblems?.length) throw new ApiError(400, 'name, category, and problems[] required');

  // Create all problems
  const created = await Problem.insertMany(
    rawProblems.map(p => ({ ...p, createdBy: req.user._id }))
  );
  const problemIds = created.map(p => p._id);

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
  return res.status(201).json(new ApiResponse(201, 'Question set imported', { set, problemsCreated: created.length }));
});

export const listQuestionSets = asyncHandler(async (req, res) => {
  const { category, page = 1, limit = 20, adminView } = req.query;
  const filter = adminView === 'true' ? {} : { isPublished: true };
  if (category) filter.category = category;
  const sets = await QuestionSet.find(filter)
    .select('-problems')
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

  const set = await QuestionSet.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
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
