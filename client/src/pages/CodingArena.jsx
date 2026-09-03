import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import toast from 'react-hot-toast';
import { getProblem } from '../api/problems';
import { getQuestionSet } from '../api/questionsets';
import { submitCode, getSubmission, mySubmissions } from '../api/submissions';
import { endAttempt, getAttempt } from '../api/attempts';
import Timer from '../components/Timer';
import VerdictBadge from '../components/VerdictBadge';
import DifficultyChip from '../components/DifficultyChip';
import ModalConfirm from '../components/ModalConfirm';

const STARTERS = {
  java: (title) => `import java.util.*;\nimport java.io.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write your solution here\n    }\n}\n`,
  cpp: () => `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    // Write your solution here\n    return 0;\n}\n`,
};

export default function CodingArena() {
  const { attemptId, problemId } = useParams();
  const navigate = useNavigate();

  const [problem, setProblem] = useState(null);
  const [questionSet, setQuestionSet] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [allProblems, setAllProblems] = useState([]);
  
  // Editor & Submission State
  const [lang, setLang] = useState('cpp');
  const [code, setCode] = useState(STARTERS.cpp());
  const [activeTab, setActiveTab] = useState('problem'); // 'problem' | 'results' | 'submissions'
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState(null);
  const [submissionsList, setSubmissionsList] = useState([]);
  const [selectedSubView, setSelectedSubView] = useState(null);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef(null);

  // Question Map & Assessment State
  const [markedForReview, setMarkedForReview] = useState({}); // { [problemId]: boolean }
  const [answeredProblems, setAnsweredProblems] = useState({}); // { [problemId]: boolean }
  const [selectedMcqAnswers, setSelectedMcqAnswers] = useState({}); // { [problemId]: string }
  const [activeSection, setActiveSection] = useState('All');

  // Load Attempt and Question Set metadata
  useEffect(() => {
    getAttempt(attemptId)
      .then(r => {
        const att = r.data.statusCode?.attempt;
        setAttempt(att);
        if (att?.questionSetId) {
          getQuestionSet(att.questionSetId._id || att.questionSetId).then(setRes => {
            const qs = setRes.data.statusCode?.set;
            setQuestionSet(qs);
            setAllProblems(qs?.problems || []);
          });
        }
      })
      .catch(err => {
        console.error(err);
        toast.error('Failed to load attempt details');
      });

    // Fetch answered problems for THIS attempt session only
    mySubmissions({ attemptId })
      .then(res => {
        const subs = res.data.statusCode?.submissions || [];
        const ansMap = {};
        subs.forEach(s => {
          const pid = (s.problemId?._id || s.problemId)?.toString();
          if (pid) ansMap[pid] = true;
        });
        setAnsweredProblems(ansMap);
      })
      .catch(console.error);
  }, [attemptId]);

  // Code Draft Persistence (Auto-saves user code per problem in current attempt)
  const getDraftCode = useCallback((pId, currentLang) => {
    try {
      return sessionStorage.getItem(`draft_${attemptId}_${pId}_${currentLang}`);
    } catch {
      return null;
    }
  }, [attemptId]);

  const saveDraftCode = useCallback((pId, currentLang, val) => {
    try {
      if (val !== undefined && val !== null) {
        sessionStorage.setItem(`draft_${attemptId}_${pId}_${currentLang}`, val);
      }
    } catch {}
  }, [attemptId]);

  // Load Problem Data & Current Attempt Submissions for THIS problem
  const loadSubmissions = useCallback(async () => {
    try {
      const res = await mySubmissions({ problemId, attemptId });
      const subs = res.data.statusCode?.submissions || [];
      setSubmissionsList(subs);
      
      // Separate test results per question: load latest submission for this problem
      if (subs.length > 0) {
        setSubmission(subs[0]);
        // If no typed draft exists, preload latest submitted code for this question
        const draft = getDraftCode(problemId, lang);
        if (!draft && subs[0].code) {
          setCode(subs[0].code);
          if (subs[0].language) setLang(subs[0].language);
        }
      } else {
        setSubmission(null);
      }

      if (subs.some(s => s.verdict === 'AC' || s.verdict === 'WA')) {
        setAnsweredProblems(prev => ({ ...prev, [problemId]: true }));
      }
    } catch (err) {
      console.error(err);
    }
  }, [problemId, attemptId, lang, getDraftCode]);

  useEffect(() => {
    setActiveTab('problem');
    setSelectedSubView(null);

    getProblem(problemId).then(r => {
      const p = r.data.statusCode?.problem;
      setProblem(p);

      // Preload saved draft code or fallback to starter template
      const draft = getDraftCode(problemId, lang);
      if (draft) {
        setCode(draft);
      } else {
        const customStarter = p?.starterCode?.[lang];
        setCode(customStarter || STARTERS[lang](p?.title || 'Solution'));
      }

      if (p?.category) setActiveSection(p.category);
    }).catch(() => {
      toast.error('Failed to load problem statement');
    });
    
    loadSubmissions();
  }, [problemId, lang, getDraftCode, loadSubmissions]);

  // Sections Grouping
  const sections = useMemo(() => {
    const map = {};
    allProblems.forEach(p => {
      const sec = p.category || p.section || questionSet?.category || 'General';
      if (!map[sec]) map[sec] = [];
      map[sec].push(p);
    });
    return Object.entries(map).map(([name, probs]) => ({ name, problems: probs }));
  }, [allProblems, questionSet]);

  const currentIndex = allProblems.findIndex(p => (p._id || p) === problemId);
  const currentQNum = currentIndex >= 0 ? currentIndex + 1 : 1;
  const isMarked = !!markedForReview[problemId];

  // Answered / Marked / Unanswered counters
  const answeredCount = Object.keys(answeredProblems).length;
  const markedCount = Object.keys(markedForReview).filter(k => markedForReview[k]).length;
  const unansweredCount = Math.max(0, allProblems.length - answeredCount);

  const toggleMarkForReview = () => {
    const willMark = !markedForReview[problemId];
    setMarkedForReview(prev => ({ ...prev, [problemId]: willMark }));
    if (willMark) {
      toast('Question marked for review 🔖', { icon: '🔖' });
    } else {
      toast('Question unmarked from review', { icon: '⚪' });
    }
  };

  const handleSelectMcq = (option) => {
    setSelectedMcqAnswers(prev => ({ ...prev, [problemId]: option }));
    setAnsweredProblems(prev => ({ ...prev, [problemId]: true }));
    toast.success(`Option ${option} selected`);
  };

  const changeLang = (newLang) => {
    setLang(newLang);
    const customStarter = problem?.starterCode?.[newLang];
    setCode(customStarter || STARTERS[newLang](problem?.title || 'Solution'));
    toast(`Switched to ${newLang === 'cpp' ? 'C++' : 'Java'}`);
  };

  const pollSubmission = useCallback((subId) => {
    setPolling(true);
    let tries = 0;
    const toastId = toast.loading(
      <div className="flex items-center gap-3 py-1 px-1">
        <span className="text-2xl animate-spin">⚡</span>
        <div>
          <p className="font-extrabold text-white text-base tracking-tight">Evaluating Solution...</p>
          <p className="text-xs text-sky-400 font-mono font-medium mt-0.5">Running code against full test suite</p>
        </div>
      </div>,
      {
        style: {
          minWidth: '340px',
          padding: '16px 20px',
          background: '#0d1527',
          border: '1.5px solid #38bdf8',
          color: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(56, 189, 248, 0.3)',
        },
      }
    );

    const id = setInterval(async () => {
      tries++;
      try {
        const res = await getSubmission(subId);
        const sub = res.data.statusCode?.submission;
        if (sub.status === 'done' || sub.status === 'error' || tries > 30) {
          clearInterval(id);
          setPolling(false);
          setSubmission(sub);
          setActiveTab('results');
          setAnsweredProblems(prev => ({ ...prev, [problemId]: true }));
          loadSubmissions();

          if (sub.verdict === 'AC') {
            toast.success(`Accepted! All ${sub.totalTests} test cases passed!`, { id: toastId });
          } else if (sub.verdict === 'WA') {
            toast.error(`Wrong Answer (${sub.passedTests}/${sub.totalTests} passed)`, { id: toastId });
          } else if (sub.verdict === 'TLE') {
            toast.error(`Time Limit Exceeded (${sub.passedTests}/${sub.totalTests} passed)`, { id: toastId });
          } else if (sub.verdict === 'CE') {
            toast.error('Compilation Error — check diagnostics output', { id: toastId });
          } else {
            toast.error(`Verdict: ${sub.verdict}`, { id: toastId });
          }
        }
      } catch {
        clearInterval(id);
        setPolling(false);
        toast.error('Error fetching evaluation result', { id: toastId });
      }
    }, 1200);
    pollRef.current = id;
    return () => clearInterval(id);
  }, [problemId, loadSubmissions]);

  const handleSubmit = useCallback(async () => {
    if (!code.trim()) {
      toast.error('Please write some code before submitting');
      return;
    }
    setActiveTab('results');
    setSelectedSubView(null);
    setSubmitting(true);
    setSubmission(null);
    try {
      const res = await submitCode({
        problemId,
        questionSetId: attempt?.questionSetId?._id || attempt?.questionSetId,
        attemptId,
        language: lang,
        code,
      });
      const subId = res.data.statusCode?.submissionId;
      pollSubmission(subId);
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit code');
    } finally {
      setSubmitting(false);
    }
  }, [code, problemId, attempt, attemptId, lang, pollSubmission]);

  // Keyboard Shortcuts: Cmd + Enter OR Cmd + ' -> Run Code & Switch to Test Results
  useEffect(() => {
    const handleShortcut = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'Enter' || e.key === "'")) {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleShortcut, true);
    return () => window.removeEventListener('keydown', handleShortcut, true);
  }, [handleSubmit]);

  const handleTimerExpire = async () => {
    toast.error("⏱ Time's up! Submitting assessment...");
    try { await endAttempt(attemptId, true); } catch {}
    navigate(`/review/${attemptId}`, { state: { timedOut: true } });
  };

  const [isEndModalOpen, setIsEndModalOpen] = useState(false);

  const handleEndAttempt = () => {
    setIsEndModalOpen(true);
  };

  const handleNextProblem = () => {
    if (currentIndex < allProblems.length - 1) {
      const nextP = allProblems[currentIndex + 1];
      navigate(`/attempt/${attemptId}/problem/${nextP._id || nextP}`);
    } else {
      handleEndAttempt();
    }
  };

  const handlePrevProblem = () => {
    if (currentIndex > 0) {
      const prevP = allProblems[currentIndex - 1];
      navigate(`/attempt/${attemptId}/problem/${prevP._id || prevP}`);
    }
  };

  const handleLoadCode = (sub) => {
    if (sub.language) setLang(sub.language);
    setCode(sub.code);
    setActiveTab('problem');
    toast.success('Previous code loaded into editor');
  };

  const attemptConfig = useMemo(() => {
    try {
      const stored = sessionStorage.getItem(`attempt_config_${attemptId}`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, [attemptId]);

  const activeTimerSeconds = useMemo(() => {
    const isPerProblem = (attemptConfig?.timerMode === 'per_problem') || (attempt?.timingMode === 'per_problem') || (questionSet?.timingMode === 'per_problem');
    if (isPerProblem) {
      const customMins = attemptConfig?.customQuestionTimes?.[problemId];
      if (customMins) return customMins * 60;
      if (problem?.timeLimit) return problem.timeLimit;
      return 900;
    }
    return attemptConfig?.totalTimeLimit || attempt?.totalTimeLimit || questionSet?.totalTimeLimit || 3600;
  }, [attemptConfig, attempt, questionSet, problem, problemId]);

  if (!problem) {
    return (
      <div className="min-h-screen bg-[#0b132b] flex items-center justify-center text-white">
        <div className="animate-pulse text-sky-400 font-semibold">Loading Test Environment...</div>
      </div>
    );
  }

  const hasMcqOptions = problem.options || problem.optionA;
  const visibleTestCases = problem.testCases?.filter(tc => !tc.isHidden) || [];

  return (
    <div className="h-screen bg-[#0b132b] text-slate-100 flex flex-col overflow-hidden font-sans select-none">
      
      {/* TOP HEADER BAR MATCHING SCREENSHOT 3 */}
      <div className="bg-[#11192e] border-b border-[#1f2c4b] px-6 py-2.5 flex items-center justify-between flex-shrink-0 z-20">
        
        {/* Left: Test Name & Section Breadcrumb */}
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-white text-sm font-extrabold tracking-tight">
              {questionSet?.name || 'Assessment Test'}
            </h1>
            <p className="text-[10px] text-sky-400 font-bold uppercase tracking-wider">
              {(problem.category || 'DSA').toUpperCase()} · Q{currentQNum}/{allProblems.length || 1}
            </p>
          </div>
        </div>

        {/* Center: PROMINENT LIVE TIMER PILL */}
        <div className="flex items-center justify-center">
          <div className="bg-[#080d1a] border border-sky-500/50 shadow-lg shadow-sky-950/50 px-5 py-1.5 rounded-full flex items-center gap-2">
            <Timer
              key={`${problemId}_${activeTimerSeconds}`}
              totalSeconds={activeTimerSeconds}
              onExpire={handleTimerExpire}
              className="text-white text-base tracking-wider"
            />
          </div>
        </div>

        {/* Right: Section Indicators & End Action */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-1.5">
            {sections.map((sec, idx) => (
              <span
                key={sec.name}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition ${
                  (problem.category || 'General') === sec.name
                    ? 'bg-purple-600 text-white border-purple-500 shadow'
                    : 'bg-[#18223a] text-slate-400 border-[#243352]'
                }`}
              >
                {idx + 1}. {sec.name}
              </span>
            ))}
          </div>

          <button
            onClick={handleEndAttempt}
            className="text-xs bg-red-950/70 hover:bg-red-900 border border-red-800 text-red-200 font-bold px-4 py-1.5 rounded-xl transition shadow"
          >
            Submit Test
          </button>
        </div>

      </div>

      {/* MAIN BODY: SIDEBAR (LEFT) + ARENA (RIGHT) */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* LEFT SIDEBAR: SECTION LIST & QUESTION MAP */}
        <div className="w-64 bg-[#0d1527] border-r border-[#1f2c4b] flex flex-col justify-between overflow-hidden flex-shrink-0">
          
          <div className="p-4 overflow-y-auto space-y-6">
            
            {/* Current Section Title */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                SECTION LIST
              </span>
              <div className="space-y-1.5">
                {sections.map((sec, idx) => {
                  const isCurrent = (problem.category || 'General') === sec.name;
                  return (
                    <div
                      key={sec.name}
                      className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between border transition ${
                        isCurrent
                          ? 'bg-purple-950/60 border-purple-700/80 text-purple-200 shadow'
                          : 'bg-[#11192e] border-[#1e2a47] text-slate-400'
                      }`}
                    >
                      <span className="truncate">{idx + 1}. {sec.name}</span>
                      <span>{isCurrent ? '▶' : '•'}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* QUESTION MAP GRID */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2.5">
                QUESTION MAP
              </span>
              <div className="grid grid-cols-5 gap-2">
                {allProblems.map((p, idx) => {
                  const pId = p._id || p;
                  const isActive = pId === problemId;
                  const isAns = !!answeredProblems[pId];
                  const isMrk = !!markedForReview[pId];

                  return (
                    <button
                      key={pId || idx}
                      type="button"
                      onClick={() => navigate(`/attempt/${attemptId}/problem/${pId}`)}
                      className={`w-9 h-9 rounded-xl text-xs font-bold transition flex items-center justify-center relative border ${
                        isActive
                          ? 'bg-purple-600 text-white border-purple-400 ring-2 ring-purple-400/50 shadow-md'
                          : isAns
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600'
                          : isMrk
                          ? 'bg-amber-950/80 text-amber-300 border-amber-600'
                          : 'bg-[#11192e] text-slate-300 border-[#1e2a47] hover:border-slate-500'
                      }`}
                    >
                      {idx + 1}
                      {isMrk && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-1 ring-black"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* SIDEBAR FOOTER: STATS LEGEND & SUBMIT SECTION BUTTON */}
          <div className="p-4 bg-[#11192e] border-t border-[#1f2c4b] space-y-3">
            <div className="space-y-1 text-[11px] font-mono">
              <div className="flex items-center justify-between text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Answered
                </span>
                <span className="font-bold">{answeredCount}</span>
              </div>
              <div className="flex items-center justify-between text-amber-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span> Marked
                </span>
                <span className="font-bold">{markedCount}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-600"></span> Unanswered
                </span>
                <span className="font-bold">{unansweredCount}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleNextProblem}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-2.5 rounded-xl transition shadow-lg shadow-purple-950/50 flex items-center justify-center gap-1"
            >
              {currentIndex < allProblems.length - 1 ? 'Save & Next →' : 'Submit Assessment →'}
            </button>
          </div>

        </div>

        {/* RIGHT MAIN PANEL: PROBLEM DETAILS & CODING INTERFACE */}
        <div className="flex-1 flex overflow-hidden bg-[#080d1a]">
          
          {/* PROBLEM / RESULTS / SUBMISSIONS LEFT HALF */}
          <div className={`${hasMcqOptions ? 'w-full' : 'w-[45%]'} border-r border-[#1f2c4b] flex flex-col overflow-hidden bg-[#0d1527]`}>
            
            {/* Sub-Header Tabs */}
            <div className="flex items-center justify-between border-b border-[#1f2c4b] bg-[#11192e] px-4 py-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="bg-purple-950/80 border border-purple-700 text-purple-300 font-extrabold text-xs px-2.5 py-1 rounded-lg">
                  Q{currentQNum} / {allProblems.length}
                </span>

                <button
                  onClick={() => { setActiveTab('problem'); setSelectedSubView(null); }}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                    activeTab === 'problem' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  📄 Problem
                </button>

                {!hasMcqOptions && (
                  <>
                    <button
                      onClick={() => { setActiveTab('results'); setSelectedSubView(null); }}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                        activeTab === 'results' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      📊 Test Results
                      {submission && <VerdictBadge verdict={submission.verdict} />}
                    </button>

                    <button
                      onClick={() => { setActiveTab('submissions'); setSelectedSubView(null); }}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                        activeTab === 'submissions' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      🕒 Submissions ({submissionsList.length})
                    </button>
                  </>
                )}
              </div>

              {/* Mark for Review Button */}
              <button
                type="button"
                onClick={toggleMarkForReview}
                className={`text-xs font-bold px-3 py-1 rounded-lg border transition flex items-center gap-1.5 ${
                  isMarked
                    ? 'bg-amber-500 text-slate-900 border-amber-400 font-extrabold shadow'
                    : 'bg-[#18223a] text-slate-300 border-[#2a3656] hover:text-white'
                }`}
              >
                <span>🔖</span> {isMarked ? 'Marked' : 'Mark for Review'}
              </button>
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-700">
              
              {/* TAB 1: PROBLEM STATEMENT */}
              {activeTab === 'problem' && (
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <DifficultyChip difficulty={problem.difficulty} />
                      <span className="text-xs text-slate-400 bg-[#18223a] border border-[#243352] px-2.5 py-0.5 rounded-full font-mono">
                        {problem.category}
                      </span>
                    </div>
                    <h2 className="text-xl font-extrabold text-white mb-3">{problem.title}</h2>
                    <p className="text-slate-300 leading-relaxed whitespace-pre-wrap text-sm">
                      {problem.description}
                    </p>
                  </div>

                  {/* MCQ Options If Available */}
                  {hasMcqOptions && (
                    <div className="space-y-3 pt-4">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                        Select Option
                      </label>
                      <div className="space-y-2.5">
                        {['A', 'B', 'C', 'D'].map(opt => {
                          const optText = problem[`option${opt}`] || (problem.options && problem.options[opt.charCodeAt(0) - 65]) || `Option ${opt}`;
                          const isSelected = selectedMcqAnswers[problemId] === opt;

                          return (
                            <div
                              key={opt}
                              onClick={() => handleSelectMcq(opt)}
                              className={`p-4 rounded-xl border text-sm cursor-pointer transition flex items-center justify-between ${
                                isSelected
                                  ? 'bg-purple-950/70 border-purple-500 text-white font-bold ring-1 ring-purple-500/50 shadow'
                                  : 'bg-[#11192e] border-[#1e2a47] text-slate-300 hover:border-slate-500'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                                  isSelected ? 'bg-purple-600 text-white' : 'bg-[#18223a] text-slate-400'
                                }`}>
                                  {opt}
                                </span>
                                <span>{optText}</span>
                              </div>
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                isSelected ? 'border-purple-400 bg-purple-500' : 'border-slate-600'
                              }`}>
                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Constraints */}
                  {problem.constraints && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Constraints
                      </h4>
                      <pre className="text-xs font-mono text-slate-200 bg-[#080d1a] border border-[#1e2a47] rounded-xl p-3.5 whitespace-pre-wrap leading-relaxed">
                        {problem.constraints}
                      </pre>
                    </div>
                  )}

                  {/* Examples */}
                  {problem.examples?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                        Examples
                      </h4>
                      <div className="space-y-3">
                        {problem.examples.map((ex, i) => (
                          <div key={i} className="bg-[#11192e] border border-[#1e2a47] rounded-xl p-4 space-y-1.5">
                            <p className="text-xs font-bold text-sky-400 mb-1">Example {i + 1}</p>
                            <p className="text-xs font-mono text-slate-300">
                              <span className="text-slate-500 font-sans">Input:</span> <code className="text-emerald-400">{ex.input}</code>
                            </p>
                            <p className="text-xs font-mono text-slate-300">
                              <span className="text-slate-500 font-sans">Output:</span> <code className="text-sky-400">{ex.output}</code>
                            </p>
                            {ex.explanation && (
                              <p className="text-xs text-slate-400 pt-1 border-t border-[#1e2a47]/50 mt-1">
                                <span className="font-semibold text-slate-500">Explanation:</span> {ex.explanation}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Visible Sample Test Cases with Expected Output */}
                  {visibleTestCases.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          Visible Test Cases ({visibleTestCases.length})
                        </h4>
                        <span className="text-[11px] text-slate-500 font-mono">
                          +{problem.testCases?.length - visibleTestCases.length} Hidden Cases
                        </span>
                      </div>
                      <div className="space-y-3">
                        {visibleTestCases.map((tc, i) => (
                          <div key={i} className="bg-[#11192e] border border-[#1e2a47] rounded-xl p-4 space-y-2 text-xs font-mono">
                            <p className="text-[11px] font-bold text-sky-400 mb-1">Visible Case #{i + 1}</p>
                            <div className="space-y-1 bg-[#080d1a] p-3 rounded-lg border border-[#1e2a47]">
                              <p><span className="text-slate-500 font-sans">Input:</span> <code className="text-slate-200">{tc.input}</code></p>
                              <p><span className="text-slate-500 font-sans">Expected Output:</span> <code className="text-emerald-400 font-bold">{tc.expectedOutput}</code></p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: DETAILED TEST RESULTS (VISIBLE: INPUT, EXPECTED, ACTUAL OUTPUT | HIDDEN: WORKING/NOT) */}
              {activeTab === 'results' && (
                <div className="space-y-6">
                  {polling && (
                    <div className="p-8 text-center bg-[#11192e] border border-[#1e2a47] rounded-2xl">
                      <div className="text-3xl mb-3 animate-bounce">⚡</div>
                      <p className="text-white font-bold text-base">Evaluating Code Against Test Suite...</p>
                      <p className="text-slate-400 text-xs mt-1">Comparing outputs on visible and hidden cases.</p>
                    </div>
                  )}

                  {!polling && !submission && (
                    <div className="p-8 text-center text-slate-500 text-xs bg-[#11192e] border border-[#1e2a47] rounded-2xl">
                      Click <strong className="text-emerald-400">▶ Run & Submit</strong> to run your code and inspect outputs here.
                    </div>
                  )}

                  {!polling && submission && (
                    <>
                      {/* Overall Verdict Banner */}
                      <div className="bg-[#11192e] border border-[#1e2a47] rounded-2xl p-5 shadow-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <VerdictBadge verdict={submission.verdict} />
                            <span className="text-white font-bold text-base">
                              {submission.verdict === 'AC' ? 'Accepted' : submission.verdict === 'WA' ? 'Wrong Answer' : submission.verdict === 'TLE' ? 'Time Limit Exceeded' : submission.verdict === 'CE' ? 'Compilation Error' : 'Runtime Error'}
                            </span>
                          </div>
                          <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                            submission.verdict === 'AC'
                              ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800'
                              : 'bg-rose-950/70 text-rose-300 border-rose-800'
                          }`}>
                            {submission.passedTests}/{submission.totalTests} passed
                          </span>
                        </div>

                        <div className="flex items-center gap-6 pt-2 border-t border-[#1e2a47] text-xs text-slate-400 font-mono">
                          {submission.runtime && <span>⏱ Runtime: <strong className="text-slate-200">{submission.runtime}ms</strong></span>}
                          {submission.memory && <span>💾 Memory: <strong className="text-slate-200">{(submission.memory / 1024).toFixed(1)} MB</strong></span>}
                          <span>🌐 Lang: <strong className="text-slate-200 uppercase">{submission.language}</strong></span>
                        </div>
                      </div>

                      {/* Compilation Error Output */}
                      {submission.compileError && (
                        <div>
                          <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2">
                            Compiler Output / Diagnostics
                          </h4>
                          <pre className="text-xs font-mono text-rose-300 bg-rose-950/30 border border-rose-800/50 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                            {submission.compileError}
                          </pre>
                        </div>
                      )}

                      {/* Test Case Breakdown: Visible (Expected vs Actual) vs Hidden (Working/Failed only) */}
                      {submission.testResults?.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Detailed Test Case Results ({submission.testResults.length})
                          </h4>

                          <div className="space-y-3">
                            {submission.testResults.map((tr, i) => {
                              const originalTc = problem.testCases?.[i];
                              const isHidden = tr.isHidden || originalTc?.isHidden;

                              // VISIBLE TEST CASE: Shows Input, Expected Output, and User's Output!
                              if (!isHidden) {
                                return (
                                  <div
                                    key={i}
                                    className={`p-4 rounded-xl border text-xs space-y-3 transition ${
                                      tr.passed
                                        ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-300'
                                        : 'bg-rose-950/20 border-rose-800/60 text-rose-300'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between font-bold">
                                      <span className="flex items-center gap-2">
                                        <span>{tr.passed ? '✓' : '✗'}</span>
                                        <span>Visible Test Case #{i + 1}</span>
                                        <span className={`text-[10px] px-2 py-0.2 rounded border ${
                                          tr.passed ? 'bg-emerald-900/40 border-emerald-700 text-emerald-300' : 'bg-rose-900/40 border-rose-700 text-rose-300'
                                        }`}>
                                          {tr.passed ? 'PASSED' : 'WRONG ANSWER'}
                                        </span>
                                      </span>
                                      {tr.time && <span className="font-mono text-slate-400">{tr.time}ms</span>}
                                    </div>

                                    {/* Input & Expected Output */}
                                    {originalTc && (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
                                        <div className="bg-[#080d1a] border border-[#1e2a47] p-2.5 rounded-lg">
                                          <span className="text-slate-500 font-sans block text-[11px]">Input:</span>
                                          <code className="text-slate-200">{originalTc.input}</code>
                                        </div>
                                        <div className="bg-[#080d1a] border border-[#1e2a47] p-2.5 rounded-lg">
                                          <span className="text-slate-500 font-sans block text-[11px]">Expected Output:</span>
                                          <code className="text-emerald-400 font-bold">{originalTc.expectedOutput}</code>
                                        </div>
                                      </div>
                                    )}

                                    {/* User's Actual Output */}
                                    <div className="bg-[#080d1a] border border-[#1e2a47] p-2.5 rounded-lg font-mono text-xs">
                                      <span className="text-slate-500 font-sans block text-[11px]">Your Output:</span>
                                      <code className={tr.passed ? 'text-emerald-300 font-bold' : 'text-rose-400 font-bold'}>
                                        {tr.stdout !== null && tr.stdout !== undefined && tr.stdout !== '' ? tr.stdout : '<no output produced>'}
                                      </code>
                                    </div>

                                    {tr.stderr && (
                                      <pre className="text-xs font-mono text-rose-400 bg-rose-950/40 p-2.5 rounded-lg border border-rose-800/40 whitespace-pre-wrap">
                                        {tr.stderr}
                                      </pre>
                                    )}
                                  </div>
                                );
                              }

                              // HIDDEN TEST CASE: ONLY tells if Working / Passed or Failed (Zero leak of data)
                              return (
                                <div
                                  key={i}
                                  className={`p-3.5 rounded-xl border text-xs flex items-center justify-between transition ${
                                    tr.passed
                                      ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                                      : 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 font-semibold">
                                    <span>{tr.passed ? '✓' : '✗'}</span>
                                    <span>🔒 Hidden Test Case #{i + 1}</span>
                                    <span className={`text-[10px] px-2 py-0.2 rounded border font-mono ${
                                      tr.passed
                                        ? 'bg-emerald-900/40 border-emerald-700 text-emerald-300'
                                        : 'bg-rose-900/40 border-rose-700 text-rose-300'
                                    }`}>
                                      {tr.passed ? 'WORKING / PASSED' : 'FAILED'}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-3 font-mono text-slate-400 text-xs">
                                    <span className="text-[11px] text-slate-500 italic font-sans">(Confidential OA Test)</span>
                                    {tr.time && <span>{tr.time}ms</span>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* TAB 3: SUBMISSIONS HISTORY */}
              {activeTab === 'submissions' && (
                <div className="space-y-4">
                  {selectedSubView ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-[#1e2a47]">
                        <button
                          onClick={() => setSelectedSubView(null)}
                          className="text-xs text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1"
                        >
                          &larr; Back to all submissions
                        </button>
                        <button
                          onClick={() => handleLoadCode(selectedSubView)}
                          className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow"
                        >
                          📥 Load into Editor
                        </button>
                      </div>

                      <div className="bg-[#11192e] border border-[#1e2a47] rounded-xl p-4 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <VerdictBadge verdict={selectedSubView.verdict} />
                          <span className="font-mono text-slate-300 uppercase">{selectedSubView.language}</span>
                          <span className="text-slate-500">·</span>
                          <span className="text-slate-400">{new Date(selectedSubView.submittedAt).toLocaleTimeString()}</span>
                        </div>
                        <span className="text-slate-400 font-mono font-semibold">
                          {selectedSubView.passedTests}/{selectedSubView.totalTests} passed
                        </span>
                      </div>

                      <pre className="bg-[#080d1a] border border-[#1e2a47] rounded-xl p-4 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed max-h-96">
                        {selectedSubView.code}
                      </pre>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          Past Submissions ({submissionsList.length})
                        </h3>
                        <button
                          onClick={() => {
                            loadSubmissions();
                            toast.success('Submissions refreshed');
                          }}
                          className="text-xs text-sky-400 hover:text-sky-300 font-semibold"
                        >
                          ↻ Refresh
                        </button>
                      </div>

                      {submissionsList.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 text-xs bg-[#11192e] border border-[#1e2a47] rounded-xl">
                          No submissions recorded for this problem yet.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {submissionsList.map((sub, idx) => (
                            <div
                              key={sub._id || idx}
                              onClick={() => setSelectedSubView(sub)}
                              className="bg-[#11192e] hover:bg-[#152038] border border-[#1e2a47] hover:border-sky-500/50 rounded-xl p-3.5 flex items-center justify-between text-xs cursor-pointer transition group"
                            >
                              <div className="flex items-center gap-3">
                                <VerdictBadge verdict={sub.verdict} />
                                <div>
                                  <p className="font-semibold text-white group-hover:text-sky-300 transition">
                                    {sub.verdict === 'AC' ? 'Accepted' : sub.verdict} · {sub.passedTests}/{sub.totalTests} passed
                                  </p>
                                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                    {new Date(sub.submittedAt).toLocaleTimeString()}
                                  </p>
                                </div>
                              </div>
                              <span className="text-sky-400 font-bold group-hover:translate-x-1 transition-transform">&rarr;</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* BOTTOM STEPPER NAV */}
            <div className="p-3.5 bg-[#11192e] border-t border-[#1f2c4b] flex items-center justify-between">
              <button
                type="button"
                onClick={handlePrevProblem}
                disabled={currentIndex === 0}
                className="bg-[#18223a] hover:bg-[#202d4d] disabled:opacity-40 border border-[#2a3656] text-slate-300 font-bold px-4 py-2 rounded-xl text-xs transition"
              >
                ← Previous
              </button>

              <button
                type="button"
                onClick={handleNextProblem}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2 rounded-xl text-xs transition shadow flex items-center gap-1.5"
              >
                {currentIndex < allProblems.length - 1 ? 'Save & Next →' : 'Submit Assessment →'}
              </button>
            </div>

          </div>

          {/* MONACO CODE EDITOR (RIGHT HALF) - only for coding problems */}
          {!hasMcqOptions && (
            <div className="flex-1 flex flex-col overflow-hidden bg-[#080d1a]">
              
              {/* Editor Header Bar */}
              <div className="bg-[#11192e] border-b border-[#1f2c4b] px-4 py-2 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Language:</span>
                  <select
                    value={lang}
                    onChange={e => changeLang(e.target.value)}
                    className="bg-[#080d1a] border border-[#232f48] text-white text-xs font-semibold px-3 py-1.5 rounded-lg focus:outline-none focus:border-sky-500 cursor-pointer"
                  >
                    <option value="cpp">C++ (GCC / Clang C++17)</option>
                    <option value="java">Java (OpenJDK)</option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || polling}
                    className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 text-white text-xs font-bold px-5 py-2 rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-950/40"
                  >
                    {submitting ? 'Submitting...' : polling ? '⚡ Judging...' : '▶ Run & Submit'}
                  </button>
                </div>
              </div>

              {/* Monaco Editor Container */}
              <div className="flex-1 overflow-hidden">
                <Editor
                  height="100%"
                  language={lang === 'cpp' ? 'cpp' : 'java'}
                  value={code}
                  onChange={v => {
                    const val = v || '';
                    setCode(val);
                    saveDraftCode(problemId, lang, val);
                  }}
                  theme="vs-dark"
                  options={{
                    fontSize: 14,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    lineNumbers: 'on',
                    folding: true,
                    automaticLayout: true,
                    tabSize: 4,
                    insertSpaces: true,
                    padding: { top: 16, bottom: 16 },
                    fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, 'Courier New', monospace",
                  }}
                />
              </div>
            </div>
          )}

        </div>

      </div>

      <ModalConfirm
        isOpen={isEndModalOpen}
        title="Submit & End Assessment?"
        message="Are you sure you want to end your test session? Your code and responses will be finalized for review."
        confirmText="End & View Results"
        cancelText="Continue Test"
        isDanger={true}
        onCancel={() => setIsEndModalOpen(false)}
        onConfirm={async () => {
          setIsEndModalOpen(false);
          try { await endAttempt(attemptId, false); } catch {}
          navigate(`/review/${attemptId}`);
        }}
      />
    </div>
  );
}
