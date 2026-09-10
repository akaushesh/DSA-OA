import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getQuestionSets } from '../api/questionsets';
import { myAttempts } from '../api/attempts';
import Navbar from '../components/Navbar';
import Loader from '../components/Loader';
import VerdictBadge from '../components/VerdictBadge';
import CategoryTrendsChart from '../components/CategoryTrendsChart';

const CATEGORIES = ['All', 'General', 'Graphs', 'Arrays', 'Strings', 'Trees', 'DP', 'Greedy', 'Sorting', 'Math', 'Backtracking'];

export default function Dashboard() {
  const [sets, setSets] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [tabFilter, setTabFilter] = useState('all'); // 'all' | 'my'
  const navigate = useNavigate();

  const { userData } = useSelector(s => s.auth);
  const role = useSelector(s => s.role?.role || s.auth?.userData?.role);
  const username = userData?.username || userData?.fullName || 'Learner';

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getQuestionSets({ limit: 100 }),
      myAttempts({ limit: 100 }),
    ])
      .then(([setsRes, attemptsRes]) => {
        const atts = attemptsRes.data.statusCode?.attempts || [];
        setSets(setsRes.data.statusCode?.sets || []);
        setAttempts(atts);

        // If user is a student and has an ongoing test in progress, always redirect to it
        if (role !== 'admin') {
          const ongoing = atts.find(a => a.status === 'in_progress');
          if (ongoing) {
            const firstProb =
              ongoing.questionSetId?.problems?.[0]?._id ||
              ongoing.questionSetId?.problems?.[0] ||
              '';
            toast('You have an active test in progress. Redirecting...', { icon: '⚡' });
            navigate(`/attempt/${ongoing._id}/problem/${firstProb}`, { replace: true });
            return;
          }
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  // Filtered Question Sets
  const filteredSets = useMemo(() => {
    return sets.filter(s => {
      const matchCategory = category === 'All' || s.category?.toLowerCase() === category.toLowerCase();
      const matchSearch = !searchQuery.trim() ||
        s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.category?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchTab = tabFilter === 'all' || (tabFilter === 'my' && s.createdBy === userData?._id);
      return matchCategory && matchSearch && matchTab;
    });
  }, [sets, category, searchQuery, tabFilter, userData]);

  // Filtered Attempts
  const filteredAttempts = useMemo(() => {
    return attempts.filter(a => {
      const setInfo = a.questionSetId;
      const matchCategory = category === 'All' || setInfo?.category?.toLowerCase() === category.toLowerCase();
      const matchSearch = !searchQuery.trim() ||
        setInfo?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        setInfo?.category?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [attempts, category, searchQuery]);

  // Metrics Calculation
  const totalAttemptsCount = attempts.length;
  const completedAttemptsCount = attempts.filter(a => a.status === 'completed').length;
  const accuracyPercentage = useMemo(() => {
    let totalSubs = 0;
    let acSubs = 0;
    attempts.forEach(a => {
      if (a.submissions) {
        a.submissions.forEach(sub => {
          totalSubs++;
          if (sub.verdict === 'AC') acSubs++;
        });
      }
    });
    return totalSubs > 0 ? Math.round((acSubs / totalSubs) * 100) : 0;
  }, [attempts]);

  const handlePickRandom = () => {
    if (!filteredSets.length) return;
    const randomIndex = Math.floor(Math.random() * filteredSets.length);
    const randomSet = filteredSets[randomIndex];
    navigate(`/sets/${randomSet._id}`);
  };

  const myUploadsCount = sets.filter(s => s.createdBy === userData?._id).length;

  return (
    <div className="min-h-screen bg-[#0b132b] text-slate-100 font-sans pb-16">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 pt-8 space-y-8">
        
        {/* HERO BANNER */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#121c33] via-[#162340] to-[#1c2c52] border border-[#233558] rounded-3xl p-8 md:p-10 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <span className="text-xs font-bold tracking-widest text-sky-400 uppercase">
              DASHBOARD OVERVIEW
            </span>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mt-1 mb-2">
              Welcome back, {username}! 👋
            </h1>
            <p className="text-slate-300 text-sm md:text-base leading-relaxed">
              Track your aptitude test performance, attempt available practice sets, or manage system records via the open admin panel.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
            {role === 'admin' && (
              <Link
                to="/admin"
                className="bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold text-xs md:text-sm px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-lg shadow-purple-950/40"
              >
                <span>🛡️</span> Admin Panel
              </Link>
            )}

            <Link
              to="/upload"
              className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs md:text-sm px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-lg shadow-blue-950/40"
            >
              <span>＋</span> Upload Practice Set
            </Link>
          </div>
        </div>

        {/* 4 STATS / METRICS CARDS ROW */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Available Sets */}
          <div className="bg-[#11192e] border border-[#1e2a47] rounded-2xl p-6 shadow-lg">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              AVAILABLE SETS
            </span>
            <div className="text-3xl md:text-4xl font-extrabold text-white">
              {sets.length}
            </div>
            <span className="text-xs text-slate-400 mt-1 block">
              question banks
            </span>
          </div>

          {/* Card 2: Total Attempts */}
          <div className="bg-[#11192e] border border-[#1e2a47] rounded-2xl p-6 shadow-lg">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              TOTAL ATTEMPTS
            </span>
            <div className="text-3xl md:text-4xl font-extrabold text-white">
              {totalAttemptsCount}
            </div>
            <span className="text-xs text-slate-400 mt-1 block">
              tests taken
            </span>
          </div>

          {/* Card 3: Completed */}
          <div className="bg-[#11192e] border border-[#1e2a47] rounded-2xl p-6 shadow-lg">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              COMPLETED
            </span>
            <div className="text-3xl md:text-4xl font-extrabold text-emerald-400">
              {completedAttemptsCount}
            </div>
            <span className="text-xs text-slate-400 mt-1 block">
              submits
            </span>
          </div>

          {/* Card 4: Avg Accuracy */}
          <div className="bg-[#11192e] border border-[#1e2a47] rounded-2xl p-6 shadow-lg">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              AVG ACCURACY
            </span>
            <div className="text-3xl md:text-4xl font-extrabold text-sky-400">
              {accuracyPercentage}%
            </div>
            <span className="text-xs text-slate-400 mt-1 block">
              avg score
            </span>
          </div>
        </div>

        {/* RECENT PERFORMANCE TRENDS & CATEGORY ANALYTICS */}
        <CategoryTrendsChart
          attempts={attempts}
          title="Performance Trends & Category Analytics"
          subtitle="Track your recent test score trajectory and skill proficiency across DSA categories"
        />

        {/* SEARCH, CATEGORY DROPDOWN & TABS ROW */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search practice sets or attempt history..."
              className="w-full bg-[#11192e] border border-[#1e2a47] placeholder-slate-500 text-white text-xs md:text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-sky-500 transition"
            />
          </div>

          {/* Filter Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Category Select Dropdown */}
            <div className="relative">
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="bg-[#11192e] border border-[#1e2a47] text-slate-200 text-xs font-semibold rounded-xl px-3.5 py-2.5 pr-8 focus:outline-none focus:border-sky-500 appearance-none cursor-pointer"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'All' ? 'All Categories ⌵' : cat}
                  </option>
                ))}
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[10px] text-slate-400">
                ▼
              </span>
            </div>

            {/* Segmented Tabs: All Question Sets / My Uploads */}
            <div className="flex bg-[#11192e] p-1 rounded-xl border border-[#1e2a47]">
              <button
                type="button"
                onClick={() => setTabFilter('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  tabFilter === 'all'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Question Sets ({sets.length})
              </button>
              <button
                type="button"
                onClick={() => setTabFilter('my')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  tabFilter === 'my'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                My Uploads ({myUploadsCount})
              </button>
            </div>

            {/* Random Pick Button */}
            <button
              onClick={handlePickRandom}
              disabled={filteredSets.length === 0}
              className="bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/60 text-purple-300 disabled:opacity-40 text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5"
              title="Pick a random assessment"
            >
              <span>🎲</span> Random
            </button>
          </div>
        </div>

        {/* SPLIT 2-COLUMN SECTION: AVAILABLE SETS (LEFT) & ATTEMPT HISTORY (RIGHT) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          
          {/* LEFT COLUMN: AVAILABLE PRACTICE SETS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#1e2a47]">
              <div className="flex items-center gap-2">
                <span className="text-blue-500 text-base">●</span>
                <h2 className="text-base font-bold text-white tracking-tight">
                  Available Practice Sets
                </h2>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                {filteredSets.length} set{filteredSets.length === 1 ? '' : 's'}
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-500 text-xs animate-pulse">
                Loading available sets...
              </div>
            ) : filteredSets.length === 0 ? (
              <div className="p-10 text-center bg-[#11192e] border border-[#1e2a47] rounded-2xl">
                <div className="text-3xl mb-2">📦</div>
                <p className="text-white font-semibold text-sm mb-1">No Practice Sets Found</p>
                <p className="text-slate-400 text-xs mb-4">Upload your first JSON question set to get started.</p>
                <Link
                  to="/upload"
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl inline-block transition"
                >
                  📄 Upload Question Set
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSets.map(set => (
                  <div
                    key={set._id}
                    className="bg-[#11192e] border border-[#1e2a47] hover:border-sky-500/60 rounded-2xl p-5 transition group shadow-md flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider bg-sky-950/70 text-sky-300 border border-sky-800/70 px-2.5 py-0.5 rounded-md">
                          {set.category || 'General'}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          {set.timingMode === 'per_problem' ? '⚡ Per Problem' : '⏳ Collective'}
                        </span>
                      </div>

                      <h3 className="text-white font-bold text-base group-hover:text-sky-300 transition">
                        {set.name}
                      </h3>
                      {set.description && (
                        <p className="text-slate-400 text-xs line-clamp-2 mt-1">
                          {set.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#1e2a47]/60 flex items-center justify-between">
                      <div className="text-xs text-slate-400 font-mono">
                        <span>⏱ {Math.round((set.totalTimeLimit || 1800) / 60)} mins</span>
                        <span className="mx-2">·</span>
                        <span>{set.problems?.length || 0} Questions</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {(role === 'admin' || set.createdBy === userData?._id) && (
                          <Link
                            to={`/admin/questionsets/${set._id}/edit`}
                            className="bg-[#18223a] hover:bg-[#202d4d] border border-[#2a3656] text-purple-300 text-xs font-bold px-2.5 py-1.5 rounded-xl transition"
                            title="Edit this question set"
                          >
                            ✏️ Edit
                          </Link>
                        )}
                        {(() => {
                          const activeAttempt = attempts.find(
                            a => (a.questionSetId?._id || a.questionSetId)?.toString() === set._id.toString() && a.status === 'in_progress'
                          );
                          if (activeAttempt) {
                            const firstProb = activeAttempt.questionSetId?.problems?.[0]?._id || activeAttempt.questionSetId?.problems?.[0] || set.problems?.[0]?._id || set.problems?.[0] || '';
                            return (
                              <Link
                                to={`/attempt/${activeAttempt._id}/problem/${firstProb}`}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl transition flex items-center gap-1 shadow animate-pulse"
                              >
                                <span>⚡</span> Resume Test &rarr;
                              </Link>
                            );
                          }
                          return (
                            <Link
                              to={`/sets/${set._id}`}
                              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl transition flex items-center gap-1 shadow"
                            >
                              Start Assessment &rarr;
                            </Link>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: YOUR ATTEMPT HISTORY */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#1e2a47]">
              <div className="flex items-center gap-2">
                <span className="text-emerald-500 text-base">●</span>
                <h2 className="text-base font-bold text-white tracking-tight">
                  Your Attempt History
                </h2>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                {filteredAttempts.length} history item{filteredAttempts.length === 1 ? '' : 's'}
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-500 text-xs animate-pulse">
                Loading attempt history...
              </div>
            ) : filteredAttempts.length === 0 ? (
              <div className="p-10 text-center bg-[#11192e] border border-[#1e2a47] rounded-2xl">
                <div className="text-3xl mb-2">🎯</div>
                <p className="text-white font-semibold text-sm mb-1">No Tests Taken Yet</p>
                <p className="text-slate-400 text-xs">Choose a practice set from the left to begin your first test session.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAttempts.map(a => {
                  const setInfo = a.questionSetId;
                  const isCompleted = a.status === 'completed';

                  return (
                    <div
                      key={a._id}
                      className="bg-[#11192e] border border-[#1e2a47] hover:border-emerald-500/50 rounded-2xl p-5 transition shadow-md flex items-center justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-white font-bold text-sm">{setInfo?.name || 'Assessment'}</h4>
                          <span className="text-[10px] uppercase font-semibold bg-[#18223a] text-slate-400 border border-[#243352] px-2 py-0.5 rounded">
                            {setInfo?.category || 'General'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400 font-mono">
                          <span className="font-bold text-amber-300 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded">
                            🏆 Score: {a.score || 0} pts
                          </span>
                          <span>•</span>
                          <span>{new Date(a.startedAt).toLocaleDateString()} at {new Date(a.startedAt).toLocaleTimeString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border capitalize ${
                          isCompleted
                            ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                            : a.status === 'timed_out'
                            ? 'bg-rose-950/60 text-rose-400 border-rose-800/60'
                            : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60 font-bold animate-pulse'
                        }`}>
                          {a.status === 'in_progress' ? '● In Progress' : a.status?.replace('_', ' ')}
                        </span>

                        {a.status === 'in_progress' ? (
                          <Link
                            to={`/attempt/${a._id}/problem/${a.questionSetId?.problems?.[0]?._id || a.questionSetId?.problems?.[0] || ''}`}
                            className="text-xs text-white font-bold bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/50 px-3 py-1 rounded-xl transition shadow flex items-center gap-1 animate-pulse"
                          >
                            <span>⚡</span> Resume
                          </Link>
                        ) : (
                          <Link
                            to={`/review/${a._id}`}
                            className="text-xs text-sky-400 hover:text-sky-300 font-semibold border border-sky-800/60 bg-sky-950/40 px-3 py-1 rounded-xl transition"
                          >
                            Review &rarr;
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
