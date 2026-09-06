import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import toast from 'react-hot-toast';
import { getProblem } from '../api/problems';
import { getQuestionSet } from '../api/questionsets';
import { submitCode, getSubmission, mySubmissions } from '../api/submissions';
import { endAttempt, getAttempt, saveTimers } from '../api/attempts';
import VerdictBadge from '../components/VerdictBadge';
import DifficultyChip from '../components/DifficultyChip';
import ModalConfirm from '../components/ModalConfirm';
import { calculateProblemScore, getDifficultyPoints } from '../utils/scoring';
import { getProblemStarter } from '../utils/starterCode';

const STARTERS = {
  java: (title) => `import java.util.*;\nimport java.io.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write your solution here\n    }\n}\n`,
  cpp: () => `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    // Write your solution here\n    return 0;\n}\n`,
};

const isInvalidOrGenericDraft = (draftCode, currentLang, title, customStarter = '') => {
  if (!draftCode || typeof draftCode !== 'string') return true;
  const clean = (s) => (s || '').replace(/\r\n/g, '\n').trim();
  const d = clean(draftCode);
  if (!d) return true;
  if (d === clean(STARTERS.cpp())) return true;
  if (d === clean(STARTERS.java('Solution'))) return true;
  if (title && d === clean(STARTERS.java(title))) return true;
  if (customStarter && d === clean(customStarter)) return true;
  // If draft is for the wrong language (e.g. C++ in Java slot or vice versa)
  if (currentLang === 'java' && /#include\s*<|using\s+namespace\s+std/i.test(d)) return true;
  if (currentLang === 'cpp' && /import\s+java\.|public\s+class\s+/i.test(d)) return true;
  return false;
};

export default function CodingArena() {
  const { attemptId, problemId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // ponytail: practice mode activates when no attemptId is in the URL or attemptId is 'practice'
  const fromAttemptId = searchParams.get('fromAttempt');
  const isPractice = !attemptId || attemptId === 'practice';

  const [problem, setProblem] = useState(null);
  const [questionSet, setQuestionSet] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [allProblems, setAllProblems] = useState([]);
  
  // Editor & Submission State
  const [lang, setLang] = useState(() => {
    try {
      if (!isPractice && attemptId) {
        const attemptLang = sessionStorage.getItem(`attempt_lang_${attemptId}`);
        if (attemptLang === 'cpp' || attemptLang === 'java') return attemptLang;
        const configStr = sessionStorage.getItem(`attempt_config_${attemptId}`);
        if (configStr) {
          const config = JSON.parse(configStr);
          if (config.preferredLanguage === 'cpp' || config.preferredLanguage === 'java') {
            return config.preferredLanguage;
          }
        }
      }
      const userPref = localStorage.getItem('preferredLanguage');
      if (userPref === 'cpp' || userPref === 'java') return userPref;
    } catch {}
    return 'cpp';
  });
  const [code, setCode] = useState(() => STARTERS[lang] ? STARTERS[lang]() : STARTERS.cpp());
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

  // Per-problem timers — { [problemId]: secondsLeft }
  // Only the active problem ticks; others are frozen. Mirrors Apti-OA freeNavTimers.
  const [problemTimers, setProblemTimers] = useState({});

  const formatTime = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };

  const [adminStoppedModal, setAdminStoppedModal] = useState(false);

  // Layout Management State: Hideable Sidebar & Resizable Panes
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [splitPercent, setSplitPercent] = useState(() => {
    const saved = localStorage.getItem('oa_split_percent');
    return saved ? Math.min(75, Math.max(20, parseFloat(saved))) : 45;
  });
  const [isDragging, setIsDragging] = useState(false);
  const arenaContainerRef = useRef(null);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      if (!arenaContainerRef.current) return;
      const rect = arenaContainerRef.current.getBoundingClientRect();
      const newPercent = ((e.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(75, Math.max(20, newPercent));
      setSplitPercent(clamped);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setSplitPercent(cur => {
        localStorage.setItem('oa_split_percent', cur.toString());
        return cur;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Load Attempt and Question Set metadata
  useEffect(() => {
    if (isPractice) {
      // ponytail: in practice mode, isolate only this question without loading the entire assessment
      setQuestionSet(null);
      setAllProblems([]);
      return;
    }

    getAttempt(attemptId)
      .then(r => {
        const att = r.data.statusCode?.attempt;
        if (att && att.status !== 'in_progress') {
          // ponytail: seamless redirect to practice mode so review users never encounter a dead end
          toast('Assessment ended — opened in Practice Mode 💡', { icon: '💡' });
          navigate(`/practice/${problemId}?fromAttempt=${attemptId}`, { replace: true });
          return;
        }

        setAttempt(att);
        if (att?.preferredLanguage) {
          try {
            if (!sessionStorage.getItem(`attempt_lang_${attemptId}`)) {
              sessionStorage.setItem(`attempt_lang_${attemptId}`, att.preferredLanguage);
            }
            localStorage.setItem('preferredLanguage', att.preferredLanguage);
          } catch {}
          setLang(current => {
            const hasDraft = sessionStorage.getItem(`draft_${attemptId}_${problemId}_${current}`);
            return hasDraft ? current : att.preferredLanguage;
          });
        }
        if (att?.questionSetId) {
          getQuestionSet(att.questionSetId._id || att.questionSetId).then(setRes => {
            const qs = setRes.data.statusCode?.set;
            setQuestionSet(qs);
            const probs = qs?.problems || [];
            setAllProblems(probs);

            // Seed per-problem timers: takes MAX of server and local elapsed (guarantees persistence across refresh)
            if (att.timingMode === 'per_problem') {
              let localMap = {};
              try {
                localMap = JSON.parse(localStorage.getItem(`oa_all_elapsed_${att._id}`) || '{}');
              } catch (e) {}

              const timers = {};
              probs.forEach(p => {
                const pId = (p._id || p).toString();
                const sElapsed = att.problemTimerElapsedSec?.[pId] || 0;
                const lElapsed = Number(localMap[pId] || localStorage.getItem(`oa_elapsed_${att._id}_${pId}`) || 0);
                const trueElapsed = Math.max(sElapsed, lElapsed);
                const pLimit = p.timeLimit || 1800;
                timers[pId] = Math.max(0, pLimit - trueElapsed);
              });
              setProblemTimers(timers);
            }
          });
        }
      })
      .catch(err => {
        console.error(err);
        if (err.response?.status === 403) {
          toast.error('You can only resume your own active test sessions.');
          navigate('/dashboard', { replace: true });
        } else if (err.response?.status === 404) {
          toast.error('Assessment session not found.');
          navigate('/dashboard', { replace: true });
        } else {
          toast.error('Failed to load attempt details');
        }
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
  }, [isPractice, attemptId, fromAttemptId, problemId, navigate]);

  // Real-time heartbeat: if an admin stops or terminates the test from the admin panel while the user is active
  useEffect(() => {
    if (isPractice || !attemptId) return;
    const interval = setInterval(async () => {
      try {
        const res = await getAttempt(attemptId);
        const curAtt = res.data.statusCode?.attempt;
        if (curAtt && curAtt.status !== 'in_progress') {
          clearInterval(interval);
          setAdminStoppedModal(true);
          setTimeout(() => {
            navigate(`/review/${attemptId}`, { replace: true });
          }, 3000);
        }
      } catch (err) {
        // network silent
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isPractice, attemptId, navigate]);

  // Code Draft Persistence (Auto-saves user code per problem in current attempt / practice)
  const getDraftKey = useCallback((pId, currentLang) => {
    return isPractice ? `draft_practice_${pId}_${currentLang}` : `draft_${attemptId}_${pId}_${currentLang}`;
  }, [isPractice, attemptId]);

  const getDraftCode = useCallback((pId, currentLang) => {
    try {
      return sessionStorage.getItem(getDraftKey(pId, currentLang));
    } catch {
      return null;
    }
  }, [getDraftKey]);

  const saveDraftCode = useCallback((pId, currentLang, val) => {
    try {
      if (val !== undefined && val !== null) {
        const customStarter = problem ? getProblemStarter(problem, currentLang) : '';
        if (isInvalidOrGenericDraft(val, currentLang, problem?.title, customStarter)) {
          // Never persist starter templates or cross-language code as drafts
          sessionStorage.removeItem(getDraftKey(pId, currentLang));
          return;
        }
        sessionStorage.setItem(getDraftKey(pId, currentLang), val);
      }
    } catch {}
  }, [getDraftKey, problem]);

  // Load Problem Data & Submissions for THIS problem
  const loadSubmissions = useCallback(async () => {
    try {
      const params = { problemId };
      if (!isPractice && attemptId) params.attemptId = attemptId;
      const res = await mySubmissions(params);
      const subs = res.data.statusCode?.submissions || [];
      setSubmissionsList(subs);
      
      // Separate test results per question: load latest submission for this problem
      if (subs.length > 0) {
        setSubmission(subs[0]);
      } else {
        setSubmission(null);
      }

      if (subs.some(s => s.verdict === 'AC' || s.verdict === 'WA')) {
        setAnsweredProblems(prev => ({ ...prev, [problemId]: true }));
      }
      return subs;
    } catch (err) {
      console.error(err);
      return [];
    }
  }, [problemId, isPractice, attemptId]);

  useEffect(() => {
    setActiveTab('problem');
    setSelectedSubView(null);

    Promise.all([
      getProblem(problemId, false, isPractice ? { practice: true } : {}),
      loadSubmissions()
    ]).then(([probRes, subs]) => {
      const p = probRes.data.statusCode?.problem;
      setProblem(p);
      if (p?.category) setActiveSection(p.category);

      const latestSub = subs?.[0];

      // If user arrived from review results (fromAttempt query param),
      // discard any stale practice draft so the user's submitted code opens
      if (isPractice && fromAttemptId) {
        try {
          sessionStorage.removeItem(getDraftKey(problemId, 'cpp'));
          sessionStorage.removeItem(getDraftKey(problemId, 'java'));
        } catch {}
      }

      // Determine starting language:
      // In practice mode with previous submissions, prioritize the latest submission's language
      const currentLangPref = (() => {
        try {
          if (!isPractice && attemptId) {
            const attemptLang = sessionStorage.getItem(`attempt_lang_${attemptId}`);
            if (attemptLang === 'cpp' || attemptLang === 'java') return attemptLang;
          }
          if (isPractice && latestSub?.language) {
            return latestSub.language;
          }
          const userPref = localStorage.getItem('preferredLanguage');
          if (userPref === 'cpp' || userPref === 'java') return userPref;
        } catch {}
        return latestSub?.language || lang || 'cpp';
      })();

      const customStarter = getProblemStarter(p, currentLangPref);
      const fallbackStarter = STARTERS[currentLangPref] ? STARTERS[currentLangPref](p?.title || 'Solution') : STARTERS.cpp();
      const starter = customStarter || fallbackStarter;

      const draft = getDraftCode(problemId, currentLangPref);
      const subInLang = (subs || []).find(s => s.language === currentLangPref);

      if (draft && !isInvalidOrGenericDraft(draft, currentLangPref, p?.title, customStarter)) {
        setLang(currentLangPref);
        setCode(draft);
      } else if (subInLang?.code) {
        // Preload user's latest submission for this language/problem
        setLang(currentLangPref);
        setCode(subInLang.code);
        try {
          if (!isPractice && attemptId) {
            sessionStorage.setItem(`attempt_lang_${attemptId}`, currentLangPref);
          }
          localStorage.setItem('preferredLanguage', currentLangPref);
        } catch {}
      } else if (latestSub?.code) {
        // Fallback to latest submission in whatever language it was written in
        const subLang = latestSub.language || 'cpp';
        setLang(subLang);
        setCode(latestSub.code);
        try {
          if (!isPractice && attemptId) {
            sessionStorage.setItem(`attempt_lang_${attemptId}`, subLang);
          }
          localStorage.setItem('preferredLanguage', subLang);
        } catch {}
      } else {
        setLang(currentLangPref);
        setCode(starter);
      }
    }).catch(() => {
      toast.error('Failed to load problem statement');
    });
  }, [problemId, isPractice, attemptId, fromAttemptId, loadSubmissions, getDraftCode, getDraftKey]);

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
    try {
      if (!isPractice && attemptId) {
        sessionStorage.setItem(`attempt_lang_${attemptId}`, newLang);
      }
      localStorage.setItem('preferredLanguage', newLang);
    } catch {}

    const draft = getDraftCode(problemId, newLang);
    const subInLang = (submissionsList || []).find(s => s.language === newLang);
    const customStarter = getProblemStarter(problem, newLang);
    const fallbackStarter = STARTERS[newLang] ? STARTERS[newLang](problem?.title || 'Solution') : STARTERS.cpp();

    if (draft && !isInvalidOrGenericDraft(draft, newLang, problem?.title, customStarter)) {
      setCode(draft);
    } else if (subInLang?.code) {
      setCode(subInLang.code);
    } else {
      setCode(customStarter || fallbackStarter);
    }
    toast(`Switched to ${newLang === 'cpp' ? 'C++' : 'Java'}`);
  };

  const handleResetCode = () => {
    // ponytail: native confirm avoids modal boilerplate while preventing accidental code loss
    if (!window.confirm('Reset code to starter template? Your current changes will be discarded.')) return;
    const customStarter = getProblemStarter(problem, lang);
    const fallbackStarter = STARTERS[lang]?.(problem?.title || 'Solution') || '';
    const starter = customStarter || fallbackStarter;
    setCode(starter);
    try {
      sessionStorage.removeItem(getDraftKey(problemId, lang));
    } catch {}
    toast.success('Code reset to starter template');
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
      const payload = {
        problemId,
        language: lang,
        code,
      };
      if (!isPractice) {
        if (attempt?.questionSetId) payload.questionSetId = attempt.questionSetId._id || attempt.questionSetId;
        if (attemptId) payload.attemptId = attemptId;
      }
      const res = await submitCode(payload);
      const subId = res.data.statusCode?.submissionId;
      try {
        sessionStorage.removeItem(getDraftKey(problemId, lang));
      } catch {}
      pollSubmission(subId);
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit code');
    } finally {
      setSubmitting(false);
    }
  }, [code, problemId, isPractice, attempt, attemptId, lang, pollSubmission, getDraftKey]);

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

  // Per-problem tick: active problem's timer counts down and immediately syncs to localStorage
  useEffect(() => {
    if (isPractice || attempt?.timingMode !== 'per_problem' || !problemId || !problem) return;
    const remaining = problemTimers[problemId] ?? (problem.timeLimit || 1800);
    if (remaining <= 0) return;

    const t = setTimeout(() => {
      setProblemTimers(prev => {
        const currentRem = prev[problemId] ?? (problem.timeLimit || 1800);
        const newRem = Math.max(0, currentRem - 1);
        const next = { ...prev, [problemId]: newRem };

        // Synchronously save elapsed to localStorage so refresh CANNOT reset the timer
        const pLimit = problem.timeLimit || 1800;
        const elapsed = pLimit - newRem;
        try {
          localStorage.setItem(`oa_elapsed_${attemptId}_${problemId}`, elapsed.toString());
          const localMap = JSON.parse(localStorage.getItem(`oa_all_elapsed_${attemptId}`) || '{}');
          localMap[problemId] = elapsed;
          localStorage.setItem(`oa_all_elapsed_${attemptId}`, JSON.stringify(localMap));
        } catch (e) {}

        return next;
      });
    }, 1000);

    return () => clearTimeout(t);
  }, [isPractice, problemTimers, problemId, attempt, problem, attemptId]);

  // Flush current elapsed to server before navigating or reloading
  const flushTimers = useCallback(async () => {
    if (isPractice || attempt?.timingMode !== 'per_problem') return;
    const elapsed = Object.fromEntries(
      allProblems.map(p => {
        const pId = (p._id || p).toString();
        const pLimit = p.timeLimit || 1800;
        return [pId, pLimit - (problemTimers[pId] ?? pLimit)];
      })
    );
    try {
      localStorage.setItem(`oa_all_elapsed_${attemptId}`, JSON.stringify(elapsed));
    } catch (e) {}
    await saveTimers(attemptId, { problemTimerElapsedSec: elapsed }).catch(() => {});
  }, [isPractice, attempt, allProblems, problemTimers, attemptId]);

  // Periodic background sync of elapsed timers to MongoDB every 4 seconds
  useEffect(() => {
    if (isPractice || attempt?.timingMode !== 'per_problem' || !allProblems.length) return;
    const interval = setInterval(() => {
      const elapsed = Object.fromEntries(
        allProblems.map(p => {
          const pId = (p._id || p).toString();
          const pLimit = p.timeLimit || 1800;
          return [pId, pLimit - (problemTimers[pId] ?? pLimit)];
        })
      );
      saveTimers(attemptId, { problemTimerElapsedSec: elapsed }).catch(() => {});
    }, 4000);

    return () => clearInterval(interval);
  }, [isPractice, attempt, allProblems, problemTimers, attemptId]);

  // Save timers on tab unload / reload using sendBeacon / keepalive fetch
  useEffect(() => {
    const handleUnload = () => {
      if (isPractice || attempt?.timingMode !== 'per_problem' || !allProblems.length) return;
      const elapsed = Object.fromEntries(
        allProblems.map(p => {
          const pId = (p._id || p).toString();
          const pLimit = p.timeLimit || 1800;
          return [pId, pLimit - (problemTimers[pId] ?? pLimit)];
        })
      );
      try {
        localStorage.setItem(`oa_all_elapsed_${attemptId}`, JSON.stringify(elapsed));
      } catch (e) {}

      const token = localStorage.getItem('accessToken');
      fetch(`/api/attempts/${attemptId}/timers`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ problemTimerElapsedSec: elapsed }),
        keepalive: true,
      }).catch(() => {});
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [isPractice, attempt, allProblems, problemTimers, attemptId]);

  const isCurrentLocked = !isPractice && attempt?.timingMode === 'per_problem' && (problemTimers[problemId] ?? 1) <= 0;
  const allExpired = !isPractice && attempt?.timingMode === 'per_problem' && allProblems.length > 0 &&
    allProblems.every(p => (problemTimers[p._id || p] ?? 1) <= 0);

  const [problemLockedModal, setProblemLockedModal] = useState(false);

  useEffect(() => {
    if (isPractice || attempt?.timingMode !== 'per_problem') return;
    if (isCurrentLocked && !allExpired) {
      setProblemLockedModal(true);
    } else {
      setProblemLockedModal(false);
    }
  }, [isPractice, isCurrentLocked, allExpired, attempt?.timingMode, problemId]);

  const handleLockedProceed = async () => {
    setProblemLockedModal(false);
    await flushTimers();
    // 1. Try to find the next problem after current that is not locked
    const nextUnlocked = allProblems.find((p, idx) => idx > currentIndex && (problemTimers[p._id || p] ?? 1) > 0);
    if (nextUnlocked) {
      navigate(`/attempt/${attemptId}/problem/${nextUnlocked._id || nextUnlocked}`);
      return;
    }
    // 2. Try to find any other unlocked problem in the question set
    const anyUnlocked = allProblems.find(p => (problemTimers[p._id || p] ?? 1) > 0);
    if (anyUnlocked) {
      navigate(`/attempt/${attemptId}/problem/${anyUnlocked._id || anyUnlocked}`);
      return;
    }
    // 3. If no unlocked questions remain, open completion submission dialog
    handleEndAttempt();
  };

  const [isEndModalOpen, setIsEndModalOpen] = useState(false);

  const handleEndAttempt = () => {
    setIsEndModalOpen(true);
  };

  const handleNextProblem = async () => {
    if (!isPractice) await flushTimers();
    if (currentIndex >= 0 && currentIndex < allProblems.length - 1) {
      const nextP = allProblems[currentIndex + 1];
      const nextId = nextP._id || nextP;
      if (isPractice) {
        navigate(`/practice/${nextId}${fromAttemptId ? `?fromAttempt=${fromAttemptId}` : ''}`);
      } else {
        navigate(`/attempt/${attemptId}/problem/${nextId}`);
      }
    } else {
      if (isPractice) {
        if (fromAttemptId) {
          navigate(`/review/${fromAttemptId}`);
        } else {
          navigate('/dashboard');
        }
      } else {
        handleEndAttempt();
      }
    }
  };

  const handlePrevProblem = async () => {
    if (!isPractice) await flushTimers();
    if (currentIndex > 0) {
      const prevP = allProblems[currentIndex - 1];
      const prevId = prevP._id || prevP;
      if (isPractice) {
        navigate(`/practice/${prevId}${fromAttemptId ? `?fromAttempt=${fromAttemptId}` : ''}`);
      } else {
        navigate(`/attempt/${attemptId}/problem/${prevId}`);
      }
    }
  };

  const handleLoadCode = (sub) => {
    if (sub.language) setLang(sub.language);
    setCode(sub.code);
    setActiveTab('problem');
    toast.success('Previous code loaded into editor');
  };

  // Collective mode: true server-based elapsed time from startedAt + totalTimeLimit
  const [collectiveSeconds, setCollectiveSeconds] = useState(null);

  useEffect(() => {
    if (isPractice || attempt?.timingMode === 'per_problem' || !attempt) return;
    const limit = attempt.totalTimeLimit || questionSet?.totalTimeLimit || 3600;
    const started = attempt.startedAt ? new Date(attempt.startedAt).getTime() : Date.now();

    const calcRemaining = () => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      return Math.max(0, limit - elapsed);
    };

    setCollectiveSeconds(calcRemaining());

    const interval = setInterval(() => {
      const rem = calcRemaining();
      setCollectiveSeconds(rem);
      if (rem <= 0) {
        clearInterval(interval);
        handleEndAttempt();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPractice, attempt, questionSet]);

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
    <div className="h-screen bg-[#0b132b] text-slate-100 flex flex-col overflow-hidden font-sans">
      
      {/* TOP HEADER BAR MATCHING SCREENSHOT 3 */}
      <div className="bg-[#11192e] border-b border-[#1f2c4b] px-6 py-2.5 flex items-center justify-between flex-shrink-0 z-20">
        
        {/* Left: Sidebar Toggle, Test Name & Section Breadcrumb */}
        <div className="flex items-center gap-3">
          {!isPractice && allProblems.length > 1 && (
            <button
              type="button"
              onClick={() => setSidebarOpen(prev => !prev)}
              title={sidebarOpen ? "Hide sidebar (give more space to code)" : "Show question list"}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
                sidebarOpen
                  ? 'bg-[#18223a] border-[#243352] text-slate-300 hover:text-white hover:border-slate-500'
                  : 'bg-purple-950/80 border-purple-600 text-purple-200 shadow-md shadow-purple-950/50 hover:bg-purple-900'
              }`}
            >
              <span>{sidebarOpen ? '◧' : '◨'}</span>
              <span className="hidden sm:inline">{sidebarOpen ? 'Hide Sidebar' : 'Show Questions'}</span>
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-white text-sm font-extrabold tracking-tight">
                {isPractice
                  ? (problem?.title || 'Practice Coding Editor')
                  : (questionSet?.name || 'Assessment Test')}
              </h1>
              {isPractice && (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Practice Mode
                </span>
              )}
            </div>
            <p className="text-[10px] text-sky-400 font-bold uppercase tracking-wider">
              {isPractice
                ? (problem?.category ? `${problem.category} · Single Question Practice` : 'Single Question Practice')
                : `QUESTION ${currentQNum} OF ${allProblems.length || 1}`}
            </p>
          </div>
        </div>

        {/* Center: PROMINENT LIVE TIMER PILL + MARK FOR REVIEW */}
        <div className="flex items-center justify-center gap-3">
          {isPractice ? (
            <div className="border border-emerald-500/50 bg-[#080d1a] shadow-lg shadow-emerald-950/40 px-5 py-1.5 rounded-full flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono font-bold text-xs sm:text-sm tracking-wider text-emerald-300">
                Practice Mode · Untimed
              </span>
            </div>
          ) : attempt?.timingMode === 'per_problem' ? (() => {
            const secs = problemTimers[problemId] ?? 0;
            const locked = secs <= 0;
            const isLow = secs > 0 && secs < 60;
            return (
              <div className={`border shadow-lg px-5 py-1.5 rounded-full flex items-center gap-2 transition-all ${
                locked ? 'bg-rose-950/60 border-rose-500/60' :
                isLow  ? 'bg-[#080d1a] border-red-500/70 animate-pulse' :
                         'bg-[#080d1a] border-sky-500/50 shadow-sky-950/50'
              }`}>
                <span className={`font-mono font-bold text-base tracking-wider tabular-nums ${
                  locked ? 'text-rose-400' : isLow ? 'text-red-400' : 'text-green-400'
                }`}>
                  ⏱ {locked ? 'Locked' : formatTime(secs)}
                </span>
              </div>
            );
          })() : (() => {
            const secs = collectiveSeconds ?? 0;
            const isLow = secs > 0 && secs < 180;
            return (
              <div className={`border shadow-lg shadow-sky-950/50 px-5 py-1.5 rounded-full flex items-center gap-2 transition-all ${
                isLow ? 'bg-[#080d1a] border-red-500/70 animate-pulse' : 'bg-[#080d1a] border-sky-500/50'
              }`}>
                <span className={`font-mono font-bold text-base tracking-wider tabular-nums ${
                  isLow ? 'text-red-400' : 'text-green-400'
                }`}>
                  ⏱ {formatTime(secs)}
                </span>
              </div>
            );
          })()}

          {/* Mark for Review Button in Header */}
          <button
            type="button"
            onClick={toggleMarkForReview}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 shadow-sm ${
              isMarked
                ? 'bg-amber-500 text-slate-900 border-amber-400 font-extrabold shadow'
                : 'bg-[#18223a] text-slate-300 border-[#243352] hover:text-white hover:border-slate-500'
            }`}
            title="Bookmark this problem for review"
          >
            <span>🔖</span>
            <span className="hidden sm:inline">{isMarked ? 'Marked' : 'Mark for Review'}</span>
          </button>
        </div>

        {/* Right: Split Presets, Section Indicators & End Action */}
        <div className="flex items-center gap-3">
          {/* Quick Split Presets (only for coding problems) */}
          {!hasMcqOptions && (
            <div className="hidden sm:flex items-center gap-1 bg-[#0a101f] border border-[#202d4b] rounded-xl p-1 shadow-inner">
              <span className="text-[10px] text-slate-400 font-bold uppercase px-1.5 hidden md:inline">Split</span>
              {[
                { label: '35%', val: 35 },
                { label: '50%', val: 50 },
                { label: '65%', val: 65 },
              ].map(preset => (
                <button
                  key={preset.val}
                  type="button"
                  onClick={() => {
                    setSplitPercent(preset.val);
                    localStorage.setItem('oa_split_percent', preset.val.toString());
                  }}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded-lg transition font-semibold ${
                    Math.round(splitPercent) === preset.val
                      ? 'bg-sky-600 text-white font-bold shadow'
                      : 'text-slate-400 hover:text-white hover:bg-[#182442]'
                  }`}
                  title={`Set Question/Code split to ${preset.label}`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}

          {sections.length > 1 && (
            <div className="hidden xl:flex items-center gap-1.5">
              {sections.map((sec, idx) => (
                <span
                  key={sec.name}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition ${
                    (problem.category || 'General') === sec.name
                      ? 'bg-purple-600 text-white border-purple-500 shadow'
                      : 'bg-[#18223a] text-slate-400 border-[#243352]'
                  }`}
                >
                  Section {idx + 1}
                </span>
              ))}
            </div>
          )}

          {!isPractice && (
            <button
              onClick={handleEndAttempt}
              className="text-xs bg-red-950/70 hover:bg-red-900 border border-red-800 text-red-200 font-bold px-4 py-1.5 rounded-xl transition shadow"
            >
              Submit Test
            </button>
          )}
        </div>

      </div>

      {/* MAIN BODY: SIDEBAR (LEFT) + ARENA (RIGHT) */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* LEFT SIDEBAR: SECTION LIST & QUESTION MAP */}
        {!isPractice && sidebarOpen && (
          <div className="w-64 bg-[#0d1527] border-r border-[#1f2c4b] flex flex-col justify-between overflow-hidden flex-shrink-0 z-20 shadow-2xl">
          
          <div className="p-4 overflow-y-auto space-y-6">
            
            {/* Current Section Title */}
            {sections.length > 1 && (
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
                        <span className="truncate">Section {idx + 1}</span>
                        <span>{isCurrent ? '▶' : '•'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
                  const isLocked = !isPractice && attempt?.timingMode === 'per_problem' && (problemTimers[pId] ?? 1) <= 0;

                  return (
                    <button
                      key={pId || idx}
                      type="button"
                      onClick={async () => {
                        if (isLocked) {
                          toast.error(`Question ${idx + 1} time expired and is locked.`);
                          return;
                        }
                        if (!isPractice) await flushTimers();
                        if (isPractice) {
                          navigate(`/practice/${pId}${fromAttemptId ? `?fromAttempt=${fromAttemptId}` : ''}`);
                        } else {
                          navigate(`/attempt/${attemptId}/problem/${pId}`);
                        }
                      }}
                      className={`w-9 h-9 rounded-xl text-xs font-bold transition flex items-center justify-center relative border ${
                        isActive
                          ? 'bg-purple-600 text-white border-purple-400 ring-2 ring-purple-400/50 shadow-md'
                          : isLocked
                          ? 'bg-rose-950/60 text-rose-400 border-rose-800'
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
              {currentIndex >= 0 && currentIndex < allProblems.length - 1
                ? 'Next Question →'
                : isPractice
                ? (fromAttemptId ? 'Return to Review →' : 'Done Practice →')
                : 'Submit Assessment →'}
            </button>
          </div>

        </div>
      )}

        {/* RIGHT MAIN PANEL: PROBLEM DETAILS & CODING INTERFACE */}
        <div
          ref={arenaContainerRef}
          className={`flex-1 flex overflow-hidden bg-[#080d1a] relative ${isDragging ? 'cursor-col-resize select-none' : ''}`}
        >
          
          {/* PROBLEM / RESULTS / SUBMISSIONS LEFT HALF */}
          <div
            style={{ width: hasMcqOptions ? '100%' : `${splitPercent}%` }}
            className="border-r border-[#1f2c4b] flex flex-col overflow-hidden bg-[#0d1527] flex-shrink-0"
          >
            
            {/* Sub-Header Tabs */}
            <div className="flex items-center justify-between border-b border-[#1f2c4b] bg-[#11192e] px-4 py-2 flex-shrink-0 gap-2">
              <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar-hide">
                {isPractice ? (
                  <span className="bg-emerald-950/80 border border-emerald-700 text-emerald-300 font-extrabold text-xs px-3 py-1 rounded-lg flex items-center gap-1.5 flex-shrink-0">
                    <span>💻</span> Practice Problem
                  </span>
                ) : (
                  <span className="bg-purple-950/80 border border-purple-700 text-purple-300 font-extrabold text-xs px-2.5 py-1 rounded-lg flex-shrink-0">
                    Q{currentQNum} / {allProblems.length}
                  </span>
                )}

                <button
                  onClick={() => { setActiveTab('problem'); setSelectedSubView(null); }}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition flex-shrink-0 ${
                    activeTab === 'problem' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  📄 Problem
                </button>

                {!hasMcqOptions && (
                  <>
                    <button
                      onClick={() => { setActiveTab('results'); setSelectedSubView(null); }}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1.5 flex-shrink-0 ${
                        activeTab === 'results' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      📊 Test Results
                      {submission && <VerdictBadge verdict={submission.verdict} />}
                    </button>

                    <button
                      onClick={() => { setActiveTab('submissions'); setSelectedSubView(null); }}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1.5 flex-shrink-0 ${
                        activeTab === 'submissions' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      🕒 Submissions ({submissionsList.length})
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-700 relative">

              {/* All problems expired — show submit overlay */}
              {allExpired && (
                <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                  <div className="bg-[#0d1527] border border-rose-800 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center">
                    <h2 className="text-2xl font-extrabold text-white mb-2">Time Expired on All Problems</h2>
                    <p className="text-slate-400 text-sm mb-6">All problem timers have run out. Submit your assessment now.</p>
                    <button
                      onClick={handleEndAttempt}
                      className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm transition"
                    >
                      Submit Assessment
                    </button>
                  </div>
                </div>
              )}

              {/* Locked banner for current problem */}
              {isCurrentLocked && (
                <div className="px-4 py-2.5 bg-rose-950/40 border border-rose-800 rounded-xl text-xs font-bold text-rose-400 flex items-center gap-2">
                  🔒 Time expired for this problem — you can still navigate to others
                </div>
              )}

              {/* TAB 1: PROBLEM STATEMENT */}
              {activeTab === 'problem' && (
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <DifficultyChip difficulty={problem.difficulty} />
                      <span className="text-xs font-mono font-bold text-amber-300 bg-amber-950/40 border border-amber-800/60 px-2.5 py-0.5 rounded-full">
                        ⭐ Max {getDifficultyPoints(problem.difficulty).totalPoints} pts
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

                  {/* Input Format */}
                  {problem.inputFormat && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Input Format
                      </h4>
                      <pre className="text-xs font-mono text-slate-200 bg-[#080d1a] border border-[#1e2a47] rounded-xl p-3.5 whitespace-pre-wrap leading-relaxed">
                        {problem.inputFormat}
                      </pre>
                    </div>
                  )}

                  {/* Output Format */}
                  {problem.outputFormat && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Output Format
                      </h4>
                      <pre className="text-xs font-mono text-slate-200 bg-[#080d1a] border border-[#1e2a47] rounded-xl p-3.5 whitespace-pre-wrap leading-relaxed">
                        {problem.outputFormat}
                      </pre>
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
                            <div className="text-xs font-mono text-slate-300">
                              <span className="text-slate-500 font-sans block text-[11px] mb-0.5">Input:</span>
                              <pre className="text-emerald-400 whitespace-pre-wrap font-mono text-xs bg-[#080d1a] p-2 rounded border border-[#1e2a47]/60 overflow-x-auto">{ex.input}</pre>
                            </div>
                            <div className="text-xs font-mono text-slate-300">
                              <span className="text-slate-500 font-sans block text-[11px] mb-0.5">Output:</span>
                              <pre className="text-sky-400 whitespace-pre-wrap font-mono text-xs bg-[#080d1a] p-2 rounded border border-[#1e2a47]/60 overflow-x-auto">{ex.output}</pre>
                            </div>
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
                          +{problem.testCases?.length - visibleTestCases.length} Hidden Cases {isPractice ? '(Shown Below)' : ''}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {visibleTestCases.map((tc, i) => (
                          <div key={i} className="bg-[#11192e] border border-[#1e2a47] rounded-xl p-4 space-y-2 text-xs font-mono">
                            <p className="text-[11px] font-bold text-sky-400 mb-1">Visible Case #{i + 1}</p>
                            <div className="space-y-2 bg-[#080d1a] p-3 rounded-lg border border-[#1e2a47]">
                              <div>
                                <span className="text-slate-500 font-sans block text-[11px] mb-0.5">Input:</span>
                                <pre className="text-slate-200 whitespace-pre-wrap font-mono text-xs overflow-x-auto">{tc.input}</pre>
                              </div>
                              <div>
                                <span className="text-slate-500 font-sans block text-[11px] mb-0.5">Expected Output:</span>
                                <pre className="text-emerald-400 font-bold whitespace-pre-wrap font-mono text-xs overflow-x-auto">{tc.expectedOutput}</pre>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Hidden Test Cases with Expected Output (Practice Mode only) */}
                  {isPractice && (problem.testCases?.filter(tc => tc.isHidden) || []).length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span>🔒</span> Hidden Test Cases ({problem.testCases.filter(tc => tc.isHidden).length})
                        </h4>
                        <span className="text-[10px] px-2 py-0.5 rounded border bg-purple-950/60 border-purple-700 text-purple-300 font-mono">
                          Practice Mode Enabled
                        </span>
                      </div>
                      <div className="space-y-3">
                        {problem.testCases.map((tc, i) => {
                          if (!tc.isHidden) return null;
                          return (
                            <div key={i} className="bg-[#11192e] border border-purple-900/40 rounded-xl p-4 space-y-2 text-xs font-mono">
                              <div className="flex items-center justify-between">
                                <p className="text-[11px] font-bold text-purple-300 mb-1">🔒 Hidden Case #{i + 1}</p>
                                <span className="text-[10px] text-purple-400 font-mono">Confidential Case (Practice View)</span>
                              </div>
                              <div className="space-y-2 bg-[#080d1a] p-3 rounded-lg border border-[#1e2a47]">
                                <div>
                                  <span className="text-slate-500 font-sans block text-[11px] mb-0.5">Input:</span>
                                  <pre className="text-slate-200 whitespace-pre-wrap font-mono text-xs overflow-x-auto">{tc.input || '<empty input>'}</pre>
                                </div>
                                <div>
                                  <span className="text-slate-500 font-sans block text-[11px] mb-0.5">Expected Output:</span>
                                  <pre className="text-emerald-400 font-bold whitespace-pre-wrap font-mono text-xs overflow-x-auto">{tc.expectedOutput || '<empty output>'}</pre>
                                </div>
                              </div>
                            </div>
                          );
                        })}
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

                        {/* Points & Score Banner */}
                        {(() => {
                          const diffRules = getDifficultyPoints(problem.difficulty);
                          const runScore = submission.score !== undefined && submission.score !== null
                            ? submission.score
                            : calculateProblemScore(problem.difficulty, submission.passedTests, submission.totalTests);
                          const maxProbScore = Math.max(
                            runScore,
                            ...(submissionsList || []).map(s => s.score !== undefined && s.score !== null ? s.score : calculateProblemScore(problem.difficulty, s.passedTests, s.totalTests))
                          );

                          return (
                            <div className="bg-[#080d1a] border border-[#203152] rounded-xl p-3 flex items-center justify-between flex-wrap gap-2 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="text-amber-400 font-bold">🏆 Score for this Run:</span>
                                <span className="text-white font-mono font-extrabold text-sm">
                                  {runScore} / {diffRules.totalPoints} pts
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400">Best Score on Question (Max):</span>
                                <span className="text-emerald-400 font-mono font-bold text-xs">
                                  {maxProbScore} / {diffRules.totalPoints} pts
                                </span>
                              </div>
                              {submission.passedTests >= (submission.totalTests || 6) && diffRules.bonus > 0 && (
                                <div className="w-full text-center text-xs font-bold text-amber-300 bg-amber-950/60 border border-amber-600/60 py-1.5 px-3 rounded-lg mt-1">
                                  🎉 All 6 Solved Bonus (+{diffRules.bonus} pts) Awarded!
                                </div>
                              )}
                            </div>
                          );
                        })()}
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
                              const tcPts = getDifficultyPoints(problem.difficulty).tcPoints?.[i] || Math.round(getDifficultyPoints(problem.difficulty).totalPoints / (submission.totalTests || 6));

                              // VISIBLE TEST CASE (or any test case in Practice Mode): Shows Input, Expected Output, and User's Output!
                              if (!isHidden || isPractice) {
                                return (
                                  <div
                                    key={i}
                                    className={`p-4 rounded-xl border text-xs space-y-3 transition ${
                                      tr.passed
                                        ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-300'
                                        : 'bg-rose-950/20 border-rose-800/60 text-rose-300'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between font-bold flex-wrap gap-2">
                                      <span className="flex items-center gap-2 flex-wrap">
                                        <span>{tr.passed ? '✓' : '✗'}</span>
                                        <span>{isHidden ? `🔒 Hidden Test Case #${i + 1}` : `Visible Test Case #${i + 1}`}</span>
                                        <span className={`text-[10px] px-2 py-0.2 rounded border ${
                                          tr.passed ? 'bg-emerald-900/40 border-emerald-700 text-emerald-300' : 'bg-rose-900/40 border-rose-700 text-rose-300'
                                        }`}>
                                          {tr.passed ? 'PASSED' : 'WRONG ANSWER'}
                                        </span>
                                        {isHidden && isPractice && (
                                          <span className="text-[10px] px-2 py-0.2 rounded border bg-purple-950/60 border-purple-700 text-purple-300 font-mono">
                                            PRACTICE MODE
                                          </span>
                                        )}
                                        <span className="text-[10px] font-mono font-bold text-amber-300">
                                          ({tr.passed ? `+${tcPts}` : '0'}/{tcPts} pts)
                                        </span>
                                      </span>
                                      {tr.time && <span className="font-mono text-slate-400">{tr.time}ms</span>}
                                    </div>

                                    {/* Input & Expected Output */}
                                    {originalTc && (originalTc.input !== undefined || originalTc.expectedOutput !== undefined) && (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
                                        <div className="bg-[#080d1a] border border-[#1e2a47] p-2.5 rounded-lg">
                                          <span className="text-slate-500 font-sans block text-[11px] mb-0.5">Input:</span>
                                          <pre className="text-slate-200 whitespace-pre-wrap font-mono text-xs overflow-x-auto">{originalTc.input || '<empty input>'}</pre>
                                        </div>
                                        <div className="bg-[#080d1a] border border-[#1e2a47] p-2.5 rounded-lg">
                                          <span className="text-slate-500 font-sans block text-[11px] mb-0.5">Expected Output:</span>
                                          <pre className="text-emerald-400 font-bold whitespace-pre-wrap font-mono text-xs overflow-x-auto">{originalTc.expectedOutput || '<empty output>'}</pre>
                                        </div>
                                      </div>
                                    )}

                                    {/* User's Actual Output */}
                                    <div className="bg-[#080d1a] border border-[#1e2a47] p-2.5 rounded-lg font-mono text-xs">
                                      <span className="text-slate-500 font-sans block text-[11px] mb-0.5">Your Output:</span>
                                      <pre className={`whitespace-pre-wrap font-mono text-xs overflow-x-auto ${tr.passed ? 'text-emerald-300 font-bold' : 'text-rose-400 font-bold'}`}>
                                        {tr.stdout !== null && tr.stdout !== undefined && tr.stdout !== '' ? tr.stdout : '<no output produced>'}
                                      </pre>
                                    </div>

                                    {tr.stderr && (
                                      <pre className="text-xs font-mono text-rose-400 bg-rose-950/40 p-2.5 rounded-lg border border-rose-800/40 whitespace-pre-wrap">
                                        {tr.stderr}
                                      </pre>
                                    )}
                                  </div>
                                );
                              }

                              // HIDDEN TEST CASE (Assessment mode): ONLY tells if Working / Passed or Failed (Zero leak of data)
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
                                    <span className="text-[10px] font-mono font-bold text-amber-300">
                                      ({tr.passed ? `+${tcPts}` : '0'}/{tcPts} pts)
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

                      <div className="bg-[#11192e] border border-[#1e2a47] rounded-xl p-4 flex items-center justify-between text-xs flex-wrap gap-2">
                        <div className="flex items-center gap-2.5">
                          <VerdictBadge verdict={selectedSubView.verdict} />
                          <span className="font-mono text-slate-300 uppercase">{selectedSubView.language}</span>
                          <span className="text-slate-500">·</span>
                          <span className="text-slate-400">{new Date(selectedSubView.submittedAt).toLocaleTimeString()}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400 font-mono font-semibold">
                            {selectedSubView.passedTests}/{selectedSubView.totalTests} passed
                          </span>
                          <button
                            onClick={() => {
                              setSubmission(selectedSubView);
                              setActiveTab('results');
                            }}
                            className="text-xs bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 font-bold px-2.5 py-1 rounded-lg transition"
                          >
                            📊 View Results &amp; Outputs
                          </button>
                        </div>
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
            <div className="p-3.5 bg-[#11192e] border-t border-[#1f2c4b] flex items-center justify-between gap-2">
              {isPractice ? (
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs text-slate-400 font-mono">
                    Single Question Practice · Test &amp; Refine Solution
                  </span>

                  <button
                    type="button"
                    onClick={() => fromAttemptId ? navigate(`/review/${fromAttemptId}`) : navigate('/dashboard')}
                    className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold px-5 py-2 rounded-xl text-xs transition shadow flex items-center gap-1.5"
                  >
                    <span>✓</span> {fromAttemptId ? 'Return to Review' : 'Exit Practice'}
                  </button>
                </div>
              ) : (
                <>
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
                    {currentIndex >= 0 && currentIndex < allProblems.length - 1 ? 'Save & Next →' : 'Submit Assessment →'}
                  </button>
                </>
              )}
            </div>

          </div>

          {/* RESIZABLE DIVIDER HANDLE */}
          {!hasMcqOptions && (
            <div
              onMouseDown={handleMouseDown}
              className={`w-2 hover:w-2.5 bg-[#141d33] hover:bg-sky-500 cursor-col-resize transition-all flex items-center justify-center group flex-shrink-0 select-none z-10 ${
                isDragging ? 'bg-sky-500 w-2.5' : ''
              }`}
              title="Drag horizontally to resize Question and Code panes"
            >
              <div className="w-0.5 h-8 bg-slate-600 group-hover:bg-white rounded-full transition-colors pointer-events-none" />
            </div>
          )}

          {/* MONACO CODE EDITOR (RIGHT HALF) - only for coding problems */}
          {!hasMcqOptions && (
            <div className={`flex-1 flex flex-col overflow-hidden bg-[#080d1a] ${isDragging ? 'pointer-events-none select-none' : ''}`}>
              
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

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleResetCode}
                    disabled={submitting || polling}
                    title="Reset code to starter template"
                    className="bg-[#18223a] hover:bg-[#202d4d] active:scale-95 disabled:opacity-50 border border-[#2a3656] text-slate-300 hover:text-white font-semibold px-3 py-2 rounded-xl text-xs transition flex items-center gap-1.5"
                  >
                    <span>↺</span>
                    <span>Start Over</span>
                  </button>
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
                  key={`${problemId}_${lang}`}
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

      {/* Problem Locked / Time Expired Modal */}
      {problemLockedModal && !allExpired && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 select-none">
          <div className="bg-[#11192e] border border-[#233558] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-950/60 border border-rose-800/80 flex items-center justify-center mx-auto text-xl">
              ⏱
            </div>
            <div>
              <span className="inline-block text-xs font-mono font-bold text-rose-400 bg-rose-950/40 border border-rose-800/60 px-2.5 py-0.5 rounded-full mb-2">
                Question {currentQNum} Locked
              </span>
              <h3 className="text-lg font-extrabold text-white">Time Expired for this Question</h3>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              The time limit for Question {currentQNum} has elapsed. All code and answers recorded up to this point have been saved.
            </p>
            <p className="text-slate-400 text-xs leading-relaxed">
              {currentIndex < allProblems.length - 1
                ? 'Click below to advance to the next question in the test.'
                : 'You have reached the end of the question set. Click below to review or finalize your test.'}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleLockedProceed}
                className="w-full px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-950/50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{currentIndex < allProblems.length - 1 ? 'Proceed to Next Question →' : 'Review & Submit Assessment →'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Stopped Assessment Overlay */}
      {adminStoppedModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0e1628] border-2 border-rose-500 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <span className="text-5xl block mb-4">🛑</span>
            <h2 className="text-2xl font-black text-white mb-2">Assessment Concluded</h2>
            <p className="text-rose-300 text-sm font-semibold mb-3">
              An administrator has stopped this test session.
            </p>
            <p className="text-slate-400 text-xs mb-6 leading-relaxed">
              All submissions made up to this moment have been recorded and saved. Redirecting to your assessment review...
            </p>
            <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        </div>
      )}
    </div>
  );
}
