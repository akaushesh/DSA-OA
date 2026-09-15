/**
 * Truncates long test case or output text while providing metadata for toggle expansion.
 */
export function truncateTestCaseText(text, { maxChars = 250, maxLines = 6 } = {}) {
  if (!text || typeof text !== 'string') {
    return { isTruncated: false, displayText: '', remainingLines: 0, remainingChars: 0 };
  }

  const lines = text.split('\n');
  const exceedsLines = lines.length > maxLines;
  const exceedsChars = text.length > maxChars;

  if (!exceedsLines && !exceedsChars) {
    return { isTruncated: false, displayText: text, remainingLines: 0, remainingChars: 0 };
  }

  if (exceedsLines) {
    const firstLines = lines.slice(0, maxLines).join('\n');
    const displaySnippet = firstLines.length > maxChars ? firstLines.slice(0, maxChars) : firstLines;
    const remainingLines = lines.length - maxLines;
    const remainingChars = Math.max(0, text.length - displaySnippet.length);
    return {
      isTruncated: true,
      displayText: displaySnippet,
      remainingLines,
      remainingChars,
    };
  }

  return {
    isTruncated: true,
    displayText: text.slice(0, maxChars),
    remainingLines: 0,
    remainingChars: text.length - maxChars,
  };
}
