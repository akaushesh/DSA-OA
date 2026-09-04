import { spawn, execFile } from 'child_process';
import { writeFile, mkdir, rm } from 'fs/promises';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { promisify } from 'util';

const execPromise = promisify(execFile);
const TMP = '/tmp/dsa-arena';
const INCLUDE_DIR = join(TMP, 'include', 'bits');

const STDCXX_H = `
#pragma once
#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <map>
#include <set>
#include <unordered_map>
#include <unordered_set>
#include <queue>
#include <stack>
#include <deque>
#include <list>
#include <cmath>
#include <climits>
#include <cstring>
#include <cstdio>
#include <cstdlib>
#include <sstream>
#include <iomanip>
#include <numeric>
#include <utility>
#include <functional>
#include <bitset>
#include <tuple>
#include <iterator>
#include <memory>
#include <chrono>
#include <random>
#include <cassert>
#include <complex>
#include <valarray>
`;

let includeDirReady = false;
async function ensureIncludeHeaders() {
  if (includeDirReady) return;
  try {
    await mkdir(INCLUDE_DIR, { recursive: true });
    await writeFile(join(INCLUDE_DIR, 'stdc++.h'), STDCXX_H);
    includeDirReady = true;
  } catch (err) {
    console.error("Failed to setup bits/stdc++.h header:", err);
  }
}

function executeProcess(cmd, args, stdin, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args);
    let stdout = '';
    let stderr = '';
    let isDone = false;

    const timer = setTimeout(() => {
      if (!isDone) {
        isDone = true;
        child.kill('SIGKILL');
        resolve({ stdout: '', stderr: 'Time Limit Exceeded', timedOut: true, error: 'TLE' });
      }
    }, timeoutMs);

    if (stdin) {
      child.stdin.write(stdin);
    }
    child.stdin.end();

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      if (!isDone) {
        isDone = true;
        clearTimeout(timer);
        resolve({ stdout, stderr: err.message, timedOut: false, error: 'RE' });
      }
    });

    child.on('close', (code, signal) => {
      if (!isDone) {
        isDone = true;
        clearTimeout(timer);
        if (signal === 'SIGKILL' || signal === 'SIGTERM') {
          resolve({ stdout: '', stderr: 'Time Limit Exceeded', timedOut: true, error: 'TLE' });
        } else if (code !== 0) {
          resolve({ stdout: stdout.trim(), stderr: stderr.trim(), timedOut: false, error: 'RE' });
        } else {
          resolve({ stdout: stdout.trim(), stderr: stderr.trim(), timedOut: false, error: null });
        }
      }
    });
  });
}

async function runOne({ language, code, stdin, timeLimit = 5, memoryLimit = 256 }) {
  await ensureIncludeHeaders();
  const id = randomUUID();
  const dir = join(TMP, id);
  await mkdir(dir, { recursive: true });

  try {
    let binCmd;
    let binArgs;

    if (language === 'cpp') {
      const src = join(dir, 'main.cpp');
      const bin = join(dir, 'main');
      await writeFile(src, code);
      try {
        await execPromise('g++', [
          '-std=c++17',
          '-O2',
          `-I${join(TMP, 'include')}`,
          '-o',
          bin,
          src
        ], { timeout: 15000 });
      } catch (compileErr) {
        return { stdout: '', stderr: compileErr.stderr || compileErr.message, timedOut: false, error: 'CE' };
      }
      binCmd = bin;
      binArgs = [];
    } else {
      // Java
      const src = join(dir, 'Main.java');
      await writeFile(src, code.replace(/public\s+class\s+\w+/, 'public class Main'));
      try {
        await execPromise('javac', [src], { timeout: 15000 });
      } catch (compileErr) {
        return { stdout: '', stderr: compileErr.stderr || compileErr.message, timedOut: false, error: 'CE' };
      }
      binCmd = 'java';
      binArgs = ['-cp', dir, `-Xmx${memoryLimit}m`, 'Main'];
    }

    const res = await executeProcess(binCmd, binArgs, stdin, timeLimit * 1000);
    return res;
  } catch (err) {
    return { stdout: '', stderr: err.message, timedOut: false, error: 'RE' };
  } finally {
    rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function runAllTestCases({ language, code, testCases, timeLimit = 5, memoryLimit = 256 }) {
  const results = [];
  let passed = 0;
  let finalVerdict = 'AC';
  let compileError = null;
  let maxTime = 0;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const start = Date.now();
    const res = await runOne({ language, code, stdin: tc.input, timeLimit, memoryLimit });
    const elapsed = Date.now() - start;

    // CE on first case → mark all as CE and bail
    if (res.error === 'CE' && i === 0) {
      compileError = res.stderr;
      finalVerdict = 'CE';
      testCases.forEach((t, j) =>
        results.push({ testCaseIndex: j, isHidden: t.isHidden, passed: false, time: null })
      );
      break;
    }

    const clean = s => (s || '').trim();
    const tcPassed =
      !res.timedOut &&
      res.error === null &&
      clean(res.stdout) === clean(tc.expectedOutput);

    if (tcPassed) passed++;
    maxTime = Math.max(maxTime, elapsed);

    const verdict = res.timedOut ? 'TLE' : (res.error || (tcPassed ? 'AC' : 'WA'));
    if (verdict !== 'AC' && finalVerdict === 'AC') finalVerdict = verdict;

    results.push({
      testCaseIndex: i,
      isHidden: tc.isHidden,
      passed: tcPassed,
      stdout: res.stdout,
      stderr: res.stderr,
      time: elapsed,
    });
  }

  return {
    verdict: finalVerdict,
    passedTests: passed,
    totalTests: testCases.length,
    runtime: maxTime,
    compileError,
    testResults: results,
  };
}
