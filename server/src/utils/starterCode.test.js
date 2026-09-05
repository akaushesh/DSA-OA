import assert from 'node:assert';
import { normalizeStarterCode } from './starterCode.js';

// Case 1: Standard object keys
const res1 = normalizeStarterCode({ cpp: '#include <iostream>', java: 'class Solution {}' });
assert.strictEqual(res1.cpp, '#include <iostream>');
assert.strictEqual(res1.java, 'class Solution {}');

// Case 2: Object with aliases (c++, C++, Java, etc.)
const res2 = normalizeStarterCode({ 'c++': 'int main() {}', 'Java': 'public class Main {}' });
assert.strictEqual(res2.cpp, 'int main() {}');
assert.strictEqual(res2.java, 'public class Main {}');

// Case 3: Raw string C++
const res3 = normalizeStarterCode('#include <bits/stdc++.h>\nusing namespace std;\nint main() {}');
assert.strictEqual(res3.cpp.includes('#include'), true);
assert.strictEqual(res3.java, '');

// Case 4: Raw string Java
const res4 = normalizeStarterCode('import java.util.*;\npublic class Solution {}');
assert.strictEqual(res4.cpp, '');
assert.strictEqual(res4.java.includes('public class'), true);

// Case 5: Null / undefined / empty
const res5 = normalizeStarterCode(null);
assert.strictEqual(res5.cpp, '');
assert.strictEqual(res5.java, '');

console.log('starterCode unit self-check passed');
