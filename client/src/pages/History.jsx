import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { myAttempts, getAttempt, deleteAttempt } from '../api/attempts';
import Navbar from '../components/Navbar';
import Loader from '../components/Loader';
import VerdictBadge from '../components/VerdictBadge';
import DifficultyChip from '../components/DifficultyChip';

import ModalConfirm from '../components/ModalConfirm';
import { getDifficultyPoints, calculateAttemptScoreBreakdown } from '../utils/scoring';

export default function History() {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAttemptId, setSelectedAttemptId] = useState(null);
  const [attemptDetail, setAttemptDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedCodeView, setSelectedCodeView] = useState(null);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const location = useLocation();
  const timedOut = location.state?.timedOut;

  useEffect(() => {
    myAttempts()
      .then(r => setAttempts(r.data.statusCode?.attempts || []))
      .finally(() => setLoading(false));
  }, []);

  const handleSelectAttempt = async (attemptId) => {
    if (selectedAttemptId === attemptId) {
      setSelectedAttemptId(null);
      setAttemptDetail(null);
      setSelectedCodeView(null);
      return;
    }

    setSelectedAttemptId(attemptId);
    setLoadingDetail(true);
    setSelectedCodeView(null);
    try {
      const res = await getAttempt(attemptId);
      setAttemptDetail(res.data.statusCode?.attempt);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDelete = (e, attemptId) => {
    e.stopPropagation();
    setDeleteTargetId(attemptId);
  };

  const STATUS_BADGES = {
    completed: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60',
    timed_out: 'bg-rose-950/60 text-rose-400 border-rose-800/60',
    in_progress: 'bg-amber-950/60 text-amber-400 border-amber-800/60',
  };

  return (
    <div className="min-h-screen bg-[#0b132b] text-slate-100 font-sans pb-16">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 pt-8">
        
        {timedOut && (
          <div className="mb-6 bg-rose-950/50 border border-rose-800 text-rose-300 px-5 py-3.5 rounded-2xl text-sm flex items-center gap-2 shadow-lg">
            <span>⏱</span>
            <span>Time's up! Your assessment attempt was submitted automatically.</span>
          </div>
        )}

        <div className="flex items-center justify-between mb-8">
          <div>
            <span className="text-xs font-bold tracking-widest text-sky-400 uppercase">
              ATTEMPT LOGS & REVIEWS
            </span>
            <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1">
              Assessment History
            </h1>
          </div>
          <Link
            to="/dashboard"
            className="bg-[#18223a] hover:bg-[#202d4d] border border-[#2a3656] text-slate-300 text-sm font-medium px-4 py-2 rounded-xl transition"
          >
            ← Practice More
          </Link>
        </div>

        {loading ? <Loader /> : (
          <div className="space-y-4">
            {attempts.length === 0 && (
              <div className="p-12 text-center bg-[#11192e] border border-[#1e2a47] rounded-2xl">
                <div className="text-4xl mb-3">🎯</div>
                <h3 className="text-white font-bold text-lg mb-1">No Assessment Attempts Yet</h3>
                <p className="text-slate-400 text-sm mb-4">Pick a question set from the dashboard and test your coding skills!</p>
                <Link
                  to="/dashboard"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs inline-block transition"
                >
                  Go to Dashboard
                </Link>
              </div>
            )}

            {attempts.map(a => {
              const isSelected = selectedAttemptId === a._id;
              const setInfo = a.questionSetId;
              const subCount = a.submissions?.length || 0;

              return (
                <div
                  key={a._id}
                  className={`bg-[#11192e] border rounded-2xl overflow-hidden transition-all shadow-lg ${
                    isSelected ? 'border-sky-500/80 shadow-sky-950/40 ring-1 ring-sky-500/30' : 'border-[#1e2a47] hover:border-slate-600'
                  }`}
                >
                  {/* Attempt Card Header */}
                  <div
                    onClick={() => handleSelectAttempt(a._id)}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-bold text-base">{setInfo?.name || 'Question Set'}</h3>
                        <span className="text-[11px] font-semibold bg-sky-950/60 text-sky-400 border border-sky-800/60 px-2 py-0.5 rounded">
                          {setInfo?.category || 'General'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400 font-mono mt-1">
                        <span className="font-bold text-amber-300 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded">
                          🏆 Score: {a.score || 0} pts
                        </span>
                        <span>•</span>
                        <span>
                          Started: {new Date(a.startedAt).toLocaleDateString()} at {new Date(a.startedAt).toLocaleTimeString()} · {subCount} submission{subCount === 1 ? '' : 's'} made
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-semibold">
                      <span className={`px-3 py-1 rounded-full border text-xs capitalize ${
                        STATUS_BADGES[a.status] || 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {a.status?.replace('_', ' ')}
                      </span>

                      <div className="flex items-center gap-2">
                        <Link
                          to={`/review/${a._id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-1 shadow"
                        >
                          <span>📊</span> Full Review
                        </Link>
                        
                        {/* Delete Attempt Button */}
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, a._id)}
                          className="bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold text-xs px-3 py-1.5 rounded-xl transition shadow flex items-center gap-1"
                          title="Delete attempt record"
                        >
                          <span>🗑️</span> Delete
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectAttempt(a._id);
                          }}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-slate-700 text-white border-slate-600'
                              : 'bg-[#18223a] text-slate-300 border-[#2a3656] hover:text-white hover:bg-[#202d4d]'
                          }`}
                        >
                          <span>{isSelected ? '▲ Hide' : '▼ Quick View'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Attempt Review Panel */}
                  {isSelected && (
                    <div className="p-6 bg-[#0c1426] border-t border-[#1e2a47] space-y-6">
                      {loadingDetail ? (
                        <div className="p-8 text-center text-slate-400 text-xs animate-pulse">
                          Loading complete submission records and problem statements...
                        </div>
                      ) : attemptDetail ? (
                        <>
                          {/* Problems List in Set */}
                          <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                              Problems in Assessment ({attemptDetail.questionSetId?.problems?.length || 0})
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {attemptDetail.questionSetId?.problems?.map((p, idx) => {
                                const probSubs = attemptDetail.submissions?.filter(
                                  s => s.problemId === p._id || s.problemId?._id === p._id
                                ) || [];
                                const hasAC = probSubs.some(s => s.verdict === 'AC');
                                const latestSub = probSubs[0];

                                return (
                                  <div
                                    key={p._id || idx}
                                    className="bg-[#11192e] border border-[#1e2a47] rounded-xl p-4 flex flex-col justify-between space-y-3"
                                  >
                                    <div>
                                      <div className="flex items-center justify-between mb-1.5">
                                        <span className="font-bold text-sm text-white">{p.title}</span>
                                        <DifficultyChip difficulty={p.difficulty} />
                                      </div>
                                      <p className="text-xs text-slate-400 font-mono">
                                        {probSubs.length} submission{probSubs.length === 1 ? '' : 's'} · Status: {hasAC ? <span className="text-emerald-400 font-bold">Solved (AC)</span> : probSubs.length > 0 ? <span className="text-rose-400">Attempted</span> : <span className="text-slate-500">Unattempted</span>}
                                      </p>
                                    </div>

                                    <div className="pt-2 border-t border-[#1e2a47]/60 flex items-center justify-between text-xs">
                                      {latestSub ? (
                                        <button
                                          onClick={() => setSelectedCodeView(latestSub)}
                                          className="text-sky-400 hover:text-sky-300 font-semibold text-xs flex items-center gap-1"
                                        >
                                          🔍 View Code ({latestSub.verdict})
                                        </button>
                                      ) : (
                                        <span className="text-slate-500 text-[11px]">No code submitted</span>
                                      )}
                                      
                                      <Link
                                        to={`/attempt/${attemptDetail._id}/problem/${p._id}`}
                                        className="text-blue-400 hover:text-white font-semibold text-xs"
                                      >
                                        Open in Arena &rarr;
                                      </Link>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* All Submissions Log for this Attempt */}
                          <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                              All Submissions in this Attempt ({attemptDetail.submissions?.length || 0})
                            </h4>
                            
                            {attemptDetail.submissions?.length === 0 ? (
                              <div className="p-6 text-center text-slate-500 text-xs bg-[#11192e] rounded-xl border border-[#1e2a47]">
                                No code was submitted during this attempt session.
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {attemptDetail.submissions?.map((sub, i) => (
                                  <div
                                    key={sub._id || i}
                                    className="bg-[#11192e] border border-[#1e2a47] rounded-xl p-3.5 flex items-center justify-between text-xs"
                                  >
                                    <div className="flex items-center gap-3">
                                      <VerdictBadge verdict={sub.verdict} />
                                      <div>
                                        <span className="text-white font-mono font-bold uppercase">{sub.language}</span>
                                        <span className="text-slate-500 mx-2">·</span>
                                        <span className="text-slate-400">{sub.passedTests}/{sub.totalTests} test cases passed</span>
                                        <span className="text-slate-500 mx-2">·</span>
                                        <span className="text-slate-500 font-mono">{new Date(sub.submittedAt).toLocaleTimeString()}</span>
                                      </div>
                                    </div>

                                    <button
                                      onClick={() => setSelectedCodeView(sub)}
                                      className="text-sky-400 hover:text-white font-bold bg-[#18223a] border border-[#2a3656] px-3 py-1 rounded-lg transition"
                                    >
                                      View Code
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Code Inspector Modal / Box */}
                          {selectedCodeView && (
                            <div className="mt-4 bg-[#080d1a] border border-sky-600/50 rounded-2xl p-5 shadow-2xl">
                              <div className="flex items-center justify-between pb-3 border-b border-[#1e2a47] mb-3">
                                <div className="flex items-center gap-2">
                                  <VerdictBadge verdict={selectedCodeView.verdict} />
                                  <span className="text-xs font-bold text-white font-mono uppercase">
                                    Language: {selectedCodeView.language}
                                  </span>
                                  <span className="text-slate-500">·</span>
                                  <span className="text-xs text-slate-400">
                                    Submitted {new Date(selectedCodeView.submittedAt).toLocaleString()}
                                  </span>
                                </div>
                                <button
                                  onClick={() => setSelectedCodeView(null)}
                                  className="text-slate-400 hover:text-white font-bold text-sm"
                                >
                                  ✕ Close Code
                                </button>
                              </div>

                              <pre className="text-xs font-mono text-emerald-300 overflow-x-auto p-3 bg-[#050811] rounded-xl border border-[#1b2744] max-h-80 leading-relaxed">
                                {selectedCodeView.code}
                              </pre>

                              {selectedCodeView.compileError && (
                                <div className="mt-3">
                                  <p className="text-xs font-bold text-rose-400 uppercase mb-1">Compiler Diagnostics</p>
                                  <pre className="text-xs font-mono text-rose-300 bg-rose-950/30 border border-rose-900/50 p-3 rounded-xl whitespace-pre-wrap">
                                    {selectedCodeView.compileError}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ModalConfirm
        isOpen={!!deleteTargetId}
        title="Delete Attempt Record?"
        message="Are you sure you want to permanently delete this assessment attempt record? This action cannot be undone."
        confirmText="Delete Record"
        cancelText="Cancel"
        isDanger={true}
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={async () => {
          const idToDelete = deleteTargetId;
          setDeleteTargetId(null);
          const toastId = toast.loading('Deleting attempt...');
          try {
            await deleteAttempt(idToDelete);
            setAttempts(prev => prev.filter(item => item._id !== idToDelete));
            if (selectedAttemptId === idToDelete) setSelectedAttemptId(null);
            toast.success('Attempt record deleted', { id: toastId });
          } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete attempt', { id: toastId });
          }
        }}
      />
    </div>
  );
}
