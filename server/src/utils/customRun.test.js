import assert from 'node:assert';
import { runCustomInput } from '../services/judge0.service.js';

// Test 1: C++ custom input execution
const cppCode = `
#include <iostream>
using namespace std;
int main() {
    int a, b;
    if (cin >> a >> b) {
        cout << (a + b) << endl;
    }
    return 0;
}
`;

const res1 = await runCustomInput({
  language: 'cpp',
  code: cppCode,
  stdin: '15 27',
  timeLimit: 5,
});

assert.strictEqual(res1.timedOut, false);
assert.strictEqual(res1.error, null);
assert.strictEqual(res1.stdout, '42');

// Test 2: Compilation error detection
const badCode = `
#include <iostream>
int main() {
    this_is_syntax_error;
}
`;

const res2 = await runCustomInput({
  language: 'cpp',
  code: badCode,
  stdin: '',
  timeLimit: 5,
});

assert.strictEqual(res2.error, 'CE');
assert.ok(res2.stderr.length > 0);

// Test 3: Java custom input execution
const javaCode = `
import java.util.Scanner;
public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int x = sc.nextInt();
        int y = sc.nextInt();
        System.out.println(x * y);
    }
}
`;

const res3 = await runCustomInput({
  language: 'java',
  code: javaCode,
  stdin: '6 7',
  timeLimit: 5,
});

assert.strictEqual(res3.timedOut, false);
assert.strictEqual(res3.error, null);
assert.strictEqual(res3.stdout, '42');

console.log('customRun unit self-check passed');

