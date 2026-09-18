import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getMyAttemptedTopics } from '../api/attempts';
import Navbar from '../components/Navbar';
import DifficultyChip from '../components/DifficultyChip';
import VerdictBadge from '../components/VerdictBadge';

export default function TopicWise() {
  const [data, setData] = useState({ topics: [], stats: {} });
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState('All');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'solved' | 'needs_practice' | 'skipped'
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    getMyAttemptedTopics()
      .then((res) => {
        const payload = res.data?.statusCode || {};
        setData({
          topics: payload.topics || [],
          stats: payload.stats || {},
        });
      })
      .catch((err) => {
        console.error('Failed to load topic analysis:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = data.stats || {};
  const allTopics = data.topics || [];

  // Filter topics and problems based on user selections
  const filteredTopics = useMemo(() => {
    return allTopics
      .filter((t) => selectedTopic === 'All' || t.name.toLowerCase() === selectedTopic.toLowerCase())
      .map((t) => {
        const filteredProblems = (t.problems || []).filter((p) => {
          // Status filter
          if (statusFilter === 'solved' && !p.isSolved) return false;
          if (statusFilter === 'needs_practice' && (!p.hasSubmissions || p.isSolved)) return false;
          if (statusFilter === 'skipped' && p.hasSubmissions) return false;

          // Search query
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchTitle = p.title?.toLowerCase().includes(q);
            const matchCategory = p.category?.toLowerCase().includes(q);
            const matchTags = Array.isArray(p.tags) && p.tags.some((tag) => tag.toLowerCase().includes(q));
            if (!matchTitle && !matchCategory && !matchTags) return false;
          }

          return true;
        });

        return {
          ...t,
          problems: filteredProblems,
        };
      })
      .filter((t) => t.problems.length > 0);
  }, [allTopics, selectedTopic, statusFilter, searchQuery]);

  const totalFilteredQuestions = filteredTopics.reduce((sum, t) => sum + t.problems.length, 0);

  return (
    <div className="min-h-screen bg-[#0b132b] text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Hero Section */}
        <div className="bg-[#11192e] border border-[#1e2a47] rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider bg-blue-950/80 text-blue-400 border border-blue-800/80 px-3 py-1 rounded-full">
                    Topic Performance & Review
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Topic-Wise Question Tracker
                </h1>
                <p className="text-slate-400 text-xs sm:text-sm mt-1.5 max-w-2xl leading-relaxed">
                  Review all questions encountered across your test attempts grouped by DSA topic.
                  Launch questions directly in practice mode or jump straight to the full test review.
                </p>
              </div>

              <Link
                to="/dashboard"
                className="self-start md:self-auto bg-[#18223a] hover:bg-[#223052] border border-[#26375c] text-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-2 shrink-0 shadow-md"
              >
                <span>←</span> Back to Dashboard
              </Link>
            </div>

            {/* Top KPI Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-[#1e2a47]">
              <div className="bg-[#0b132b]/70 border border-[#1e2a47] rounded-2xl p-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Topics Explored
                </span>
                <p className="text-2xl sm:text-3xl font-black text-white mt-1">
                  {stats.totalTopics || 0}
                </p>
                <span className="text-[11px] text-slate-500">DSA categories</span>
              </div>

              <div className="bg-[#0b132b]/70 border border-[#1e2a47] rounded-2xl p-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Questions
                </span>
                <p className="text-2xl sm:text-3xl font-black text-white mt-1">
                  {stats.totalQuestions || 0}
                </p>
                <span className="text-[11px] text-slate-500">encountered in tests</span>
              </div>

              <div className="bg-[#0b132b]/70 border border-[#1e2a47] rounded-2xl p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                  Solved (AC)
                </span>
                <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">
                  {stats.totalSolved || 0}
                </p>
                <span className="text-[11px] text-slate-500">mastered problems</span>
              </div>

              <div className="bg-[#0b132b]/70 border border-[#1e2a47] rounded-2xl p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">
                  Accuracy Rate
                </span>
                <p className="text-2xl sm:text-3xl font-black text-sky-400 mt-1">
                  {stats.overallAccuracy || 0}%
                </p>
                <span className="text-[11px] text-slate-500">pass ratio</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bar & Controls */}
        <div className="space-y-4">
          {/* Topic Pills Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            <button
              onClick={() => setSelectedTopic('All')}
              className={`text-xs font-bold px-4 py-2 rounded-xl transition shrink-0 flex items-center gap-2 ${
                selectedTopic === 'All'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                  : 'bg-[#11192e] text-slate-400 border border-[#1e2a47] hover:text-white hover:border-slate-500'
              }`}
            >
              <span>All Topics</span>
              <span className="text-[10px] bg-black/30 px-2 py-0.5 rounded-full">
                {stats.totalQuestions || 0}
              </span>
            </button>

            {allTopics.map((topic) => (
              <button
                key={topic.name}
                onClick={() => setSelectedTopic(topic.name)}
                className={`text-xs font-bold px-4 py-2 rounded-xl transition shrink-0 flex items-center gap-2 ${
                  selectedTopic === topic.name
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                    : 'bg-[#11192e] text-slate-400 border border-[#1e2a47] hover:text-white hover:border-slate-500'
                }`}
              >
                <span>{topic.name}</span>
                <span className="text-[10px] bg-black/30 px-2 py-0.5 rounded-full">
                  {topic.totalQuestions}
                </span>
              </button>
            ))}
          </div>

          {/* Secondary Controls: Status Filter & Search */}
          <div className="bg-[#11192e] border border-[#1e2a47] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Status Pills */}
            <div className="flex items-center gap-1.5 bg-[#080d1a] p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
              {[
                { key: 'all', label: 'All' },
                { key: 'solved', label: '✅ Solved (AC)' },
                { key: 'needs_practice', label: '⚠️ Needs Practice' },
                { key: 'skipped', label: '⏭️ Skipped in Test' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                    statusFilter === tab.key
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
              <input
                type="text"
                placeholder="Search problem or tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#080d1a] border border-[#223255] text-white placeholder-slate-500 text-xs font-medium pl-8 pr-8 py-2 rounded-xl focus:outline-none focus:border-blue-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content Section: Topics & Problems */}
        {loading ? (
          <div className="bg-[#11192e] border border-[#1e2a47] rounded-3xl p-16 text-center shadow-lg">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-300 text-sm font-semibold">Loading topic-wise attempted questions...</p>
          </div>
        ) : allTopics.length === 0 ? (
          /* Empty State: No attempts taken yet */
          <div className="bg-[#11192e] border border-[#1e2a47] rounded-3xl p-16 text-center shadow-lg max-w-lg mx-auto">
            <div className="text-4xl mb-3">🎯</div>
            <h3 className="text-lg font-bold text-white mb-2">No Attempted Questions Yet</h3>
            <p className="text-slate-400 text-xs sm:text-sm mb-6 leading-relaxed">
              You haven't completed any assessments yet. Choose an assessment set from the dashboard to start practicing and your topic mastery will appear here automatically!
            </p>
            <Link
              to="/dashboard"
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition inline-flex items-center gap-1.5 shadow-lg shadow-blue-900/40"
            >
              <span>⚡</span> Go to Practice Dashboard
            </Link>
          </div>
        ) : filteredTopics.length === 0 ? (
          /* Empty State: No questions match filters */
          <div className="bg-[#11192e] border border-[#1e2a47] rounded-3xl p-16 text-center shadow-lg max-w-md mx-auto">
            <div className="text-3xl mb-2">🔍</div>
            <h3 className="text-base font-bold text-white mb-1">No Matching Questions</h3>
            <p className="text-slate-400 text-xs mb-5">
              No questions match your selected topic, status, or search filters.
            </p>
            <button
              onClick={() => {
                setSelectedTopic('All');
                setStatusFilter('all');
                setSearchQuery('');
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          /* Topics and Grouped Problems */
          <div className="space-y-8">
            <div className="text-xs text-slate-400 font-mono">
              Showing <strong className="text-white">{totalFilteredQuestions}</strong> question{totalFilteredQuestions === 1 ? '' : 's'} across{' '}
              <strong className="text-white">{filteredTopics.length}</strong> topic{filteredTopics.length === 1 ? '' : 's'}
            </div>

            {filteredTopics.map((topic) => (
              <section key={topic.name} className="space-y-4">
                {/* Topic Header Bar */}
                <div className="flex items-center justify-between pb-2 border-b border-[#1e2a47]">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      {topic.name}
                    </h2>
                    <span className="text-[11px] font-semibold bg-[#16213b] text-blue-300 border border-[#24355c] px-2.5 py-0.5 rounded-full">
                      {topic.problems.length} Problem{topic.problems.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 font-mono hidden sm:flex items-center gap-3">
                    <span>
                      Solved: <strong className="text-emerald-400">{topic.solvedCount}</strong> / {topic.totalQuestions}
                    </span>
                    <span>•</span>
                    <span className="text-sky-300 font-bold">{topic.accuracyRate}% Accuracy</span>
                  </div>
                </div>

                {/* Problem Cards Grid */}
                <div className="grid grid-cols-1 gap-4">
                  {topic.problems.map((problem) => {
                    const attempts = problem.attempts || [];

                    return (
                      <div
                        key={problem._id}
                        className="bg-[#11192e] border border-[#1e2a47] hover:border-slate-600 rounded-2xl p-5 transition shadow-md flex flex-col gap-4"
                      >
                        {/* Problem Top Header: Title, Tags, Status & Practice Button */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                              <h3 className="text-white font-extrabold text-base tracking-tight truncate">
                                {problem.title}
                              </h3>
                              <DifficultyChip difficulty={problem.difficulty} />
                              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-sky-950/70 text-sky-300 border border-sky-800/70">
                                {problem.category}
                              </span>

                              {/* Overall Status Badge */}
                              {problem.isSolved ? (
                                <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-600 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                                  <span>✓</span> Solved AC
                                </span>
                              ) : problem.hasSubmissions ? (
                                <span className="bg-amber-950/80 text-amber-300 border border-amber-600 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                                  <span>⚠️</span> Attempted ({problem.bestVerdict})
                                </span>
                              ) : (
                                <span className="bg-slate-800/80 text-slate-300 border border-slate-700 text-[10px] font-semibold uppercase px-2.5 py-0.5 rounded-full">
                                  Unattempted in test
                                </span>
                              )}
                            </div>

                            {/* Tags list */}
                            {problem.tags && problem.tags.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                {problem.tags.map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="text-[10px] text-slate-400 bg-[#080d1a] border border-[#213152] px-2 py-0.5 rounded-md font-mono"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* ACTION 1: Open in Practice Mode Directly */}
                          <div className="flex items-center gap-2 shrink-0">
                            <Link
                              to={`/practice/${problem._id}`}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-emerald-950/40 active:scale-95"
                              title="Open problem in Practice Coding Arena"
                            >
                              <span>💻</span> Practice in Editor →
                            </Link>
                          </div>
                        </div>

                        {/* ACTION 2: Associated Test Attempts List */}
                        <div className="bg-[#080d1a]/80 border border-[#1a253f] rounded-xl p-3.5 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                              <span>📋</span> Appeared in {attempts.length} Test Attempt{attempts.length === 1 ? '' : 's'}:
                            </span>
                            {problem.bestScore > 0 && (
                              <span className="text-xs font-mono font-bold text-amber-300">
                                Best Score: {problem.bestScore} pts
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                            {attempts.map((att, attIdx) => {
                              const isAttAC = att.verdict === 'AC';
                              const isAttSkipped = att.verdict === 'Unattempted';

                              return (
                                <div
                                  key={att.attemptId || attIdx}
                                  className="bg-[#11192e] border border-[#1f2c4b] hover:border-blue-500/50 rounded-xl p-3 flex flex-col justify-between gap-2.5 transition group/att"
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                      <h4 className="text-white font-bold text-xs truncate group-hover/att:text-blue-300 transition">
                                        {att.questionSetName}
                                      </h4>
                                      <span
                                        className={`text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded ${
                                          isAttAC
                                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                                            : isAttSkipped
                                            ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                            : 'bg-rose-950 text-rose-300 border border-rose-600'
                                        }`}
                                      >
                                        {att.verdict}
                                      </span>
                                    </div>

                                    <div className="text-[11px] text-slate-400 font-mono space-y-0.5">
                                      <p>Score: <strong className="text-amber-300">{att.score} pts</strong></p>
                                      <p className="text-[10px] text-slate-500">
                                        {new Date(att.startedAt).toLocaleDateString()} at{' '}
                                        {new Date(att.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Link to Test Review of this Attempt */}
                                  <Link
                                    to={`/review/${att.attemptId}`}
                                    className="text-xs bg-[#18233a] hover:bg-blue-600 text-slate-300 hover:text-white font-bold py-1.5 px-3 rounded-lg border border-[#27385c] hover:border-blue-500 transition text-center flex items-center justify-center gap-1 shadow-sm"
                                  >
                                    <span>📊</span> Review Attempt →
                                  </Link>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
