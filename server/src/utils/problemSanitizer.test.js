import assert from 'node:assert';
import { sanitizeProblemTestCases } from '../controllers/problem.controller.js';

const sampleTestCases = [
  { input: '1 2', expectedOutput: '3', isHidden: false },
  { input: '10 20', expectedOutput: '30', isHidden: true },
];

// Test 1: In assessment mode (!isPractice), hidden test case inputs and expectedOutputs are stripped
const stripped = sanitizeProblemTestCases(sampleTestCases, false);
assert.strictEqual(stripped.length, 2);
assert.strictEqual(stripped[0].input, '1 2');
assert.strictEqual(stripped[0].expectedOutput, '3');
assert.strictEqual(stripped[1].isHidden, true);
assert.strictEqual(stripped[1].input, undefined);
assert.strictEqual(stripped[1].expectedOutput, undefined);

// Test 2: In practice mode (isPractice = true), hidden test cases keep their input and expectedOutput intact
const kept = sanitizeProblemTestCases(sampleTestCases, true);
assert.strictEqual(kept.length, 2);
assert.strictEqual(kept[1].isHidden, true);
assert.strictEqual(kept[1].input, '10 20');
assert.strictEqual(kept[1].expectedOutput, '30');

console.log('problemSanitizer unit self-check passed');
