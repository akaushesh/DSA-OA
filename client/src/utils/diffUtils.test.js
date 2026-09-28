import assert from 'node:assert';
import { computeOutputDiff } from './diffUtils.js';

// Test 1: Identical strings
const res1 = computeOutputDiff('1 2 3', '1 2 3');
assert.strictEqual(res1.hasDiff, false);
assert.strictEqual(res1.lines.length, 0);

// Test 2: Null and undefined safety
const res2 = computeOutputDiff(null, undefined);
assert.strictEqual(res2.hasDiff, false);

// Test 3: Single-line mismatch with token highlighting
const res3 = computeOutputDiff('[0, 2]', '[0, 1]');
assert.strictEqual(res3.hasDiff, true);
assert.strictEqual(res3.lines.length, 2);
assert.strictEqual(res3.lines[0].prefix, '-');
assert.strictEqual(res3.lines[1].prefix, '+');
// The differing character '2' in actual should be marked as isDiff: true
const diffTokenA = res3.lines[0].tokens.find((t) => t.isDiff);
assert.ok(diffTokenA, 'Should have highlighted diff token in actual');
assert.strictEqual(diffTokenA.text, '2');
// The differing character '1' in expected should be marked as isDiff: true
const diffTokenB = res3.lines[1].tokens.find((t) => t.isDiff);
assert.ok(diffTokenB, 'Should have highlighted diff token in expected');
assert.strictEqual(diffTokenB.text, '1');

// Test 4: Multi-line mismatch
const actualMulti = '1 2 3\n4 5 6\n7 8 9';
const expectedMulti = '1 2 3\n4 99 6\n7 8 9';
const res4 = computeOutputDiff(actualMulti, expectedMulti);
assert.strictEqual(res4.hasDiff, true);
assert.strictEqual(res4.lines.length, 4);
assert.strictEqual(res4.lines[0].type, 'eq');
assert.strictEqual(res4.lines[1].type, 'del');
assert.strictEqual(res4.lines[2].type, 'ins');
assert.strictEqual(res4.lines[3].type, 'eq');

// Test 5: Trailing whitespace difference
const res5 = computeOutputDiff('hello \n', 'hello');
assert.strictEqual(res5.hasDiff, true);
assert.strictEqual(res5.isWhitespaceOnly, true);

// Test 6: Extra lines in actual output
const res6 = computeOutputDiff('line1\nline2\nextra', 'line1\nline2');
assert.strictEqual(res6.hasDiff, true);
const delLine = res6.lines.find((l) => l.text === 'extra');
assert.ok(delLine, 'Should have deleted line');
assert.strictEqual(delLine.prefix, '-');

console.log('diffUtils unit self-check passed');
