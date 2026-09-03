import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { listUsers, updateUserRole, getUserDetails } from '../../api/admin';
import Navbar from '../../components/Navbar';

export default function UserManager() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Detailed User Modal State
  const [detailModal, setDetailModal] = useState({
    isOpen: false,
    loading: false,
    data: null,
  });
  const [activeTab, setActiveTab] = useState('attempts'); // 'attempts' | 'sets' | 'submissions'

  const load = useCallback(() => {
    setLoading(true);
    listUsers({ limit: 100, search: searchTerm || undefined, role: roleFilter !== 'all' ? roleFilter : undefined })
      .then((r) => setUsers(r.data.statusCode?.users || []))
      .catch((err) => {
        console.error(err);
        toast.error('Failed to load users list');
      })
      .finally(() => setLoading(false));
  }, [searchTerm, roleFilter]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const toggleRole = async (e, id, currentRole) => {
    e.stopPropagation();
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`Change role to ${newRole.toUpperCase()}?`)) return;
    try {
      await updateUserRole(id, newRole);
      toast.success(`Role updated to ${newRole.toUpperCase()}`);
      load();
      if (detailModal.data?.user?._id === id) {
        setDetailModal((prev) => ({
          ...prev,
          data: {
            ...prev.data,
            user: { ...prev.data.user, role: newRole },
          },
        }));
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update role');
    }
  };

  const handleOpenDetails = async (userId) => {
    setDetailModal({ isOpen: true, loading: true, data: null });
    setActiveTab('attempts');
    try {
      const res = await getUserDetails(userId);
      setDetailModal({ isOpen: true, loading: false, data: res.data.statusCode });
    } catch (err) {
      console.error(err);
      toast.error('Failed to load user performance record');
      setDetailModal({ isOpen: false, loading: false, data: null });
    }
  };

  // Filter users in memory as well
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const username = (u.username || '').toLowerCase();
        const fullName = (u.fullName || '').toLowerCase();
        return username.includes(query) || fullName.includes(query);
      }
      return true;
    });
  }, [users, roleFilter, searchTerm]);

  return (
    <div className="min-h-screen bg-[#0b132b] text-white flex flex-col font-sans">
      <Navbar />

      <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-purple-600/30 border border-purple-500/50 flex items-center justify-center text-purple-300 text-lg shadow-inner">
                👤
              </span>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Users & Performance Directory</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Click any user to inspect their live status, past test performances, and authored question sets.
                </p>
              </div>
            </div>
          </div>

          <Link
            to="/admin/attempts"
            className="self-start sm:self-auto bg-[#152038] hover:bg-[#1f2e50] border border-[#26375a] text-slate-200 text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5"
          >
            <span>🛡️</span> Live Test Monitor →
          </Link>
        </div>

        {/* Filter & Search Controls */}
        <div className="bg-[#11192e] border border-[#1f2c4b] rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Role Filters */}
          <div className="flex bg-[#080d1a] p-1 rounded-xl w-full sm:w-auto">
            {[
              { key: 'all', label: `All Users (${users.length})` },
              { key: 'user', label: 'Students' },
              { key: 'admin', label: 'Admins' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setRoleFilter(tab.key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex-1 sm:flex-initial ${
                  roleFilter === tab.key
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-72">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
            <input
              type="text"
              placeholder="Search by username or name..."
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

        {/* Users Table */}
        {loading ? (
          <div className="bg-[#11192e] border border-[#1f2c4b] rounded-2xl p-16 text-center">
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-300 text-sm font-semibold">Loading users directory...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-[#11192e] border border-[#1f2c4b] rounded-2xl p-16 text-center">
            <span className="text-4xl block mb-2">👤</span>
            <h3 className="text-base font-bold text-white mb-1">No Users Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No registered user accounts match your current query or role filter.
            </p>
          </div>
        ) : (
          <div className="bg-[#11192e] border border-[#1f2c4b] rounded-2xl overflow-hidden shadow-lg">
            <div className="grid grid-cols-12 px-6 py-3 border-b border-[#1f2c4b] bg-[#0d1424] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <span className="col-span-4">User Account</span>
              <span className="col-span-2 text-center">Role</span>
              <span className="col-span-3 text-center">Activity & Tests</span>
              <span className="col-span-3 text-right">Actions</span>
            </div>

            <div className="divide-y divide-[#1b2640]">
              {filteredUsers.map((u) => {
                const initial = (u.username || 'U').charAt(0).toUpperCase();
                const hasActiveTest = (u.stats?.activeAttemptsCount || 0) > 0;

                return (
                  <div
                    key={u._id}
                    onClick={() => handleOpenDetails(u._id)}
                    className="grid grid-cols-12 px-6 py-4 items-center hover:bg-[#141f38] transition cursor-pointer group"
                  >
                    {/* User Identity */}
                    <div className="col-span-4 flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-purple-600/30 border border-purple-500/50 text-purple-200 font-bold flex items-center justify-center text-sm shadow shrink-0 group-hover:scale-105 transition-transform">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-extrabold truncate group-hover:text-purple-300 transition">
                          {u.fullName || u.username}
                        </p>
                        <p className="text-xs text-sky-400 font-mono truncate">@{u.username}</p>
                      </div>
                    </div>

                    {/* Role Badge */}
                    <div className="col-span-2 text-center">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md border ${
                          u.role === 'admin'
                            ? 'bg-purple-950/80 border-purple-600 text-purple-300'
                            : 'bg-[#18233a] border-[#253556] text-slate-300'
                        }`}
                      >
                        {u.role}
                      </span>
                    </div>

                    {/* Activity Metrics */}
                    <div className="col-span-3 flex items-center justify-center gap-2 flex-wrap">
                      <span className="text-[11px] font-mono bg-[#080d1a] border border-[#213154] text-slate-300 px-2.5 py-0.5 rounded-lg">
                        {u.stats?.attemptsCount || 0} Tests Taken
                      </span>
                      {hasActiveTest && (
                        <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-md animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          Live
                        </span>
                      )}
                      {(u.stats?.setsCount || 0) > 0 && (
                        <span className="text-[11px] font-mono bg-blue-950/60 border border-blue-800/60 text-blue-300 px-2 py-0.5 rounded-lg">
                          {u.stats.setsCount} Sets
                        </span>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="col-span-3 flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleOpenDetails(u._id)}
                        className="text-xs bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1.5 rounded-xl transition shadow"
                      >
                        View Profile
                      </button>

                      <button
                        onClick={(e) => toggleRole(e, u._id, u.role)}
                        className="text-xs bg-[#18233a] hover:bg-[#223356] border border-[#27395e] text-slate-300 hover:text-white px-3 py-1.5 rounded-xl transition"
                        title="Change role"
                      >
                        Make {u.role === 'admin' ? 'User' : 'Admin'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* USER DETAIL & PERFORMANCE INSPECTOR MODAL */}
      {/* ========================================================================= */}
      {detailModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-[#0e1628] border border-[#243456] rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#1f2c4b] bg-[#111a2f] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-md">
                  {(detailModal.data?.user?.username || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-white text-base font-extrabold tracking-tight">
                      {detailModal.data?.user?.fullName || detailModal.data?.user?.username || 'Loading User...'}
                    </h2>
                    <span className="text-xs font-mono text-sky-400">@{detailModal.data?.user?.username}</span>
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                        detailModal.data?.user?.role === 'admin'
                          ? 'bg-purple-950 text-purple-300 border border-purple-600'
                          : 'bg-[#18233a] text-slate-300 border border-[#273656]'
                      }`}
                    >
                      {detailModal.data?.user?.role}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    User ID: <span className="font-mono text-slate-300">{detailModal.data?.user?._id}</span> · Registered{' '}
                    {detailModal.data?.user?.createdAt
                      ? new Date(detailModal.data.user.createdAt).toLocaleDateString()
                      : '—'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setDetailModal({ isOpen: false, loading: false, data: null })}
                className="w-8 h-8 rounded-xl bg-[#1a253d] hover:bg-[#253456] text-slate-300 flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            {detailModal.loading ? (
              <div className="p-16 text-center text-slate-400">
                <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm font-semibold">Loading complete user performance history...</p>
              </div>
            ) : detailModal.data ? (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Performance KPIs Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="bg-[#121c33] border border-[#213154] p-4 rounded-2xl">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Attempts</span>
                    <p className="text-2xl font-black text-white mt-1">
                      {detailModal.data.stats?.totalAttempts || 0}
                    </p>
                  </div>
                  <div className="bg-[#121c33] border border-[#213154] p-4 rounded-2xl">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Completed</span>
                    <p className="text-2xl font-black text-emerald-400 mt-1">
                      {detailModal.data.stats?.completedAttempts || 0}
                    </p>
                  </div>
                  <div className="bg-[#121c33] border border-[#213154] p-4 rounded-2xl">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Live Active</span>
                    <p className="text-2xl font-black text-amber-400 mt-1">
                      {detailModal.data.stats?.activeAttempts || 0}
                    </p>
                  </div>
                  <div className="bg-[#121c33] border border-[#213154] p-4 rounded-2xl">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Accuracy Rate</span>
                    <p className="text-2xl font-black text-sky-400 mt-1">
                      {detailModal.data.stats?.accuracyPercent || 0}%
                    </p>
                  </div>
                  <div className="bg-[#121c33] border border-[#213154] p-4 rounded-2xl col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Sets Created</span>
                    <p className="text-2xl font-black text-purple-400 mt-1">
                      {detailModal.data.stats?.totalSets || 0}
                    </p>
                  </div>
                </div>

                {/* Tabs Bar */}
                <div className="flex bg-[#0b1325] border border-[#1f2c4b] p-1 rounded-xl">
                  <button
                    onClick={() => setActiveTab('attempts')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition flex-1 sm:flex-initial ${
                      activeTab === 'attempts'
                        ? 'bg-purple-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Past Performances & Tests ({detailModal.data.attempts?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveTab('sets')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition flex-1 sm:flex-initial ${
                      activeTab === 'sets'
                        ? 'bg-purple-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Authored Question Sets ({detailModal.data.questionSets?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveTab('submissions')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition flex-1 sm:flex-initial ${
                      activeTab === 'submissions'
                        ? 'bg-purple-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Submissions Log ({detailModal.data.recentSubmissions?.length || 0})
                  </button>
                </div>

                {/* TAB 1: PAST PERFORMANCES & ATTEMPTS */}
                {activeTab === 'attempts' && (
                  <div className="space-y-3">
                    {detailModal.data.attempts?.length === 0 ? (
                      <div className="bg-[#121c33] border border-[#213154] rounded-2xl p-10 text-center">
                        <p className="text-slate-400 text-xs font-semibold">
                          This user has not attempted any assessments yet.
                        </p>
                      </div>
                    ) : (
                      detailModal.data.attempts.map((att) => {
                        const totalProbs = att.questionSetId?.problems?.length || 0;
                        const acSubs = (att.submissions || []).filter((s) => s.verdict === 'AC');
                        const uniqueAcCount = new Set(
                          acSubs.map((s) => (s.problemId?._id || s.problemId)?.toString())
                        ).size;
                        const isLive = att.status === 'in_progress';
                        const isStopped = att.status === 'stopped_by_admin' || att.stoppedByAdmin;

                        return (
                          <div
                            key={att._id}
                            className={`bg-[#121c33] border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${
                              isLive
                                ? 'border-emerald-500/60 bg-emerald-950/20'
                                : 'border-[#213154] hover:border-slate-500'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h4 className="text-white font-bold text-sm truncate">
                                  {att.questionSetId?.name || 'Assessment Session'}
                                </h4>

                                {isLive ? (
                                  <span className="flex items-center gap-1 text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                    Live In-Progress
                                  </span>
                                ) : isStopped ? (
                                  <span className="text-[10px] font-extrabold uppercase bg-rose-950/80 text-rose-300 border border-rose-600 px-2 py-0.5 rounded-full">
                                    🛑 Stopped by Admin
                                  </span>
                                ) : att.status === 'completed' ? (
                                  <span className="text-[10px] font-extrabold uppercase bg-blue-500/20 text-blue-400 border border-blue-500/40 px-2 py-0.5 rounded-full">
                                    ✓ Completed
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-extrabold uppercase bg-rose-500/20 text-rose-400 border border-rose-500/40 px-2 py-0.5 rounded-full">
                                    ⏱ Timed Out
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-slate-400 font-mono flex items-center gap-2 flex-wrap">
                                <span>Mode: {att.timingMode}</span>
                                <span>•</span>
                                <span>
                                  Solved: <strong className="text-emerald-400">{uniqueAcCount}</strong> / {totalProbs} Problems AC
                                </span>
                                <span>•</span>
                                <span>{new Date(att.startedAt).toLocaleString()}</span>
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {isLive ? (
                                <Link
                                  to="/admin/attempts"
                                  className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl transition shadow flex items-center gap-1"
                                >
                                  <span>👁️</span> Monitor Live →
                                </Link>
                              ) : (
                                <Link
                                  to={`/review/${att._id}`}
                                  className="text-xs bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1.5 rounded-xl transition shadow"
                                >
                                  Full Review ↗
                                </Link>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* TAB 2: AUTHORED QUESTION SETS */}
                {activeTab === 'sets' && (
                  <div className="space-y-3">
                    {detailModal.data.questionSets?.length === 0 ? (
                      <div className="bg-[#121c33] border border-[#213154] rounded-2xl p-10 text-center">
                        <p className="text-slate-400 text-xs font-semibold">
                          This user has not created or uploaded any question sets.
                        </p>
                      </div>
                    ) : (
                      detailModal.data.questionSets.map((s) => (
                        <div
                          key={s._id}
                          className="bg-[#121c33] border border-[#213154] rounded-2xl p-4 flex items-center justify-between gap-4"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-white font-bold text-sm truncate">{s.name}</h4>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  s.isPublished
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}
                              >
                                {s.isPublished ? 'Published' : 'Draft'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 font-mono">
                              Category: {s.category} · {s.problems?.length || 0} Problems · Mode: {s.timingMode} · Created{' '}
                              {new Date(s.createdAt).toLocaleDateString()}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Link
                              to={`/sets/${s._id}`}
                              className="text-xs bg-[#18233a] hover:bg-[#223356] border border-[#27395e] text-slate-300 hover:text-white px-3 py-1.5 rounded-xl transition"
                            >
                              View
                            </Link>
                            <Link
                              to={`/admin/questionsets/${s._id}/edit`}
                              className="text-xs bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1.5 rounded-xl transition shadow"
                            >
                              Edit Set
                            </Link>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* TAB 3: RECENT SUBMISSIONS */}
                {activeTab === 'submissions' && (
                  <div className="space-y-2">
                    {detailModal.data.recentSubmissions?.length === 0 ? (
                      <div className="bg-[#121c33] border border-[#213154] rounded-2xl p-10 text-center">
                        <p className="text-slate-400 text-xs font-semibold">No code submissions on record.</p>
                      </div>
                    ) : (
                      detailModal.data.recentSubmissions.map((sub, idx) => (
                        <div
                          key={sub._id || idx}
                          className="bg-[#121c33] border border-[#213154] rounded-xl p-3 flex items-center justify-between text-xs"
                        >
                          <div className="min-w-0">
                            <p className="text-white font-bold truncate">
                              {sub.problemId?.title || 'Coding Problem'}
                            </p>
                            <p className="text-[11px] text-slate-400 font-mono">
                              Language: <span className="uppercase text-slate-300">{sub.language}</span> ·{' '}
                              {new Date(sub.submittedAt).toLocaleString()}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span
                              className={`font-mono font-black text-xs px-2.5 py-0.5 rounded ${
                                sub.verdict === 'AC'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                                  : 'bg-rose-950 text-rose-300 border border-rose-600'
                              }`}
                            >
                              {sub.verdict}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {sub.passedTests}/{sub.totalTests} tests
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
