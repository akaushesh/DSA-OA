import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { truncateTestCaseText } from '../utils/textUtils';

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
}) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const text = content !== null && content !== undefined ? String(content) : '';
  const hasContent = text.trim().length > 0;

  const { isTruncated, displayText, remainingLines, remainingChars } = useMemo(() => {
    return truncateTestCaseText(text, { maxChars, maxLines });
  }, [text, maxChars, maxLines]);

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

  return (
    <div className={`p-2.5 rounded-lg font-mono text-xs border ${bgClass} ${borderClass}`}>
      {/* Header with Label & Top-Right Copy Button */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className={`${labelColorClass} font-sans block text-[11px] font-semibold`}>
          {label}
        </span>
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
            {isTruncated && !isExpanded ? (
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
