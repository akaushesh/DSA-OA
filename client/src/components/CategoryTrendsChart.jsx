import { useState, useMemo } from 'react';
import { aggregateCategoryStats, computeRecentTrends } from '../utils/trends';

// Category color palettes for consistent badges and chart accents
const CATEGORY_COLORS = {
  Arrays: { stroke: '#38bdf8', fill: 'rgba(56, 189, 248, 0.25)', bg: 'bg-sky-500/20', text: 'text-sky-400', border: 'border-sky-500/40' },
  DP: { stroke: '#a855f7', fill: 'rgba(168, 85, 247, 0.25)', bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/40' },
  Graphs: { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.25)', bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/40' },
  Strings: { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.25)', bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/40' },
  Trees: { stroke: '#06b6d4', fill: 'rgba(6, 182, 212, 0.25)', bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/40' },
  Sorting: { stroke: '#ec4899', fill: 'rgba(236, 72, 153, 0.25)', bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/40' },
  Math: { stroke: '#8b5cf6', fill: 'rgba(139, 92, 246, 0.25)', bg: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/40' },
  Backtracking: { stroke: '#f43f5e', fill: 'rgba(244, 63, 94, 0.25)', bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/40' },
  General: { stroke: '#6366f1', fill: 'rgba(99, 102, 241, 0.25)', bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/40' },
};

const DEFAULT_COLOR = { stroke: '#38bdf8', fill: 'rgba(56, 189, 248, 0.25)', bg: 'bg-sky-500/20', text: 'text-sky-400', border: 'border-sky-500/40' };

function getCategoryColor(cat) {
  return CATEGORY_COLORS[cat] || DEFAULT_COLOR;
}

export default function CategoryTrendsChart({
  attempts = [],
  isAdmin = false,
  title = 'Performance Trends & Category Analytics',
  subtitle = 'Track recent test score trajectory and skill proficiency across DSA categories',
}) {
  // Filters & display state
  // ponytail: SVG linear interpolation on the last 15 sorted attempts; upgrade to paginated time-series aggregation if attempt volume > 10k
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedUser, setSelectedUser] = useState('all');
  const [metricMode, setMetricMode] = useState('percent'); // 'percent' | 'points'
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Extract unique users if in admin mode
  const uniqueUsers = useMemo(() => {
    if (!isAdmin) return [];
    const map = new Map();
    attempts.forEach(a => {
      if (a.userId?._id) {
        map.set(String(a.userId._id), a.userId.username || a.userId.fullName || 'User');
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [attempts, isAdmin]);

  // Filter attempts by selected user (admin mode)
  const userFilteredAttempts = useMemo(() => {
    if (!isAdmin || selectedUser === 'all') return attempts;
    return attempts.filter(a => String(a.userId?._id || a.userId) === selectedUser);
  }, [attempts, isAdmin, selectedUser]);

  // Extract all categories present
  const availableCategories = useMemo(() => {
    const set = new Set();
    userFilteredAttempts.forEach(a => {
      const cat = a.questionSetId?.category?.trim();
      if (cat) set.add(cat);
    });
    return ['All', ...Array.from(set).sort()];
  }, [userFilteredAttempts]);

  // Category Breakdown Aggregations across all filtered attempts
  const categoryStats = useMemo(() => {
    return aggregateCategoryStats(userFilteredAttempts);
  }, [userFilteredAttempts]);

  // Attempts filtered for the trend chart (chronologically sorted, last 15)
  const trendAttempts = useMemo(() => {
    return computeRecentTrends(userFilteredAttempts, { category: selectedCategory, limit: 15 });
  }, [userFilteredAttempts, selectedCategory]);

  // Overall summary metrics
  const summary = useMemo(() => {
    if (!trendAttempts.length) return null;
    let totalScore = 0;
    let totalMax = 0;
    let bestPct = 0;
    let sumPct = 0;

    trendAttempts.forEach(a => {
      const s = Number(a.score || 0);
      const m = Number(a.maxPossibleScore || 0);
      const pct = m > 0 ? Math.round((s / m) * 100) : (s > 0 ? Math.min(100, s) : 0);
      totalScore += s;
      totalMax += m;
      sumPct += pct;
      if (pct > bestPct) bestPct = pct;
    });

    return {
      count: trendAttempts.length,
      avgPct: Math.round(sumPct / trendAttempts.length),
      bestPct,
      totalPoints: totalScore,
    };
  }, [trendAttempts]);

  // SVG Chart Geometry
  const svgWidth = 800;
  const svgHeight = 220;
  const padLeft = 45;
  const padRight = 35;
  const padTop = 25;
  const padBottom = 35;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  // Compute points on SVG coordinate space
  const chartPoints = useMemo(() => {
    if (!trendAttempts.length) return [];

    const maxVal = metricMode === 'percent'
      ? 100
      : Math.max(...trendAttempts.map(a => Number(a.maxPossibleScore || 100)), 100);

    return trendAttempts.map((a, i) => {
      const score = Number(a.score || 0);
      const maxScore = Number(a.maxPossibleScore || 0);
      const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : (score > 0 ? Math.min(100, score) : 0);
      const val = metricMode === 'percent' ? pct : score;

      const x = trendAttempts.length === 1
        ? padLeft + plotWidth / 2
        : padLeft + (i / (trendAttempts.length - 1)) * plotWidth;

      const norm = Math.max(0, Math.min(1, maxVal > 0 ? val / maxVal : 0));
      const y = padTop + (1 - norm) * plotHeight;

      const dateStr = a.startedAt || a.createdAt;
      const dateLabel = dateStr
        ? new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : `#${i + 1}`;

      const cat = a.questionSetId?.category?.trim() || 'General';

      return {
        x,
        y,
        val,
        pct,
        score,
        maxScore,
        dateLabel,
        dateFull: dateStr ? new Date(dateStr).toLocaleString() : 'N/A',
        name: a.questionSetId?.name || 'Assessment',
        category: cat,
        status: a.status,
        userName: a.userId?.username || a.userId?.fullName || 'Student',
        userEmail: a.userId?.email || '',
        id: a._id,
      };
    });
  }, [trendAttempts, metricMode, plotWidth, plotHeight]);

  // Construct SVG Path
  const linePath = useMemo(() => {
    if (chartPoints.length === 0) return '';
    if (chartPoints.length === 1) return `M ${chartPoints[0].x} ${chartPoints[0].y}`;
    return chartPoints.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');
  }, [chartPoints]);

  const areaPath = useMemo(() => {
    if (chartPoints.length < 2) return '';
    const bottomY = padTop + plotHeight;
    const firstX = chartPoints[0].x;
    const lastX = chartPoints[chartPoints.length - 1].x;
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [chartPoints, linePath, plotHeight]);

  const activeColor = getCategoryColor(selectedCategory);

  return (
    <div className="bg-[#11192e] border border-[#1e2a47] rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
      {/* HEADER & FILTERS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#1e2a47] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 text-sm">
              📈
            </span>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
              {title}
            </h2>
          </div>
          <p className="text-slate-400 text-xs md:text-sm mt-1">
            {subtitle}
          </p>
        </div>

        {/* Controls: Admin User Filter, Category Pills, Metric Toggle */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Admin User Filter */}
          {isAdmin && uniqueUsers.length > 0 && (
            <div className="relative">
              <select
                value={selectedUser}
                onChange={e => setSelectedUser(e.target.value)}
                className="bg-[#0b132b] border border-[#233558] text-slate-200 text-xs font-semibold rounded-xl px-3 py-2 pr-8 focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
              >
                <option value="all">👥 All Students ({uniqueUsers.length})</option>
                {uniqueUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    👤 {u.name}
                  </option>
                ))}
              </select>
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[10px] text-slate-400">
                ▼
              </span>
            </div>
          )}

          {/* Metric Toggle */}
          <div className="inline-flex rounded-xl bg-[#0b132b] border border-[#1e2a47] p-0.5 text-xs font-semibold">
            <button
              onClick={() => setMetricMode('percent')}
              className={`px-3 py-1.5 rounded-lg transition ${
                metricMode === 'percent'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Score %
            </button>
            <button
              onClick={() => setMetricMode('points')}
              className={`px-3 py-1.5 rounded-lg transition ${
                metricMode === 'points'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Points
            </button>
          </div>
        </div>
      </div>

      {/* CATEGORY TABS ROW */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider mr-1 flex-shrink-0">
          Category:
        </span>
        {availableCategories.map(cat => {
          const isActive = selectedCategory.toLowerCase() === cat.toLowerCase();
          const col = getCategoryColor(cat);
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1.5 border ${
                isActive
                  ? `${col.bg} ${col.text} ${col.border} ring-1 ring-white/20 shadow-md`
                  : 'bg-[#0b132b] text-slate-400 border-[#1e2a47] hover:border-slate-600 hover:text-slate-200'
              }`}
            >
              <span>{cat === 'All' ? '⚡' : '🏷️'}</span>
              <span>{cat}</span>
            </button>
          );
        })}
      </div>

      {/* QUICK SUMMARY CARDS */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#0b132b]/80 border border-[#1e2a47] rounded-xl p-3.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Tests Shown
            </span>
            <p className="text-xl font-black text-white mt-0.5">{summary.count}</p>
          </div>
          <div className="bg-[#0b132b]/80 border border-[#1e2a47] rounded-xl p-3.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Avg Score
            </span>
            <p className="text-xl font-black text-sky-400 mt-0.5">{summary.avgPct}%</p>
          </div>
          <div className="bg-[#0b132b]/80 border border-[#1e2a47] rounded-xl p-3.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Peak Score
            </span>
            <p className="text-xl font-black text-emerald-400 mt-0.5">{summary.bestPct}%</p>
          </div>
          <div className="bg-[#0b132b]/80 border border-[#1e2a47] rounded-xl p-3.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Points Earned
            </span>
            <p className="text-xl font-black text-amber-400 mt-0.5">{summary.totalPoints}</p>
          </div>
        </div>
      )}

      {/* MAIN CHART CONTAINER */}
      <div className="relative bg-[#080e1e] border border-[#1b2742] rounded-2xl p-4 md:p-6 overflow-hidden">
        {chartPoints.length === 0 ? (
          <div className="py-16 text-center">
            <span className="text-4xl block mb-2">📊</span>
            <h3 className="text-slate-200 font-bold text-sm md:text-base">
              No recent attempts found for {selectedCategory === 'All' ? 'this filter' : `the "${selectedCategory}" category`}
            </h3>
            <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto">
              Attempt practice sets or complete assessments in this topic to populate your performance trendline.
            </p>
          </div>
        ) : (
          <div className="relative">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-48 md:h-64 overflow-visible"
            >
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={activeColor.stroke} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={activeColor.stroke} stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Gridlines & Y-axis labels */}
              {[0, 25, 50, 75, 100].map(pct => {
                const y = padTop + (1 - pct / 100) * plotHeight;
                return (
                  <g key={pct}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={padLeft + plotWidth}
                      y2={y}
                      stroke="#1e2a47"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                    <text
                      x={padLeft - 10}
                      y={y + 4}
                      textAnchor="end"
                      fill="#64748b"
                      fontSize="10"
                      fontWeight="600"
                    >
                      {pct}{metricMode === 'percent' ? '%' : ''}
                    </text>
                  </g>
                );
              })}

              {/* Area fill */}
              {areaPath && (
                <path d={areaPath} fill="url(#trendGradient)" />
              )}

              {/* Line path */}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke={activeColor.stroke}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Hover Crosshair vertical guide */}
              {hoveredPoint && (
                <line
                  x1={hoveredPoint.x}
                  y1={padTop}
                  x2={hoveredPoint.x}
                  y2={padTop + plotHeight}
                  stroke="#475569"
                  strokeDasharray="3 3"
                  strokeWidth="1.5"
                />
              )}

              {/* Data Points */}
              {chartPoints.map((p, i) => {
                const isHovered = hoveredPoint?.id === p.id;
                const pointCol = getCategoryColor(p.category);
                return (
                  <g key={p.id || i} className="cursor-pointer">
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? 8 : 5}
                      fill="#0b132b"
                      stroke={pointCol.stroke}
                      strokeWidth={isHovered ? 3.5 : 2.5}
                      onMouseEnter={() => setHoveredPoint(p)}
                      onMouseLeave={() => setHoveredPoint(null)}
                      className="transition-all duration-150"
                    />
                    {/* X-axis date label */}
                    <text
                      x={p.x}
                      y={padTop + plotHeight + 20}
                      textAnchor="middle"
                      fill={isHovered ? '#f8fafc' : '#64748b'}
                      fontSize="10"
                      fontWeight={isHovered ? '700' : '500'}
                    >
                      {p.dateLabel}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* FLOATING HOVER TOOLTIP */}
            {hoveredPoint && (
              <div
                className="absolute z-20 pointer-events-none bg-[#0f172a]/95 backdrop-blur border border-slate-700 shadow-2xl rounded-xl p-3 text-xs w-56 transform -translate-x-1/2 -translate-y-full transition-all"
                style={{
                  left: `${(hoveredPoint.x / svgWidth) * 100}%`,
                  top: `${(hoveredPoint.y / svgHeight) * 100}%`,
                  marginTop: '-14px',
                }}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getCategoryColor(hoveredPoint.category).bg} ${getCategoryColor(hoveredPoint.category).text} ${getCategoryColor(hoveredPoint.category).border}`}
                  >
                    {hoveredPoint.category}
                  </span>
                  <span className="text-[10px] text-slate-400">{hoveredPoint.dateLabel}</span>
                </div>

                <p className="font-bold text-white truncate text-xs" title={hoveredPoint.name}>
                  {hoveredPoint.name}
                </p>

                {isAdmin && (
                  <p className="text-[11px] text-purple-300 font-semibold mt-0.5 truncate">
                    Candidate: {hoveredPoint.userName}
                  </p>
                )}

                <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400 text-[11px]">Score:</span>
                  <span className="font-black text-sky-400 text-xs">
                    {hoveredPoint.score} / {hoveredPoint.maxScore} ({hoveredPoint.pct}%)
                  </span>
                </div>

                <div className="mt-1 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Status:</span>
                  <span className={hoveredPoint.status === 'completed' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                    {hoveredPoint.status}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CATEGORY PROFICIENCY & BREAKDOWN SECTION */}
      {categoryStats.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-200 tracking-wide uppercase flex items-center gap-2">
              <span>🎯</span> Category Breakdown & Performance
            </h3>
            <span className="text-xs text-slate-400">
              Click a category to focus chart
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categoryStats.map(item => {
              const col = getCategoryColor(item.name);
              const isSelected = selectedCategory.toLowerCase() === item.name.toLowerCase();

              return (
                <div
                  key={item.name}
                  onClick={() => setSelectedCategory(isSelected ? 'All' : item.name)}
                  className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? `${col.bg} ${col.border} ring-2 ring-white/20 shadow-lg`
                      : 'bg-[#0b132b] border-[#1e2a47] hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${col.bg} ${col.text} ${col.border}`}>
                      {item.name}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">
                      {item.totalAttempts} {item.totalAttempts === 1 ? 'test' : 'tests'}
                    </span>
                  </div>

                  {/* Progress Bar for Avg Score % */}
                  <div className="space-y-1.5 mt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">Avg Score</span>
                      <span className="font-bold text-white">{item.avgPct}%</span>
                    </div>
                    <div className="w-full bg-[#1b2742] h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(4, Math.min(100, item.avgPct))}%`,
                          backgroundColor: col.stroke,
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-2 border-t border-[#1e2a47]/60">
                    <span>Peak: <strong className="text-emerald-400">{item.bestPct}%</strong></span>
                    <span>Completed: <strong className="text-slate-200">{item.completedCount}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
