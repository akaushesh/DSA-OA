const COLORS = {
  Easy: 'text-green-400',
  Medium: 'text-yellow-400',
  Hard: 'text-red-400',
};

export default function DifficultyChip({ difficulty }) {
  return <span className={`text-xs font-semibold ${COLORS[difficulty] || 'text-gray-400'}`}>{difficulty}</span>;
}
