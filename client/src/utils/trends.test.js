import assert from 'node:assert';
import { aggregateCategoryStats, computeRecentTrends } from './trends.js';

// Test 1: Empty input
assert.deepStrictEqual(aggregateCategoryStats([]), []);
assert.deepStrictEqual(computeRecentTrends([]), []);

// Test 2: Category grouping & stats computation
const mockAttempts = [
  {
    _id: 'a1',
    questionSetId: { name: 'Arrays 101', category: 'Arrays' },
    score: 80,
    maxPossibleScore: 100,
    status: 'completed',
    startedAt: '2026-09-01T10:00:00Z',
  },
  {
    _id: 'a2',
    questionSetId: { name: 'Arrays Adv', category: 'Arrays' },
    score: 100,
    maxPossibleScore: 100,
    status: 'completed',
    startedAt: '2026-09-05T10:00:00Z',
  },
  {
    _id: 'a3',
    questionSetId: { name: 'DP Master', category: 'DP' },
    score: 150,
    maxPossibleScore: 300, // 50%
    status: 'in_progress',
    startedAt: '2026-09-03T10:00:00Z',
  },
  {
    _id: 'a4',
    questionSetId: null, // Fallback to 'General'
    score: 50,
    maxPossibleScore: 100,
    status: 'completed',
    startedAt: '2026-09-02T10:00:00Z',
  },
];

const stats = aggregateCategoryStats(mockAttempts);
assert.strictEqual(stats.length, 3);

const arrayStat = stats.find(s => s.name === 'Arrays');
assert.strictEqual(arrayStat.totalAttempts, 2);
assert.strictEqual(arrayStat.completedCount, 2);
assert.strictEqual(arrayStat.avgPct, 90); // (80% + 100%) / 2
assert.strictEqual(arrayStat.bestPct, 100);
assert.strictEqual(arrayStat.totalPoints, 180);

const dpStat = stats.find(s => s.name === 'DP');
assert.strictEqual(dpStat.totalAttempts, 1);
assert.strictEqual(dpStat.completedCount, 0);
assert.strictEqual(dpStat.avgPct, 50);
assert.strictEqual(dpStat.bestPct, 50);
assert.strictEqual(dpStat.totalPoints, 150);

const generalStat = stats.find(s => s.name === 'General');
assert.strictEqual(generalStat.totalAttempts, 1);
assert.strictEqual(generalStat.avgPct, 50);

// Test 3: Chronological ordering and filtering
const allTrends = computeRecentTrends(mockAttempts, { category: 'All' });
assert.strictEqual(allTrends.length, 4);
assert.strictEqual(allTrends[0]._id, 'a1'); // 2026-09-01
assert.strictEqual(allTrends[1]._id, 'a4'); // 2026-09-02
assert.strictEqual(allTrends[2]._id, 'a3'); // 2026-09-03
assert.strictEqual(allTrends[3]._id, 'a2'); // 2026-09-05

const dpTrends = computeRecentTrends(mockAttempts, { category: 'DP' });
assert.strictEqual(dpTrends.length, 1);
assert.strictEqual(dpTrends[0]._id, 'a3');

// Test 4: Limit enforcement
const limitedTrends = computeRecentTrends(mockAttempts, { category: 'All', limit: 2 });
assert.strictEqual(limitedTrends.length, 2);
assert.strictEqual(limitedTrends[0]._id, 'a3');
assert.strictEqual(limitedTrends[1]._id, 'a2');

// Test 5: Safe division by zero
const zeroMaxAttempts = [
  { _id: 'z1', questionSetId: { category: 'Math' }, score: 0, maxPossibleScore: 0, status: 'completed' },
];
const zeroStats = aggregateCategoryStats(zeroMaxAttempts);
assert.strictEqual(zeroStats[0].avgPct, 0);
assert.strictEqual(zeroStats[0].bestPct, 0);

console.log('trends unit self-check passed');
