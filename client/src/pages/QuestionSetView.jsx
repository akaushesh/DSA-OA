import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getQuestionSet } from '../api/questionsets';
import { startAttempt } from '../api/attempts';
import Navbar from '../components/Navbar';
import Loader from '../components/Loader';

const TIMER_PRESETS = [5, 10, 15, 20, 30, 45];

export default function QuestionSetView() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [set, setSet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  // Configuration State
  const [attemptMode, setAttemptMode] = useState('full'); // 'single' | 'full'
  const [selectedSection, setSelectedSection] = useState('All');
  const [timerMode, setTimerMode] = useState('global'); // 'global' | 'per_section'
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [customQuestionTimes, setCustomQuestionTimes] = useState({}); // { [problemId]: minutes }

  useEffect(() => {
    getQuestionSet(id)
      .then(r => {
        const s = r.data.statusCode?.set;
        setSet(s);
        if (s) {
          const defaultMins = Math.round((s.totalTimeLimit || 3600) / 60);
          setDurationMinutes(defaultMins || 60);
          if (s.timingMode === 'per_problem') setTimerMode('per_section');
          
          if (s.problems) {
            const initialMap = {};
            s.problems.forEach(p => {
              initialMap[p._id] = Math.round((p.timeLimit || 900) / 60);
            });
            setCustomQuestionTimes(initialMap);
          }
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [id]);

  // Extract unique sections / categories from the set
  const sections = useMemo(() => {
    if (!set?.problems) return [];
    const map = {};
    set.problems.forEach(p => {
      const sec = p.category || p.section || set.category || 'General';
      map[sec] = (map[sec] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [set]);

  const totalQuestions = set?.problems?.length || 0;

  // Questions to attempt based on section filter
  const activeQuestions = useMemo(() => {
    if (!set?.problems) return [];
    if (attemptMode === 'single' && selectedSection !== 'All') {
      return set.problems.filter(p => (p.category || p.section || set.category) === selectedSection);
    }
    return set.problems;
  }, [set, attemptMode, selectedSection]);

  const handleStartTest = async () => {
    if (!set || starting) return;
    setStarting(true);
    try {
      const res = await startAttempt(id);
      const attempt = res.data.statusCode?.attempt;
      
      // Save configuration settings in sessionStorage for this attempt
      const config = {
        attemptId: attempt._id,
        questionSetId: id,
        attemptMode,
        selectedSection,
        timerMode: attemptMode === 'full' ? (timerMode === 'per_section' ? 'per_problem' : 'collective') : 'collective',
        totalTimeLimit: durationMinutes * 60,
        customQuestionTimes,
        activeProblemIds: activeQuestions.map(p => p._id),
      };
      sessionStorage.setItem(`attempt_config_${attempt._id}`, JSON.stringify(config));

      const firstProblemId = activeQuestions[0]?._id || set.problems[0]?._id;
      navigate(`/attempt/${attempt._id}/problem/${firstProblemId}`);
    } catch (err) {
      console.error(err);
    } finally {
      setStarting(false);
    }
  };

  if (loading) return <Loader />;

  if (!set) {
    return (
      <div className="min-h-screen bg-[#0b132b] text-white flex flex-col items-center justify-center space-y-4">
        <p className="text-slate-400">Question set not found.</p>
        <Link to="/dashboard" className="text-sky-400 font-bold hover:underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b132b] text-slate-100 font-sans pb-20">
      <Navbar />

      <div className="max-w-2xl mx-auto px-6 pt-10">
        
        {/* CONFIGURE MODAL CARD */}
        <div className="bg-[#11192e] border border-[#1e2a47] rounded-3xl p-8 shadow-2xl space-y-7">
          
          {/* Header */}
          <div className="flex items-center gap-3.5 pb-2">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-sky-400 text-lg shadow-inner">
              ⏱
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">
                Configure Practice Test
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Set your preferences before starting
              </p>
            </div>
          </div>

          {/* Selected Question Bank Info Card */}
          <div className="bg-[#0c1426] border border-[#1e2a47] rounded-2xl p-5 space-y-2.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              SELECTED QUESTION BANK
            </span>
            <h2 className="text-xl font-bold text-white">
              {set.name}
            </h2>
            <div className="flex items-center gap-2 pt-1">
              <span className="bg-sky-950/70 border border-sky-800/70 text-sky-400 text-xs font-semibold px-3 py-1 rounded-lg">
                {totalQuestions} Questions
              </span>
              <span className="bg-purple-950/70 border border-purple-800/70 text-purple-300 text-xs font-semibold px-3 py-1 rounded-lg">
                {sections.length || 1} Sections
              </span>
            </div>
          </div>

          {/* ATTEMPT MODE SELECTION */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              ATTEMPT MODE
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Option 1: Single Section */}
              <button
                type="button"
                onClick={() => setAttemptMode('single')}
                className={`p-4 rounded-2xl border text-left transition ${
                  attemptMode === 'single'
                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-950/50'
                    : 'bg-[#0c1426] border-[#1e2a47] text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="font-bold text-sm">Single Section</div>
                <div className={`text-xs mt-1 ${attemptMode === 'single' ? 'text-blue-100' : 'text-slate-400'}`}>
                  Pick one section to attempt
                </div>
              </button>

              {/* Option 2: Full Mock Test */}
              <button
                type="button"
                onClick={() => setAttemptMode('full')}
                className={`p-4 rounded-2xl border text-left transition ${
                  attemptMode === 'full'
                    ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-950/50'
                    : 'bg-[#0c1426] border-[#1e2a47] text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="font-bold text-sm">Full Mock Test</div>
                <div className={`text-xs mt-1 ${attemptMode === 'full' ? 'text-purple-100' : 'text-slate-400'}`}>
                  All sections, one by one
                </div>
              </button>
            </div>
          </div>

          {/* MODE 1: SINGLE SECTION SELECTION */}
          {attemptMode === 'single' && (
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                SECTION
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSection('All')}
                  className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition ${
                    selectedSection === 'All'
                      ? 'bg-blue-600 border-blue-500 text-white shadow'
                      : 'bg-[#0c1426] border-[#1e2a47] text-slate-300 hover:text-white'
                  }`}
                >
                  All ({totalQuestions})
                </button>
                {sections.map(sec => (
                  <button
                    key={sec.name}
                    type="button"
                    onClick={() => setSelectedSection(sec.name)}
                    className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition ${
                      selectedSection === sec.name
                        ? 'bg-blue-600 border-blue-500 text-white shadow'
                        : 'bg-[#0c1426] border-[#1e2a47] text-slate-300 hover:text-white'
                    }`}
                  >
                    {sec.name} ({sec.count})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* MODE 2: FULL MOCK TEST TIMER MODE */}
          {attemptMode === 'full' && (
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                TIMER MODE
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTimerMode('global')}
                  className={`p-3.5 rounded-xl border text-left transition ${
                    timerMode === 'global'
                      ? 'bg-purple-600 border-purple-500 text-white shadow'
                      : 'bg-[#0c1426] border-[#1e2a47] text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-xs">Global Timer</div>
                  <div className={`text-[11px] mt-0.5 ${timerMode === 'global' ? 'text-purple-100' : 'text-slate-400'}`}>
                    One timer for the whole test
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTimerMode('per_section')}
                  className={`p-3.5 rounded-xl border text-left transition ${
                    timerMode === 'per_section'
                      ? 'bg-purple-600 border-purple-500 text-white shadow'
                      : 'bg-[#0c1426] border-[#1e2a47] text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-xs">Per-Section / Problem Timer</div>
                  <div className={`text-[11px] mt-0.5 ${timerMode === 'per_section' ? 'text-purple-100' : 'text-slate-400'}`}>
                    Each section has its own time
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* TIMER DURATION CONFIGURATION */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {attemptMode === 'full' ? (timerMode === 'per_section' ? 'INDIVIDUAL QUESTION & SECTION TIMERS' : 'TOTAL TEST DURATION') : 'TIMER DURATION'}
              </label>
              <span className="text-xs text-slate-400 font-mono">
                {timerMode === 'per_section' ? 'Set custom timer for each problem' : `~${Math.round((durationMinutes * 60) / Math.max(1, activeQuestions.length))}s per question`}
              </span>
            </div>

            {/* Presets if Global */}
            {timerMode !== 'per_section' && (
              <>
                <div className="grid grid-cols-6 gap-2">
                  {TIMER_PRESETS.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDurationMinutes(preset)}
                      className={`py-2 text-xs font-bold rounded-xl border transition ${
                        durationMinutes === preset
                          ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                          : 'bg-[#0c1426] border-[#1e2a47] text-slate-300 hover:border-slate-500 hover:text-white'
                      }`}
                    >
                      {preset}m
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="600"
                    value={durationMinutes}
                    onChange={e => setDurationMinutes(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-[#080d1a] border border-[#1e2a47] text-white text-sm font-bold rounded-xl px-4 py-3 focus:outline-none focus:border-sky-500 pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">
                    min
                  </span>
                </div>
              </>
            )}

            {/* Interactive Per-Section / Per-Question Timer Configuration */}
            {timerMode === 'per_section' && (
              <div className="bg-[#080d1a] border border-purple-900/50 rounded-2xl p-4 space-y-3">
                <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider block">
                  CUSTOM TIMERS PER QUESTION ({activeQuestions.length} QUESTIONS)
                </span>
                
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-700">
                  {activeQuestions.map((q, idx) => {
                    const pid = q._id;
                    const qMins = customQuestionTimes[pid] || Math.round((q.timeLimit || 900) / 60);

                    return (
                      <div
                        key={pid || idx}
                        className="bg-[#11192e] border border-[#1e2a47] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sky-400">Q{idx + 1}.</span>
                            <span className="font-semibold text-white truncate max-w-[200px]">{q.title}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 uppercase font-mono">{q.category || set.category}</span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {[5, 10, 15, 20, 30].map(presetMins => (
                            <button
                              key={presetMins}
                              type="button"
                              onClick={() => setCustomQuestionTimes(prev => ({ ...prev, [pid]: presetMins }))}
                              className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition ${
                                qMins === presetMins
                                  ? 'bg-purple-600 border-purple-500 text-white shadow'
                                  : 'bg-[#18223a] border-[#243352] text-slate-400 hover:text-white'
                              }`}
                            >
                              {presetMins}m
                            </button>
                          ))}

                          <div className="flex items-center bg-[#080d1a] border border-[#243352] rounded-lg px-2 py-0.5">
                            <input
                              type="number"
                              min="1"
                              max="180"
                              value={qMins}
                              onChange={e => {
                                const v = Math.max(1, Number(e.target.value));
                                setCustomQuestionTimes(prev => ({ ...prev, [pid]: v }));
                              }}
                              className="w-8 bg-transparent text-white font-bold text-center text-xs focus:outline-none"
                            />
                            <span className="text-[10px] text-slate-400 font-mono">m</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* MOCK TEST FLOW DIAGRAM (if Full Mock Mode) */}
          {attemptMode === 'full' && sections.length > 1 && (
            <div className="bg-[#0c1426] border border-purple-900/40 rounded-2xl p-4 space-y-2.5">
              <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider block">
                MOCK TEST FLOW
              </span>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {sections.map((sec, idx) => (
                  <div key={sec.name} className="flex items-center gap-2">
                    <span className="bg-purple-950/80 border border-purple-800 text-purple-300 font-semibold px-2.5 py-1 rounded-lg">
                      {idx + 1}. {sec.name}
                    </span>
                    {idx < sections.length - 1 && <span className="text-purple-400">→</span>}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Each section can be navigated or submitted in sequence.
              </p>
            </div>
          )}

          {/* BOTTOM ACTIONS */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="flex-1 bg-[#18223a] hover:bg-[#202d4d] border border-[#2a3656] text-slate-300 font-bold py-3.5 rounded-2xl text-xs md:text-sm transition text-center"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleStartTest}
              disabled={starting || activeQuestions.length === 0}
              className={`flex-1 font-extrabold py-3.5 rounded-2xl text-xs md:text-sm transition text-white shadow-lg active:scale-95 disabled:opacity-50 ${
                attemptMode === 'full'
                  ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-950/50'
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-950/50'
              }`}
            >
              {starting
                ? 'Starting Assessment...'
                : attemptMode === 'full'
                ? 'Start Full Mock Test'
                : 'Start Test'}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
