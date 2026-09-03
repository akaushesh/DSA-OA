import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  allAttempts,
  endAttempt,
  deleteAttempt,
  adjustAttemptTime,
  resetAttempt,
  stopAttempt,
} from '../../api/attempts';
import Navbar from '../../components/Navbar';

export default function AttemptMonitor() {
  const [attempts, setAttempts] = useState([]);
  const [counts, setCounts] = useState({ total: 0, active: 0, completed: 0, timedOut: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'in_progress' | 'completed' | 'timed_out'
  const [selectedSetFilter, setSelectedSetFilter] = useState('all');

  // Modals & Controls State
  const [inspectAttempt, setInspectAttempt] = useState(null);
  const [inspectTab, setInspectTab] = useState('problems'); // 'problems' | 'submissions'
  const [selectedSubmissionCode, setSelectedSubmissionCode] = useState(null);

  const [timeAdjustModal, setTimeAdjustModal] = useState({ isOpen: false, attempt: null, problemId: '', minutes: 5 });
  const [actionModal, setActionModal] = useState({ isOpen: false, type: '', attempt: null, title: '', message: '' });

  const timerRef = useRef(null);

  const fetchAttempts = useCallback(async (showIndicator = false) => {
    if (showIndicator) setRefreshing(true);
    try {
      const res = await allAttempts({ limit: 100 });
      const data = res.data.statusCode;
      setAttempts(data?.attempts || []);
      if (data?.counts) setCounts(data.counts);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update live attempt data');
    } finally {
      setLoading(false);
      if (showIndicator) setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchAttempts();
  }, [fetchAttempts]);

  // Auto-refresh interval (5s) for live monitoring
  useEffect(() => {
    if (!autoRefresh) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      fetchAttempts(false);
    }, 5000);
    return () => clearInterval(timerRef.current);
  }, [autoRefresh, fetchAttempts]);

  // Format seconds into HH:MM:SS or MM:SS
  const formatSec = (sec) => {
    if (sec === undefined || sec === null || isNaN(sec)) return '0:00';
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const remS = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(remS).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(remS).padStart(2, '0')}`;
  };

  // Helper: compute problem and progress metrics for an attempt
  const getAttemptMetrics = useCallback((att) => {
    const problems = att.questionSetId?.problems || [];
    const totalProblems = problems.length;
    const submissions = att.submissions || [];

    // Map of problemId -> best status
    const problemStatusMap = {};
    const problemSubmissionsMap = {};

    problems.forEach((p) => {
      const pId = (p._id || p).toString();
      problemStatusMap[pId] = 'unvisited';
      problemSubmissionsMap[pId] = [];
    });

    submissions.forEach((sub) => {
      const pId = (sub.problemId?._id || sub.problemId)?.toString();
      if (!pId) return;
      if (!problemSubmissionsMap[pId]) problemSubmissionsMap[pId] = [];
      problemSubmissionsMap[pId].push(sub);

      if (sub.verdict === 'AC') {
        problemStatusMap[pId] = 'solved';
      } else if (problemStatusMap[pId] !== 'solved') {
        problemStatusMap[pId] = 'attempted';
      }
    });

    let solvedCount = 0;
    let attemptedCount = 0;

    Object.values(problemStatusMap).forEach((st) => {
      if (st === 'solved') {
        solvedCount++;
        attemptedCount++;
      } else if (st === 'attempted') {
        attemptedCount++;
      }
    });

    // Time calculations
    let timeInfo = '';
    let isExpired = false;

    if (att.timingMode === 'collective') {
      const limit = att.totalTimeLimit || att.questionSetId?.totalTimeLimit || 3600;
      if (att.status === 'in_progress') {
        const started = att.startedAt ? new Date(att.startedAt).getTime() : Date.now();
        const elapsed = Math.floor((Date.now() - started) / 1000);
        const remaining = Math.max(0, limit - elapsed);
        timeInfo = `${formatSec(remaining)} left`;
        isExpired = remaining <= 0;
      } else {
        timeInfo = `Limit: ${Math.round(limit / 60)}m`;
      }
    } else {
      // per_problem
      if (att.status === 'in_progress') {
        const elapsedMap = att.problemTimerElapsedSec || {};
        let totalElapsed = 0;
        let lockedProblems = 0;
        problems.forEach((p) => {
          const pId = (p._id || p).toString();
          const elapsed = elapsedMap[pId] || 0;
          totalElapsed += elapsed;
          const pLimit = p.timeLimit || 1800;
          if (elapsed >= pLimit) lockedProblems++;
        });
        timeInfo = `${formatSec(totalElapsed)} spent (${lockedProblems}/${totalProblems} locked)`;
        isExpired = totalProblems > 0 && lockedProblems >= totalProblems;
      } else {
        timeInfo = 'Per-Problem Timers';
      }
    }

    const progressPercent = totalProblems > 0 ? Math.round((solvedCount / totalProblems) * 100) : 0;

    return {
      problems,
      totalProblems,
      solvedCount,
      attemptedCount,
      problemStatusMap,
      problemSubmissionsMap,
      timeInfo,
      isExpired,
      progressPercent,
    };
  }, []);

  // Filtered attempts list
  const filteredAttempts = useMemo(() => {
    return attempts.filter((a) => {
      // Status filter
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;

      // Question Set filter
      if (selectedSetFilter !== 'all') {
        const setId = (a.questionSetId?._id || a.questionSetId)?.toString();
        if (setId !== selectedSetFilter) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const username = (a.userId?.username || '').toLowerCase();
        const fullName = (a.userId?.fullName || '').toLowerCase();
        const email = (a.userId?.email || '').toLowerCase();
        const setName = (a.questionSetId?.name || '').toLowerCase();
        return username.includes(query) || fullName.includes(query) || email.includes(query) || setName.includes(query);
      }

      return true;
    });
  }, [attempts, statusFilter, selectedSetFilter, searchTerm]);

  // Unique question sets for filter dropdown
  const uniqueQuestionSets = useMemo(() => {
    const map = new Map();
    attempts.forEach((a) => {
      if (a.questionSetId?._id && a.questionSetId?.name) {
        map.set(a.questionSetId._id.toString(), a.questionSetId.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [attempts]);

  // Handle Action: Stop Attempt (Admin only)
  const handleStopAttempt = async (attempt) => {
    try {
      await stopAttempt(attempt._id);
      toast.success(`🛑 Assessment stopped for ${attempt.userId?.username || 'user'}`);
      fetchAttempts(true);
      if (inspectAttempt?._id === attempt._id) {
        setInspectAttempt((prev) => (prev ? { ...prev, status: 'stopped_by_admin', stoppedByAdmin: true } : null));
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to stop attempt');
    }
  };

  // Handle Action: Force End Attempt
  const handleForceEnd = async (attempt) => {
    try {
      await endAttempt(attempt._id, false);
      toast.success(`Force concluded test for ${attempt.userId?.username || 'user'}`);
      fetchAttempts(true);
      if (inspectAttempt?._id === attempt._id) {
        setInspectAttempt((prev) => (prev ? { ...prev, status: 'completed' } : null));
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to force end attempt');
    }
  };

  // Handle Action: Reset Attempt
  const handleResetAttempt = async (attempt) => {
    try {
      await resetAttempt(attempt._id);
      toast.success(`Reset attempt for ${attempt.userId?.username || 'user'} to in-progress`);
      fetchAttempts(true);
      if (inspectAttempt?._id === attempt._id) {
        setInspectAttempt((prev) => (prev ? { ...prev, status: 'in_progress' } : null));
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to reset attempt');
    }
  };

  // Handle Action: Delete Attempt
  const handleDeleteAttempt = async (attempt) => {
    try {
      await deleteAttempt(attempt._id);
      toast.success('Attempt record permanently deleted');
      fetchAttempts(true);
      if (inspectAttempt?._id === attempt._id) {
        setInspectAttempt(null);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to delete attempt');
    }
  };

  // Handle Action: Adjust / Add Time
  const handleAdjustTimeSubmit = async () => {
    const { attempt, problemId, minutes } = timeAdjustModal;
    if (!attempt) return;
    const additionalSeconds = Number(minutes) * 60;
    try {
      await adjustAttemptTime(attempt._id, { additionalSeconds, problemId: problemId || undefined });
      toast.success(`Added ${minutes} minutes to ${problemId ? 'selected problem' : 'assessment'}`);
      setTimeAdjustModal({ isOpen: false, attempt: null, problemId: '', minutes: 5 });
      fetchAttempts(true);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to adjust time');
    }
  };

  return (
    <div className="min-h-screen bg-[#0b132b] text-white flex flex-col font-sans">
      <Navbar />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-purple-600/30 border border-purple-500/50 flex items-center justify-center text-purple-300 text-lg shadow-inner">
                🛡️
              </span>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
                  Admin Assessment Monitor
                  {counts.active > 0 && (
                    <span className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      {counts.active} Live Ongoing
                    </span>
                  )}
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Live real-time visibility and full supervisor control over all ongoing and completed tests.
                </p>
              </div>
            </div>
          </div>

          {/* Right Controls: Auto-Refresh Toggle + Manual Refresh */}
          <div className="flex items-center gap-3 self-start lg:self-auto">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition ${
                autoRefresh
                  ? 'bg-emerald-950/60 border-emerald-600/70 text-emerald-300 shadow-sm'
                  : 'bg-[#152038] border-[#223255] text-slate-400 hover:text-white'
              }`}
              title="Toggle automatic 5-second polling"
            >
              <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`}></span>
              Live Polling: {autoRefresh ? 'ON (5s)' : 'PAUSED'}
            </button>

            <button
              onClick={() => fetchAttempts(true)}
              disabled={refreshing}
              className="bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-blue-950/40"
            >
              <span className={refreshing ? 'animate-spin' : ''}>🔄</span>
              {refreshing ? 'Refreshing...' : 'Refresh Now'}
            </button>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {/* Active Live */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'in_progress' ? 'all' : 'in_progress')}
            className={`p-4 rounded-2xl border transition cursor-pointer ${
              statusFilter === 'in_progress'
                ? 'bg-emerald-950/80 border-emerald-500 ring-2 ring-emerald-500/40'
                : 'bg-[#11192e] border-[#1f2c4b] hover:border-emerald-700/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Live In-Progress</span>
              {counts.active > 0 && <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>}
            </div>
            <p className="text-3xl font-black text-white mt-1">{counts.active || 0}</p>
            <span className="text-[11px] text-slate-400">tests currently running</span>
          </div>

          {/* Completed */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
            className={`p-4 rounded-2xl border transition cursor-pointer ${
              statusFilter === 'completed'
                ? 'bg-blue-950/80 border-blue-500 ring-2 ring-blue-500/40'
                : 'bg-[#11192e] border-[#1f2c4b] hover:border-blue-700/60'
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Completed</span>
            <p className="text-3xl font-black text-white mt-1">{counts.completed || 0}</p>
            <span className="text-[11px] text-slate-400">successfully submitted</span>
          </div>

          {/* Timed Out */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'timed_out' ? 'all' : 'timed_out')}
            className={`p-4 rounded-2xl border transition cursor-pointer ${
              statusFilter === 'timed_out'
                ? 'bg-rose-950/80 border-rose-500 ring-2 ring-rose-500/40'
                : 'bg-[#11192e] border-[#1f2c4b] hover:border-rose-700/60'
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Timed Out</span>
            <p className="text-3xl font-black text-white mt-1">{counts.timedOut || 0}</p>
            <span className="text-[11px] text-slate-400">reached time limits</span>
          </div>

          {/* Total Recorded */}
          <div
            onClick={() => setStatusFilter('all')}
            className={`p-4 rounded-2xl border transition cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-purple-950/80 border-purple-500 ring-2 ring-purple-500/40'
                : 'bg-[#11192e] border-[#1f2c4b] hover:border-purple-700/60'
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Total Attempts</span>
            <p className="text-3xl font-black text-white mt-1">{counts.total || 0}</p>
            <span className="text-[11px] text-slate-400">lifetime recorded sessions</span>
          </div>
        </div>

        {/* Filter, Search & Tabs Bar */}
        <div className="bg-[#11192e] border border-[#1f2c4b] rounded-2xl p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex bg-[#080d1a] p-1 rounded-xl w-full md:w-auto">
            {[
              { key: 'all', label: `All (${counts.total})` },
              { key: 'in_progress', label: `🟢 Live (${counts.active})` },
              { key: 'completed', label: `Completed (${counts.completed})` },
              { key: 'timed_out', label: `Timed Out (${counts.timedOut})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`flex-1 md:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  statusFilter === tab.key
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input & Set Filter */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {/* Set dropdown */}
            <select
              value={selectedSetFilter}
              onChange={(e) => setSelectedSetFilter(e.target.value)}
              className="w-full sm:w-48 bg-[#080d1a] border border-[#223255] text-slate-300 text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Question Sets</option>
              {uniqueQuestionSets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
              <input
                type="text"
                placeholder="Search user, name, test..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#080d1a] border border-[#223255] text-white placeholder-slate-500 text-xs font-medium pl-8 pr-3 py-2 rounded-xl focus:outline-none focus:border-purple-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Live Attempts List */}
        {loading ? (
          <div className="bg-[#11192e] border border-[#1f2c4b] rounded-2xl p-16 text-center">
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-300 text-sm font-semibold">Loading live test monitoring records...</p>
          </div>
        ) : filteredAttempts.length === 0 ? (
          <div className="bg-[#11192e] border border-[#1f2c4b] rounded-2xl p-16 text-center">
            <span className="text-4xl block mb-2">📋</span>
            <h3 className="text-base font-bold text-white mb-1">No Assessment Sessions Match Filters</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
              Try altering your search keyword or switching between the status filter tabs.
            </p>
            <button
              onClick={() => {
                setStatusFilter('all');
                setSelectedSetFilter('all');
                setSearchTerm('');
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAttempts.map((att) => {
              const metrics = getAttemptMetrics(att);
              const isLive = att.status === 'in_progress';
              const userInitial = (att.userId?.username || 'U').charAt(0).toUpperCase();

              return (
                <div
                  key={att._id}
                  className={`bg-[#11192e] border rounded-2xl p-4 sm:p-5 transition-all shadow-md ${
                    isLive
                      ? 'border-emerald-500/60 bg-gradient-to-r from-[#11192e] via-[#11192e] to-emerald-950/20'
                      : 'border-[#1f2c4b] hover:border-slate-600'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* User & Test Info */}
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-2xl font-bold flex items-center justify-center text-sm shadow-md shrink-0 ${
                          isLive
                            ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white'
                            : 'bg-[#1b2640] text-slate-300 border border-[#2a3a5f]'
                        }`}
                      >
                        {userInitial}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-white text-sm font-extrabold truncate">
                            {att.userId?.fullName || att.userId?.username || 'Anonymous User'}
                          </h3>
                          <span className="text-xs text-sky-400 font-mono">@{att.userId?.username}</span>

                          {/* Status Badge */}
                          {isLive ? (
                            <span className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              Active Live
                            </span>
                          ) : (att.status === 'stopped_by_admin' || att.stoppedByAdmin) ? (
                            <span className="bg-rose-950/80 text-rose-300 border border-rose-600 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                              <span>🛑</span> Stopped by Admin
                            </span>
                          ) : att.status === 'completed' ? (
                            <span className="bg-blue-500/20 text-blue-400 border border-blue-500/40 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
                              ✓ Completed
                            </span>
                          ) : (
                            <span className="bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
                              ⏱ Timed Out
                            </span>
                          )}
                        </div>

                        {/* Test Name & Timing Mode */}
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap">
                          <span className="font-semibold text-slate-200">
                            {att.questionSetId?.name || 'Assessment Set'}
                          </span>
                          <span>•</span>
                          <span className="bg-[#18223a] text-slate-300 border border-[#273656] text-[10px] font-mono px-2 py-0.5 rounded-md uppercase">
                            {att.timingMode === 'per_problem' ? 'Per-Problem Timers' : 'Collective Timer'}
                          </span>
                          <span>•</span>
                          <span className="text-[11px] text-slate-400">
                            Started {new Date(att.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Indicator & Problem Matrix */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 lg:gap-8 shrink-0">
                      {/* Solved Progress */}
                      <div className="w-48 sm:w-44">
                        <div className="flex justify-between items-center text-xs mb-1.5 font-semibold">
                          <span className="text-slate-400">Progress</span>
                          <span className="text-white font-mono font-bold">
                            {metrics.solvedCount} / {metrics.totalProblems} AC ({metrics.progressPercent}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-[#080d1a] rounded-full overflow-hidden border border-[#1f2c4b]">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              metrics.progressPercent === 100
                                ? 'bg-emerald-400'
                                : metrics.progressPercent > 0
                                ? 'bg-purple-500'
                                : 'bg-slate-700'
                            }`}
                            style={{ width: `${Math.max(5, metrics.progressPercent)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 font-mono">{metrics.timeInfo}</p>
                      </div>

                      {/* Problem Status Matrix Pills */}
                      <div className="flex items-center gap-1.5 flex-wrap max-w-xs">
                        {metrics.problems.map((p, idx) => {
                          const pId = (p._id || p).toString();
                          const st = metrics.problemStatusMap[pId];
                          const isPerProblem = att.timingMode === 'per_problem';
                          const pElapsed = att.problemTimerElapsedSec?.[pId] || 0;
                          const pLimit = p.timeLimit || 1800;
                          const isProblemLocked = isPerProblem && pElapsed >= pLimit;

                          let bg = 'bg-[#18223a] text-slate-400 border-[#273656]';
                          let title = `Q${idx + 1}: Unvisited`;

                          if (st === 'solved') {
                            bg = 'bg-emerald-950/80 text-emerald-300 border-emerald-600 font-bold';
                            title = `Q${idx + 1}: Solved (AC)`;
                          } else if (st === 'attempted') {
                            bg = 'bg-amber-950/80 text-amber-300 border-amber-600 font-bold';
                            title = `Q${idx + 1}: Attempted (Not AC)`;
                          } else if (isProblemLocked) {
                            bg = 'bg-rose-950/70 text-rose-400 border-rose-800 font-bold';
                            title = `Q${idx + 1}: Locked (Time expired)`;
                          }

                          return (
                            <button
                              key={pId}
                              type="button"
                              onClick={() => {
                                setInspectAttempt(att);
                                setInspectTab('problems');
                              }}
                              title={title}
                              className={`w-7 h-7 rounded-lg text-[10px] font-mono border flex items-center justify-center transition hover:scale-110 ${bg}`}
                            >
                              {idx + 1}
                            </button>
                          );
                        })}
                      </div>

                      {/* Control Actions Dropdown / Action Cluster */}
                      <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#1f2c4b]">
                        {/* Inspect Live Button */}
                        <button
                          onClick={() => {
                            setInspectAttempt(att);
                            setInspectTab('problems');
                          }}
                          className="px-3 py-1.5 bg-[#152038] hover:bg-[#1f2e50] border border-[#2a3d66] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
                          title="Inspect live user code & question state"
                        >
                          <span>👁️</span> Inspect
                        </button>

                        {/* Stop / Terminate Ongoing Test (Admin only) */}
                        {isLive && (
                          <button
                            onClick={() =>
                              setActionModal({
                                isOpen: true,
                                type: 'stop_test',
                                attempt: att,
                                title: `🛑 Stop Ongoing Test for ${att.userId?.username || 'User'}?`,
                                message:
                                  'Only an administrator can stop an ongoing test session. This will immediately lock the student arena in real time and conclude their test.',
                              })
                            }
                            className="px-3 py-1.5 bg-rose-950/70 hover:bg-rose-900 border border-rose-600 text-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
                            title="Stop ongoing test (Admin Only)"
                          >
                            <span>🛑</span> Stop Test
                          </button>
                        )}

                        {/* Adjust Time (if in progress) */}
                        {isLive && (
                          <button
                            onClick={() =>
                              setTimeAdjustModal({
                                isOpen: true,
                                attempt: att,
                                problemId: '',
                                minutes: 5,
                              })
                            }
                            className="px-2.5 py-1.5 bg-amber-950/60 hover:bg-amber-900/80 border border-amber-700/80 text-amber-200 rounded-xl text-xs font-bold transition"
                            title="Add extra time for this user"
                          >
                            +⏱ Time
                          </button>
                        )}

                        {/* Reset Attempt (restart test) */}
                        <button
                          onClick={() =>
                            setActionModal({
                              isOpen: true,
                              type: 'reset',
                              attempt: att,
                              title: `Reset Test Attempt for ${att.userId?.username || 'User'}?`,
                              message:
                                'This will reset the test back to in-progress and zero out elapsed timers so the student can continue fresh.',
                            })
                          }
                          className="p-1.5 bg-[#152038] hover:bg-[#1f2e50] border border-[#2a3d66] text-slate-300 hover:text-white rounded-xl text-xs transition"
                          title="Reset test back to in-progress"
                        >
                          🔄
                        </button>

                        {/* Delete Attempt */}
                        <button
                          onClick={() =>
                            setActionModal({
                              isOpen: true,
                              type: 'delete',
                              attempt: att,
                              title: `Permanently Delete Attempt?`,
                              message:
                                'This will delete this attempt record from the system. This action cannot be reversed.',
                            })
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition"
                          title="Delete attempt record"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: INSPECT PROGRESS & LIVE CODE DRAWER */}
      {/* ========================================================================= */}
      {inspectAttempt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0e1628] border border-[#243456] rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#1f2c4b] bg-[#111a2f] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white font-black text-base shadow">
                  {(inspectAttempt.userId?.username || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-white text-base font-extrabold tracking-tight">
                      {inspectAttempt.userId?.fullName || inspectAttempt.userId?.username}
                    </h2>
                    <span className="text-xs font-mono text-sky-400">@{inspectAttempt.userId?.username}</span>
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        inspectAttempt.status === 'in_progress'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                      }`}
                    >
                      {inspectAttempt.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Test: <strong className="text-slate-200">{inspectAttempt.questionSetId?.name}</strong> · Mode:{' '}
                    <span className="font-mono">{inspectAttempt.timingMode}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to={`/review/${inspectAttempt._id}`}
                  className="text-xs bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1.5 rounded-xl transition"
                >
                  Full Report ↗
                </Link>
                <button
                  onClick={() => {
                    setInspectAttempt(null);
                    setSelectedSubmissionCode(null);
                  }}
                  className="w-8 h-8 rounded-xl bg-[#1a253d] hover:bg-[#253456] text-slate-300 flex items-center justify-center transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Nav Tabs */}
            <div className="px-6 py-2.5 bg-[#0b1325] border-b border-[#1f2c4b] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setInspectTab('problems');
                    setSelectedSubmissionCode(null);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    inspectTab === 'problems'
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Problem Breakdown ({inspectAttempt.questionSetId?.problems?.length || 0})
                </button>
                <button
                  onClick={() => setInspectTab('submissions')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    inspectTab === 'submissions'
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Submissions Feed ({inspectAttempt.submissions?.length || 0})
                </button>
              </div>

              {/* Quick Actions inside modal */}
              {inspectAttempt.status === 'in_progress' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setTimeAdjustModal({
                        isOpen: true,
                        attempt: inspectAttempt,
                        problemId: '',
                        minutes: 5,
                      })
                    }
                    className="text-xs bg-amber-950/60 hover:bg-amber-900 border border-amber-700 text-amber-200 font-bold px-3 py-1 rounded-lg transition"
                  >
                    +⏱ Add 5m
                  </button>
                  <button
                    onClick={() => handleStopAttempt(inspectAttempt)}
                    className="text-xs bg-rose-950/80 hover:bg-rose-900 border border-rose-600 text-rose-200 font-bold px-3 py-1 rounded-lg transition flex items-center gap-1"
                  >
                    <span>🛑</span> Stop Test
                  </button>
                </div>
              )}
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* TAB 1: PROBLEMS BREAKDOWN */}
              {inspectTab === 'problems' && (
                <div className="space-y-4">
                  {(() => {
                    const metrics = getAttemptMetrics(inspectAttempt);
                    return (
                      <div className="space-y-3">
                        {metrics.problems.map((p, idx) => {
                          const pId = (p._id || p).toString();
                          const st = metrics.problemStatusMap[pId];
                          const subs = metrics.problemSubmissionsMap[pId] || [];
                          const latestSub = subs[subs.length - 1];

                          const isPerProblem = inspectAttempt.timingMode === 'per_problem';
                          const pElapsed = inspectAttempt.problemTimerElapsedSec?.[pId] || 0;
                          const pLimit = p.timeLimit || 1800;
                          const remaining = Math.max(0, pLimit - pElapsed);
                          const isLocked = isPerProblem && remaining <= 0;

                          return (
                            <div
                              key={pId}
                              className="bg-[#121c33] border border-[#213154] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="w-6 h-6 rounded-lg bg-purple-600/30 border border-purple-500/50 text-purple-300 font-mono font-bold text-xs flex items-center justify-center">
                                    {idx + 1}
                                  </span>
                                  <h4 className="text-white font-extrabold text-sm truncate">{p.title}</h4>
                                  <span className="text-[10px] font-mono text-slate-400 bg-[#18233d] px-2 py-0.5 rounded border border-[#28395e]">
                                    {p.category || 'DSA'}
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                      p.difficulty === 'Easy'
                                        ? 'text-emerald-400 bg-emerald-950/60'
                                        : p.difficulty === 'Medium'
                                        ? 'text-amber-400 bg-amber-950/60'
                                        : 'text-rose-400 bg-rose-950/60'
                                    }`}
                                  >
                                    {p.difficulty}
                                  </span>
                                </div>

                                <div className="flex items-center gap-3 text-xs text-slate-400 mt-2 flex-wrap font-mono">
                                  {isPerProblem && (
                                    <span
                                      className={
                                        isLocked
                                          ? 'text-rose-400 font-bold'
                                          : remaining < 120
                                          ? 'text-amber-400 font-bold'
                                          : 'text-slate-300'
                                      }
                                    >
                                      ⏱ Timer: {isLocked ? 'Locked (0:00)' : `${formatSec(remaining)} left`} (spent{' '}
                                      {formatSec(pElapsed)})
                                    </span>
                                  )}
                                  <span>•</span>
                                  <span>Submissions: {subs.length}</span>
                                  {latestSub && (
                                    <>
                                      <span>•</span>
                                      <span>
                                        Latest Verdict:{' '}
                                        <strong
                                          className={
                                            latestSub.verdict === 'AC' ? 'text-emerald-400' : 'text-rose-400'
                                          }
                                        >
                                          {latestSub.verdict} ({latestSub.passedTests}/{latestSub.totalTests} tests)
                                        </strong>
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Problem Controls */}
                              <div className="flex items-center gap-2 shrink-0">
                                {latestSub?.code && (
                                  <button
                                    onClick={() => {
                                      setSelectedSubmissionCode(latestSub);
                                      setInspectTab('submissions');
                                    }}
                                    className="px-3 py-1.5 bg-[#1b2742] hover:bg-[#25355a] border border-[#2d3e68] text-white rounded-xl text-xs font-semibold transition"
                                  >
                                    View Code
                                  </button>
                                )}

                                {isPerProblem && inspectAttempt.status === 'in_progress' && (
                                  <button
                                    onClick={() =>
                                      setTimeAdjustModal({
                                        isOpen: true,
                                        attempt: inspectAttempt,
                                        problemId: pId,
                                        minutes: 5,
                                      })
                                    }
                                    className="px-2.5 py-1.5 bg-amber-950/60 hover:bg-amber-900 border border-amber-700 text-amber-300 text-xs font-bold rounded-xl transition"
                                    title="Add 5 minutes specifically to this problem"
                                  >
                                    +5m Problem
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* TAB 2: SUBMISSIONS FEED & CODE VIEWER */}
              {inspectTab === 'submissions' && (
                <div className="space-y-4">
                  {inspectAttempt.submissions?.length === 0 ? (
                    <p className="text-slate-400 text-center py-10 font-semibold text-sm">
                      No code submissions made by this user yet.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Left: Submissions list */}
                      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                        {inspectAttempt.submissions?.map((sub, sIdx) => {
                          const isSelected = selectedSubmissionCode?._id === sub._id;
                          return (
                            <div
                              key={sub._id || sIdx}
                              onClick={() => setSelectedSubmissionCode(sub)}
                              className={`p-3 rounded-xl border transition cursor-pointer text-xs ${
                                isSelected
                                  ? 'bg-purple-950/60 border-purple-500 shadow'
                                  : 'bg-[#121c33] border-[#213154] hover:border-slate-500'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-white uppercase font-mono">{sub.language}</span>
                                <span
                                  className={`font-black text-[10px] px-2 py-0.5 rounded ${
                                    sub.verdict === 'AC'
                                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                                      : 'bg-rose-950 text-rose-300 border border-rose-600'
                                  }`}
                                >
                                  {sub.verdict}
                                </span>
                              </div>
                              <p className="text-slate-400 text-[11px]">
                                Tests: {sub.passedTests}/{sub.totalTests} passed · {sub.runtime || 0}ms
                              </p>
                              <span className="text-[10px] text-slate-500">
                                {new Date(sub.submittedAt).toLocaleTimeString()}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Right: Code Preview Container */}
                      <div className="md:col-span-2 bg-[#080d1a] border border-[#1f2c4b] rounded-2xl p-4 flex flex-col h-[50vh]">
                        {selectedSubmissionCode ? (
                          <>
                            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#1f2c4b] text-xs">
                              <span className="font-mono text-purple-400 font-bold">
                                {selectedSubmissionCode.language?.toUpperCase()} Submission Code
                              </span>
                              <span className="text-slate-400 font-mono">
                                Verdict: <strong>{selectedSubmissionCode.verdict}</strong>
                              </span>
                            </div>
                            <pre className="flex-1 overflow-auto font-mono text-xs text-slate-200 bg-[#0d1424] p-4 rounded-xl leading-relaxed whitespace-pre-wrap">
                              {selectedSubmissionCode.code || '// No code content captured'}
                            </pre>
                          </>
                        ) : (
                          <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
                            Select a submission on the left to inspect the student's code.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADJUST TIME MODAL */}
      {/* ========================================================================= */}
      {timeAdjustModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-[#0e1628] border border-[#243456] rounded-3xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 duration-150">
            <h3 className="text-lg font-extrabold text-white mb-1">⏱ Adjust Assessment Time</h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Grant additional time for{' '}
              <strong className="text-white">
                {timeAdjustModal.attempt?.userId?.username || 'user'}
              </strong>
              . This is applied instantly to live timers.
            </p>

            {/* If per-problem mode: select problem or all problems */}
            {timeAdjustModal.attempt?.timingMode === 'per_problem' && (
              <div className="mb-4">
                <label className="text-xs font-bold text-slate-300 block mb-1.5">Apply to Problem:</label>
                <select
                  value={timeAdjustModal.problemId}
                  onChange={(e) => setTimeAdjustModal({ ...timeAdjustModal, problemId: e.target.value })}
                  className="w-full bg-[#080d1a] border border-[#243456] text-white text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none focus:border-purple-500"
                >
                  <option value="">All Problems in Test (Add time to all)</option>
                  {timeAdjustModal.attempt?.questionSetId?.problems?.map((p, idx) => (
                    <option key={p._id || idx} value={p._id || p}>
                      Q{idx + 1}: {p.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Quick minute buttons */}
            <div className="mb-4">
              <label className="text-xs font-bold text-slate-300 block mb-2">Select Extra Minutes to Add:</label>
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 15, 30].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTimeAdjustModal({ ...timeAdjustModal, minutes: m })}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      timeAdjustModal.minutes === m
                        ? 'bg-purple-600 text-white border-purple-500 shadow'
                        : 'bg-[#121c33] border-[#213154] text-slate-300 hover:text-white'
                    }`}
                  >
                    +{m} min
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Minutes Input */}
            <div className="mb-6">
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Or Custom Minutes:</label>
              <input
                type="number"
                min="1"
                max="180"
                value={timeAdjustModal.minutes}
                onChange={(e) => setTimeAdjustModal({ ...timeAdjustModal, minutes: Math.max(1, Number(e.target.value)) })}
                className="w-full bg-[#080d1a] border border-[#243456] text-white text-xs font-bold px-3 py-2 rounded-xl focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setTimeAdjustModal({ isOpen: false, attempt: null, problemId: '', minutes: 5 })}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjustTimeSubmit}
                className="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white rounded-xl shadow transition active:scale-95"
              >
                Confirm & Add Time
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CONFIRM ACTION DIALOG */}
      {/* ========================================================================= */}
      {actionModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-[#0e1628] border border-[#243456] rounded-3xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 duration-150">
            <h3 className="text-lg font-extrabold text-white mb-2">{actionModal.title}</h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">{actionModal.message}</p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setActionModal({ isOpen: false, type: '', attempt: null, title: '', message: '' })}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const att = actionModal.attempt;
                  const type = actionModal.type;
                  setActionModal({ isOpen: false, type: '', attempt: null, title: '', message: '' });
                  if (type === 'stop_test') await handleStopAttempt(att);
                  else if (type === 'force_end') await handleForceEnd(att);
                  else if (type === 'reset') await handleResetAttempt(att);
                  else if (type === 'delete') await handleDeleteAttempt(att);
                }}
                className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow transition active:scale-95 ${
                  actionModal.type === 'delete' || actionModal.type === 'stop_test'
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : actionModal.type === 'reset'
                    ? 'bg-blue-600 hover:bg-blue-500'
                    : 'bg-purple-600 hover:bg-purple-500'
                }`}
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
