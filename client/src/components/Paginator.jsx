export default function Paginator({ page, total, limit, onPrev, onNext, loading }) {
  const totalPages = Math.ceil(total / limit) || 1;
  if (totalPages <= 1 && total <= limit) return null;
  return (
    <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-[#1e2a47] mt-4">
      <span className="font-mono">{total} total · page {page} of {totalPages}</span>
      <div className="flex gap-2">
        <button
          disabled={page <= 1 || loading}
          onClick={onPrev}
          className="px-3 py-1.5 rounded-xl border border-[#1e2a47] bg-[#11192e] hover:border-sky-500/60 disabled:opacity-40 disabled:cursor-not-allowed transition font-bold"
        >
          ← Prev
        </button>
        <button
          disabled={page >= totalPages || loading}
          onClick={onNext}
          className="px-3 py-1.5 rounded-xl border border-[#1e2a47] bg-[#11192e] hover:border-sky-500/60 disabled:opacity-40 disabled:cursor-not-allowed transition font-bold"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
