import assert from 'node:assert';
import { truncateTestCaseText } from './textUtils.js';

// Test 1: Short text is not truncated
const res1 = truncateTestCaseText('1 2 3 4 5');
assert.strictEqual(res1.isTruncated, false);
assert.strictEqual(res1.displayText, '1 2 3 4 5');

// Test 2: Text exceeding character limit
const longString = 'a'.repeat(400);
const res2 = truncateTestCaseText(longString, { maxChars: 250 });
assert.strictEqual(res2.isTruncated, true);
assert.strictEqual(res2.displayText.length, 250);
assert.strictEqual(res2.remainingChars, 150);

// Test 3: Text exceeding line limit
const multiLine = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join('\n');
const res3 = truncateTestCaseText(multiLine, { maxLines: 5, maxChars: 1000 });
assert.strictEqual(res3.isTruncated, true);
assert.strictEqual(res3.displayText.split('\n').length, 5);
assert.strictEqual(res3.remainingLines, 5);

// Test 4: Empty and null inputs
assert.strictEqual(truncateTestCaseText(null).isTruncated, false);
assert.strictEqual(truncateTestCaseText('').isTruncated, false);

console.log('textUtils unit self-check passed');
