import assert from 'assert';
import { aggregateTopicsFromAttempts } from './topicAggregator.js';

// Test 1: Empty attempts list returns 0 stats
const emptyResult = aggregateTopicsFromAttempts([]);
assert.strictEqual(emptyResult.topics.length, 0);
assert.strictEqual(emptyResult.stats.totalQuestions, 0);
assert.strictEqual(emptyResult.stats.totalSolved, 0);
assert.strictEqual(emptyResult.stats.overallAccuracy, 0);

// Test 2: Multi-topic attempts aggregation with solved and attempted problems
const mockAttempts = [
  {
    _id: 'att_1',
    startedAt: new Date('2026-09-15T10:00:00Z'),
    status: 'completed',
    score: 100,
    questionSetId: {
      name: 'Mock Set 1',
      category: 'Arrays',
      problems: [
        { _id: 'prob_1', title: 'Two Sum', difficulty: 'Easy', category: 'Arrays', tags: ['Hash'] },
        { _id: 'prob_2', title: '3Sum', difficulty: 'Medium', category: 'Arrays', tags: ['Two Pointer'] },
      ],
    },
    submissions: [
      { problemId: 'prob_1', verdict: 'AC', score: 100, submittedAt: new Date('2026-09-15T10:10:00Z') },
      { problemId: 'prob_2', verdict: 'WA', score: 30, submittedAt: new Date('2026-09-15T10:20:00Z') },
    ],
  },
  {
    _id: 'att_2',
    startedAt: new Date('2026-09-16T12:00:00Z'),
    status: 'completed',
    score: 200,
    questionSetId: {
      name: 'Mock Set 2',
      category: 'Trees',
      problems: [
        { _id: 'prob_2', title: '3Sum', difficulty: 'Medium', category: 'Arrays', tags: ['Two Pointer'] },
        { _id: 'prob_3', title: 'Invert Tree', difficulty: 'Easy', category: 'Trees', tags: ['DFS'] },
      ],
    },
    submissions: [
      // prob_2 solved in second attempt
      { problemId: 'prob_2', verdict: 'AC', score: 100, submittedAt: new Date('2026-09-16T12:15:00Z') },
      // prob_3 left unattempted
    ],
  },
];

const result = aggregateTopicsFromAttempts(mockAttempts);

// Should find 2 topics: Arrays and Trees
assert.strictEqual(result.topics.length, 2);
assert.strictEqual(result.stats.totalTopics, 2);
assert.strictEqual(result.stats.totalQuestions, 3); // prob_1, prob_2, prob_3
assert.strictEqual(result.stats.totalSolved, 2); // prob_1 and prob_2 both have AC
assert.strictEqual(result.stats.totalAttempted, 2); // prob_1 and prob_2 had submissions, prob_3 had none

// Verify Arrays topic details
const arraysTopic = result.topics.find((t) => t.name === 'Arrays');
assert.ok(arraysTopic);
assert.strictEqual(arraysTopic.totalQuestions, 2);
assert.strictEqual(arraysTopic.solvedCount, 2);
assert.strictEqual(arraysTopic.accuracyRate, 100);

// Verify prob_2 has 2 associated attempts
const threeSum = arraysTopic.problems.find((p) => p._id === 'prob_2');
assert.ok(threeSum);
assert.strictEqual(threeSum.isSolved, true);
assert.strictEqual(threeSum.bestVerdict, 'AC');
assert.strictEqual(threeSum.attempts.length, 2);
assert.strictEqual(threeSum.attempts[0].attemptId, 'att_2'); // most recent first
assert.strictEqual(threeSum.attempts[0].verdict, 'AC');
assert.strictEqual(threeSum.attempts[1].attemptId, 'att_1');
assert.strictEqual(threeSum.attempts[1].verdict, 'WA');

// Verify Trees topic details
const treesTopic = result.topics.find((t) => t.name === 'Trees');
assert.ok(treesTopic);
assert.strictEqual(treesTopic.totalQuestions, 1);
assert.strictEqual(treesTopic.solvedCount, 0);
const invertTree = treesTopic.problems.find((p) => p._id === 'prob_3');
assert.ok(invertTree);
assert.strictEqual(invertTree.isSolved, false);
assert.strictEqual(invertTree.bestVerdict, 'Unattempted');
assert.strictEqual(invertTree.attempts[0].verdict, 'Unattempted');

console.log('topicAggregator unit self-check passed');
