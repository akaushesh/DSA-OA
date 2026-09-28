import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { truncateTestCaseText } from '../utils/textUtils';
import { getBoxDiffTokens } from '../utils/diffUtils';

export default function TestCaseBox({
  label,
  content,
  emptyPlaceholder = '<empty>',
  colorClass = 'text-slate-200',
  labelColorClass = 'text-slate-400',
  toggleColorClass = 'text-sky-400 hover:text-sky-300',
  bgClass = 'bg-[#050811]',
  borderClass = 'border-[#18233c]',
  maxChars = 250,
  maxLines = 6,
  copyLabel = 'Copied to clipboard',
  diffWith,
  isDiffExpected = false,
}) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const text = content !== null && content !== undefined ? String(content) : '';
  const hasContent = text.trim().length > 0;

  // Compute in-box diff tokens if diffWith is provided
  const boxDiff = useMemo(() => {
    if (!hasContent || diffWith === undefined || diffWith === null) return null;
    return getBoxDiffTokens(text, diffWith, isDiffExpected);
  }, [text, diffWith, isDiffExpected, hasContent]);

  // Truncation calculations for plain text or diff lines
  const { isTruncated, displayText, remainingLines, remainingChars } = useMemo(() => {
    if (boxDiff && boxDiff.lines) {
      if (boxDiff.lines.length > maxLines) {
        return {
          isTruncated: true,
          displayText: '',
          remainingLines: boxDiff.lines.length - maxLines,
          remainingChars: 0,
        };
      }
      return { isTruncated: false, displayText: '', remainingLines: 0, remainingChars: 0 };
    }
    return truncateTestCaseText(text, { maxChars, maxLines });
  }, [boxDiff, text, maxChars, maxLines]);

  const handleCopy = async (e) => {
    e.stopPropagation();
    if (!hasContent) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(copyLabel, { duration: 1500 });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Failed to copy');
    }
  };

  // Helper to render diff tokens for a line
  const renderTokens = (tokens) => {
    return tokens.map((tok, idx) => {
      if (!tok.isDiff) {
        return <span key={idx}>{tok.text}</span>;
      }
      const isWhitespace = /^\s+$/.test(tok.text);
      const display = isWhitespace ? tok.text.replace(/ /g, '␣').replace(/\t/g, '⇥') : tok.text;
      return (
        <mark
          key={idx}
          className={`px-0.5 rounded font-bold transition-colors select-text ${
            isDiffExpected
              ? 'bg-emerald-500/35 text-emerald-100 ring-1 ring-emerald-500/60'
              : 'bg-rose-500/35 text-rose-100 ring-1 ring-rose-500/60'
          }`}
          title={isDiffExpected ? 'Expected character' : 'Mismatched character'}
        >
          {display}
        </mark>
      );
    });
  };

  return (
    <div className={`p-2.5 rounded-lg font-mono text-xs border ${bgClass} ${borderClass}`}>
      {/* Header with Label, Badges & Copy Button */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`${labelColorClass} font-sans block text-[11px] font-semibold`}>
            {label}
          </span>
          {boxDiff?.isWhitespaceOnly && (
            <span className="text-[10px] px-1.5 py-0.2 rounded border bg-amber-950/60 border-amber-700/80 text-amber-300 font-sans font-semibold">
              ⚠️ whitespace mismatch
            </span>
          )}
        </div>
        {hasContent && (
          <button
            type="button"
            onClick={handleCopy}
            title={`Copy ${label.replace(':', '')}`}
            className="text-[10px] text-slate-400 hover:text-white bg-[#11192e] hover:bg-[#1a2642] border border-[#243455] px-2 py-0.5 rounded transition flex items-center gap-1 cursor-pointer select-none"
          >
            <span>{copied ? '✓' : '📋'}</span>
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        )}
      </div>

      {/* Content Area */}
      {!hasContent ? (
        <pre className="text-slate-500 italic font-mono text-xs">{emptyPlaceholder}</pre>
      ) : (
        <div>
          <pre
            className={`whitespace-pre-wrap font-mono text-xs overflow-x-auto leading-relaxed break-all ${
              isExpanded ? 'max-h-72 overflow-y-auto custom-scrollbar' : ''
            } ${colorClass}`}
          >
            {boxDiff ? (
              // In-box diff rendering with token highlights
              (isExpanded || !isTruncated
                ? boxDiff.lines
                : boxDiff.lines.slice(0, maxLines)
              ).map((line, lIdx, arr) => (
                <span key={lIdx}>
                  {renderTokens(line.tokens)}
                  {lIdx < arr.length - 1 ? '\n' : ''}
                </span>
              ))
            ) : isTruncated && !isExpanded ? (
              <>
                {displayText}{' '}
                <span className="text-slate-500 italic text-[11px] font-normal">
                  ... (truncated)
                </span>
              </>
            ) : (
              text
            )}
          </pre>

          {/* Truncation Toggle */}
          {isTruncated && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={`text-[10px] font-sans font-semibold mt-1.5 inline-flex items-center gap-1 cursor-pointer ${toggleColorClass}`}
            >
              <span>
                {isExpanded
                  ? '▴ Show less'
                  : `▾ Show more (${remainingLines > 0 ? `+${remainingLines} lines` : `+${remainingChars} chars`})`}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
