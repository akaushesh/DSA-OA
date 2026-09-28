/**
 * Computes color-coded, line-level and token-level diff between actual and expected output.
 * Similar to LeetCode diff view.
 */

// Tokenizes string into characters or small tokens for intra-line comparison
function tokenize(str) {
  if (!str) return [];
  // For shorter strings, character-level diff is most precise
  if (str.length <= 400) return str.split('');
  // For longer strings, word/delimiter tokenization keeps LCS table fast
  return str.split(/(\s+|[^\w\s]+|\w+)/).filter(Boolean);
}

// Compute token-level diff for a single line pair
function tokenDiff(strA, strB) {
  const tokA = tokenize(strA);
  const tokB = tokenize(strB);

  // ponytail: cap token LCS at 400 items per line to prevent O(n^2) UI freeze on huge single-line tokens
  const m = Math.min(tokA.length, 400);
  const n = Math.min(tokB.length, 400);

  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (tokA[i] === tokB[j]) dp[i + 1][j + 1] = dp[i][j] + 1;
      else dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  let i = m;
  let j = n;
  const opsA = [];
  const opsB = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && tokA[i - 1] === tokB[j - 1]) {
      opsA.unshift({ text: tokA[i - 1], isDiff: false });
      opsB.unshift({ text: tokB[j - 1], isDiff: false });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      opsB.unshift({ text: tokB[j - 1], isDiff: true });
      j--;
    } else {
      opsA.unshift({ text: tokA[i - 1], isDiff: true });
      i--;
    }
  }

  // Merge adjacent tokens with the same isDiff status
  const mergeTokens = (list) => {
    const res = [];
    for (const item of list) {
      const last = res[res.length - 1];
      if (last && last.isDiff === item.isDiff) {
        last.text += item.text;
      } else {
        res.push({ ...item });
      }
    }
    return res;
  };

  return {
    tokensA: mergeTokens(opsA),
    tokensB: mergeTokens(opsB),
  };
}

/**
 * Computes structured diff data between actual and expected strings.
 * @param {string} actual
 * @param {string} expected
 * @returns {object} { hasDiff, isWhitespaceOnly, lines, rawDiffText }
 */
export function computeOutputDiff(actual = '', expected = '') {
  const actualStr = actual === null || actual === undefined ? '' : String(actual);
  const expectedStr = expected === null || expected === undefined ? '' : String(expected);

  if (actualStr === expectedStr) {
    return { hasDiff: false, isWhitespaceOnly: false, lines: [], rawDiffText: '' };
  }

  // Check if difference is purely whitespace or newline formatting
  const normA = actualStr.trim().replace(/\r\n/g, '\n');
  const normB = expectedStr.trim().replace(/\r\n/g, '\n');
  const isWhitespaceOnly = normA === normB && actualStr !== expectedStr;

  const actualLines = actualStr.split('\n');
  const expectedLines = expectedStr.split('\n');

  // Single-line comparison
  if (actualLines.length === 1 && expectedLines.length === 1) {
    const { tokensA, tokensB } = tokenDiff(actualLines[0], expectedLines[0]);
    const lines = [
      { type: 'del', prefix: '-', tokens: tokensA, text: actualLines[0] },
      { type: 'ins', prefix: '+', tokens: tokensB, text: expectedLines[0] },
    ];
    return {
      hasDiff: true,
      isWhitespaceOnly,
      lines,
      rawDiffText: `- ${actualLines[0]}\n+ ${expectedLines[0]}`,
    };
  }

  // Multi-line line-level LCS
  // ponytail: cap at 300 lines to ensure instantaneous response (<5ms)
  const m = Math.min(actualLines.length, 300);
  const n = Math.min(expectedLines.length, 300);

  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (actualLines[i] === expectedLines[j]) dp[i + 1][j + 1] = dp[i][j] + 1;
      else dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  let i = m;
  let j = n;
  const rawOps = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && actualLines[i - 1] === expectedLines[j - 1]) {
      rawOps.unshift({ type: 'eq', line: actualLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawOps.unshift({ type: 'ins', line: expectedLines[j - 1] });
      j--;
    } else {
      rawOps.unshift({ type: 'del', line: actualLines[i - 1] });
      i--;
    }
  }

  // Pair up adjacent del and ins lines for intra-line token highlighting
  const lines = [];
  let idx = 0;
  while (idx < rawOps.length) {
    const curr = rawOps[idx];
    const next = rawOps[idx + 1];

    if (curr.type === 'del' && next && next.type === 'ins') {
      const { tokensA, tokensB } = tokenDiff(curr.line, next.line);
      lines.push({ type: 'del', prefix: '-', tokens: tokensA, text: curr.line });
      lines.push({ type: 'ins', prefix: '+', tokens: tokensB, text: next.line });
      idx += 2;
    } else if (curr.type === 'del') {
      lines.push({
        type: 'del',
        prefix: '-',
        tokens: [{ text: curr.line, isDiff: true }],
        text: curr.line,
      });
      idx++;
    } else if (curr.type === 'ins') {
      lines.push({
        type: 'ins',
        prefix: '+',
        tokens: [{ text: curr.line, isDiff: true }],
        text: curr.line,
      });
      idx++;
    } else {
      lines.push({
        type: 'eq',
        prefix: ' ',
        tokens: [{ text: curr.line, isDiff: false }],
        text: curr.line,
      });
      idx++;
    }
  }

  const rawDiffText = lines
    .map((l) => `${l.prefix} ${l.text}`)
    .join('\n');

  return {
    hasDiff: true,
    isWhitespaceOnly,
    lines,
    rawDiffText,
  };
}

/**
 * Extracts line-by-line diff tokens specifically for one side (actual or expected).
 * Used to render in-place diff highlights directly inside TestCaseBox.
 */
export function getBoxDiffTokens(content, diffWith, isExpected = false) {
  if (diffWith === undefined || diffWith === null) return null;
  const contentStr = content === null || content === undefined ? '' : String(content);
  const diffWithStr = String(diffWith);

  if (contentStr === diffWithStr) return null;

  const actualStr = isExpected ? diffWithStr : contentStr;
  const expectedStr = isExpected ? contentStr : diffWithStr;

  const diff = computeOutputDiff(actualStr, expectedStr);
  if (!diff.hasDiff) return null;

  const targetType = isExpected ? 'ins' : 'del';
  const relevantLines = diff.lines.filter((l) => l.type === 'eq' || l.type === targetType);

  return {
    isWhitespaceOnly: diff.isWhitespaceOnly,
    lines: relevantLines,
  };
}

