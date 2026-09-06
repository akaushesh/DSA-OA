import assert from 'node:assert';
import { calculateProblemScore, calculateAttemptScoreBreakdown, getDifficultyPoints } from './scoring.js';

// Case 1: calculateProblemScore for Easy, Medium, Hard
assert.strictEqual(calculateProblemScore('Easy', 6, 6), 100);
assert.strictEqual(calculateProblemScore('Medium', 6, 6), 250);
assert.strictEqual(calculateProblemScore('Hard', 6, 6), 450);
assert.strictEqual(calculateProblemScore('Easy', 0, 6), 0);

// Case 2: calculateAttemptScoreBreakdown takes LAST attempt per question
const problems = [
  { _id: 'p1', difficulty: 'Easy' }, // 100 max
  { _id: 'p2', difficulty: 'Medium' }, // 250 max
];

const submissions = [
  // Problem 1: First attempt passed all 6 tests (100 pts), but last attempt passed only 1 test (5 pts)
  {
    problemId: 'p1',
    submittedAt: new Date('2026-09-06T10:00:00Z'),
    passedTests: 6,
    totalTests: 6,
    score: 100,
  },
  {
    problemId: 'p1',
    submittedAt: new Date('2026-09-06T10:15:00Z'),
    passedTests: 1,
    totalTests: 6,
    score: 5,
  },
  // Problem 2: First attempt passed 0 tests (0 pts), last attempt passed 6 tests (250 pts)
  {
    problemId: 'p2',
    submittedAt: new Date('2026-09-06T10:05:00Z'),
    passedTests: 0,
    totalTests: 6,
    score: 0,
  },
  {
    problemId: 'p2',
    submittedAt: new Date('2026-09-06T10:20:00Z'),
    passedTests: 6,
    totalTests: 6,
    score: 250,
  },
];

// By default: takes last attempts (5 pts for p1, 250 pts for p2 => 255 total)
const resultLast = calculateAttemptScoreBreakdown(problems, submissions);
assert.strictEqual(resultLast.problemScores['p1'], 5);
assert.strictEqual(resultLast.problemScores['p2'], 250);
assert.strictEqual(resultLast.totalScore, 255);
assert.strictEqual(resultLast.maxPossibleScore, 350);

// Legacy flag: useMaxScore takes highest (100 pts for p1, 250 pts for p2 => 350 total)
const resultMax = calculateAttemptScoreBreakdown(problems, submissions, { useMaxScore: true });
assert.strictEqual(resultMax.problemScores['p1'], 100);
assert.strictEqual(resultMax.problemScores['p2'], 250);
assert.strictEqual(resultMax.totalScore, 350);

// Case 3: No submissions for problem -> 0 points
const resultEmpty = calculateAttemptScoreBreakdown(problems, []);
assert.strictEqual(resultEmpty.problemScores['p1'], 0);
assert.strictEqual(resultEmpty.problemScores['p2'], 0);
assert.strictEqual(resultEmpty.totalScore, 0);

console.log('scoring unit self-check passed');
