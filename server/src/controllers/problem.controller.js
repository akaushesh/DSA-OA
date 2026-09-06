import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { Problem } from '../models/problem.model.js';
import { normalizeStarterCode } from '../utils/starterCode.js';

// Admin: create problem
export const createProblem = asyncHandler(async (req, res) => {
  const { title, description, difficulty, category, tags, inputFormat, outputFormat, constraints, examples, starterCode, timeLimit, memoryLimit, testCases } = req.body;
  if (!title || !description || !difficulty || !category) throw new ApiError(400, 'title, description, difficulty, category required');
  const rawStarter = starterCode ?? req.body.starter_code ?? req.body.starter;
  const normalizedStarter = normalizeStarterCode(rawStarter);
  const problem = await Problem.create({ title, description, difficulty, category, tags, inputFormat, outputFormat, constraints, examples, starterCode: normalizedStarter, timeLimit, memoryLimit, testCases, createdBy: req.user._id });
  return res.status(201).json(new ApiResponse(201, 'Problem created', { problem }));
});

// Admin: list all problems
export const listProblems = asyncHandler(async (req, res) => {
  const { category, difficulty, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (category) filter.category = category;
  if (difficulty) filter.difficulty = difficulty;
  const problems = await Problem.find(filter)
    .select('-testCases')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));
  const total = await Problem.countDocuments(filter);
  return res.json(new ApiResponse(200, 'Problems fetched', { problems, total, page: Number(page), limit: Number(limit) }));
});

// Admin: get single problem WITH test cases
export const getProblemAdmin = asyncHandler(async (req, res) => {
  const problem = await Problem.findById(req.params.id);
  if (!problem) throw new ApiError(404, 'Problem not found');
  return res.json(new ApiResponse(200, 'Problem fetched', { problem }));
});

// Admin: update problem
export const updateProblem = asyncHandler(async (req, res) => {
  const updateData = { ...req.body };
  if (req.body.starterCode !== undefined || req.body.starter_code !== undefined || req.body.starter !== undefined) {
    updateData.starterCode = normalizeStarterCode(req.body.starterCode ?? req.body.starter_code ?? req.body.starter);
  }
  const problem = await Problem.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
  if (!problem) throw new ApiError(404, 'Problem not found');
  return res.json(new ApiResponse(200, 'Problem updated', { problem }));
});

// Admin: delete problem
export const deleteProblem = asyncHandler(async (req, res) => {
  const problem = await Problem.findByIdAndDelete(req.params.id);
  if (!problem) throw new ApiError(404, 'Problem not found');
  return res.json(new ApiResponse(200, 'Problem deleted', {}));
});

export const sanitizeProblemTestCases = (testCases, isPractice) => {
  if (isPractice) return testCases;
  return (testCases || []).map(tc =>
    tc.isHidden ? { isHidden: true } : tc
  );
};

// User: get problem (strips hidden test case content unless in practice mode)
export const getProblemUser = asyncHandler(async (req, res) => {
  const problem = await Problem.findById(req.params.id);
  if (!problem) throw new ApiError(404, 'Problem not found');
  const isPractice = req.query.practice === 'true' || req.query.practice === '1';
  // ponytail: in practice mode, preserve hidden test case input/expectedOutput for learning
  const sanitized = problem.toObject();
  sanitized.testCases = sanitizeProblemTestCases(sanitized.testCases, isPractice);
  return res.json(new ApiResponse(200, 'Problem fetched', { problem: sanitized }));
});

