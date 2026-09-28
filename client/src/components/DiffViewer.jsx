import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { computeOutputDiff } from '../utils/diffUtils';

/**
 * Visual color-coded diff component similar to LeetCode's diff viewer.
 * Highlights line-level additions/deletions and character/word-level token differences.
 */
export default function DiffViewer({
  actual = '',
  expected = '',
  label = 'Difference (Diff View):',
  bgClass = 'bg-[#050811]',
  borderClass = 'border-[#18233c]',
  maxInitialLines = 14,
}) {
  const [viewMode, setViewMode] = useState('unified'); // 'unified' | 'split'
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const diff = useMemo(() => computeOutputDiff(actual, expected), [actual, expected]);

  if (!diff.hasDiff) return null;

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(diff.rawDiffText);
      setCopied(true);
      toast.success('Copied diff to clipboard', { duration: 1500 });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Failed to copy diff');
    }
  };

  const visibleLines = isExpanded || diff.lines.length <= maxInitialLines
    ? diff.lines
    : diff.lines.slice(0, maxInitialLines);
  const hiddenCount = diff.lines.length - visibleLines.length;

  // Helper to render tokens with diff highlights and visible whitespace indicators
  const renderTokens = (tokens, isDeletion) => {
    return tokens.map((tok, idx) => {
      if (!tok.isDiff) {
        return <span key={idx}>{tok.text}</span>;
      }

      // If the differing token is purely whitespace, show visible symbols
      const display = tok.text
        .replace(/ /g, '␣')
        .replace(/\t/g, '⇥');

      return (
        <mark
          key={idx}
          className={`px-0.5 rounded font-bold transition-colors select-text ${
            isDeletion
              ? 'bg-rose-500/40 text-rose-100 ring-1 ring-rose-500/60'
              : 'bg-emerald-500/40 text-emerald-100 ring-1 ring-emerald-500/60'
          }`}
          title={isDeletion ? 'Mismatched output (unexpected)' : 'Expected in output'}
        >
          {display}
        </mark>
      );
    });
  };

  return (
    <div className={`p-3 rounded-xl border text-xs font-mono transition-all ${bgClass} ${borderClass}`}>
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-sans font-bold text-[11px] text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
            <span>⇄</span> {label}
          </span>
          {diff.isWhitespaceOnly && (
            <span className="text-[10px] px-2 py-0.5 rounded border bg-amber-950/60 border-amber-700/80 text-amber-300 font-sans font-semibold">
              ⚠️ Whitespace / Newline Difference
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 font-sans text-[10px]">
          {/* Mode Switcher */}
          <div className="flex items-center bg-[#11192e] border border-[#243455] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('unified')}
              className={`px-2 py-0.5 rounded font-semibold transition cursor-pointer ${
                viewMode === 'unified'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Unified
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-2 py-0.5 rounded font-semibold transition cursor-pointer ${
                viewMode === 'split'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Split
            </button>
          </div>

          {/* Copy Diff Button */}
          <button
            type="button"
            onClick={handleCopy}
            title="Copy diff to clipboard"
            className="text-slate-400 hover:text-white bg-[#11192e] hover:bg-[#1a2642] border border-[#243455] px-2 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer select-none"
          >
            <span>{copied ? '✓' : '📋'}</span>
            <span>{copied ? 'Copied' : 'Copy Diff'}</span>
          </button>
        </div>
      </div>

      {/* UNIFIED DIFF VIEW */}
      {viewMode === 'unified' && (
        <div className="bg-[#080d1a] border border-[#1b2744] rounded-lg overflow-x-auto divide-y divide-[#1b2744]/40">
          {visibleLines.map((line, lIdx) => {
            const isDel = line.type === 'del';
            const isIns = line.type === 'ins';

            let lineBg = 'text-slate-400 opacity-90';
            let prefixColor = 'text-slate-600';
            if (isDel) {
              lineBg = 'bg-rose-950/25 text-rose-200 border-l-2 border-rose-500';
              prefixColor = 'text-rose-400 font-bold';
            } else if (isIns) {
              lineBg = 'bg-emerald-950/25 text-emerald-200 border-l-2 border-emerald-500';
              prefixColor = 'text-emerald-400 font-bold';
            }

            return (
              <div
                key={lIdx}
                className={`flex items-start gap-2 px-3 py-1 text-xs leading-relaxed font-mono ${lineBg}`}
              >
                <span className={`w-4 text-center select-none flex-shrink-0 ${prefixColor}`}>
                  {line.prefix}
                </span>
                <span className="whitespace-pre-wrap break-all flex-1">
                  {renderTokens(line.tokens, isDel)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* SPLIT / SIDE-BY-SIDE DIFF VIEW */}
      {viewMode === 'split' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {/* Left: Actual Output (Your Output) */}
          <div className="bg-[#080d1a] border border-rose-900/40 rounded-lg p-2.5 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-rose-400 font-bold font-sans uppercase border-b border-rose-950/60 pb-1 mb-1.5">
              <span>- Your Output (Actual)</span>
            </div>
            <div className="whitespace-pre-wrap break-all text-xs text-rose-200 leading-relaxed max-h-60 overflow-y-auto">
              {diff.lines
                .filter((l) => l.type === 'del' || l.type === 'eq')
                .map((line, idx) => (
                  <div
                    key={idx}
                    className={`px-1 py-0.5 rounded ${
                      line.type === 'del' ? 'bg-rose-950/30' : 'text-slate-400 opacity-80'
                    }`}
                  >
                    {renderTokens(line.tokens, true)}
                  </div>
                ))}
            </div>
          </div>

          {/* Right: Expected Output */}
          <div className="bg-[#080d1a] border border-emerald-900/40 rounded-lg p-2.5 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold font-sans uppercase border-b border-emerald-950/60 pb-1 mb-1.5">
              <span>+ Expected Output</span>
            </div>
            <div className="whitespace-pre-wrap break-all text-xs text-emerald-200 leading-relaxed max-h-60 overflow-y-auto">
              {diff.lines
                .filter((l) => l.type === 'ins' || l.type === 'eq')
                .map((line, idx) => (
                  <div
                    key={idx}
                    className={`px-1 py-0.5 rounded ${
                      line.type === 'ins' ? 'bg-emerald-950/30' : 'text-slate-400 opacity-80'
                    }`}
                  >
                    {renderTokens(line.tokens, false)}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Truncation / Show More Toggle */}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[10px] font-sans font-semibold text-sky-400 hover:text-sky-300 mt-2 inline-flex items-center gap-1 cursor-pointer"
        >
          <span>
            {isExpanded ? '▴ Show less lines' : `▾ Show all lines (+${hiddenCount} more)`}
          </span>
        </button>
      )}
    </div>
  );
}
