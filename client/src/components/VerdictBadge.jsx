const COLORS = {
  AC: 'bg-green-900 text-green-300 border-green-700',
  WA: 'bg-red-900 text-red-300 border-red-700',
  TLE: 'bg-yellow-900 text-yellow-300 border-yellow-700',
  MLE: 'bg-orange-900 text-orange-300 border-orange-700',
  RE: 'bg-purple-900 text-purple-300 border-purple-700',
  CE: 'bg-pink-900 text-pink-300 border-pink-700',
  Pending: 'bg-gray-800 text-gray-400 border-gray-600',
};

export default function VerdictBadge({ verdict }) {
  return (
    <span className={`px-2 py-0.5 text-xs font-mono font-semibold border rounded ${COLORS[verdict] || COLORS.Pending}`}>
      {verdict}
    </span>
  );
}
