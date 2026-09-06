import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getAttempt, deleteAttempt } from '../api/attempts';
import Navbar from '../components/Navbar';
import Loader from '../components/Loader';
import VerdictBadge from '../components/VerdictBadge';
import DifficultyChip from '../components/DifficultyChip';
import ModalConfirm from '../components/ModalConfirm';
import { calculateProblemScore, getDifficultyPoints, calculateAttemptScoreBreakdown } from '../utils/scoring';

export default function ReviewResults() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all' | 'correct' | 'incorrect' | 'skipped'
  const [expandedSubMap, setExpandedSubMap] = useState({}); // { [subId]: 'tests' | 'code' | null }
  const [showProblemTCMap, setShowProblemTCMap] = useState({}); // { [problemId]: boolean }
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Helper to extract full test case comparisons (visible & hidden) for a submission
  const getSubmissionTestDetails = (sub, problem) => {
    const problemTCs = problem?.testCases || [];
    const testResults = sub?.testResults || [];

    if (testResults.length > 0) {
      return testResults.map((tr, idx) => {
        const originalTC = problemTCs[tr.testCaseIndex !== undefined ? tr.testCaseIndex : idx] || problemTCs[idx];
        const isHidden = tr.isHidden !== undefined ? tr.isHidden : (originalTC?.isHidden || false);
        const input = originalTC?.input || '';
        const expectedOutput = originalTC?.expectedOutput || '';
        const actualOutput = tr.stdout !== null && tr.stdout !== undefined && tr.stdout !== ''
          ? tr.stdout
          : (tr.passed && expectedOutput ? expectedOutput : '<no output produced>');

        return {
          index: idx + 1,
          isHidden,
          passed: !!tr.passed,
          input,
          expectedOutput,
          actualOutput,
          stderr: tr.stderr,
          time: tr.time,
        };
      });
    }

    return problemTCs.map((tc, idx) => {
      const isPassed = (sub?.passedTests || 0) > idx;
      return {
        index: idx + 1,
        isHidden: !!tc.isHidden,
        passed: isPassed,
        input: tc.input || '',
        expectedOutput: tc.expectedOutput || '',
        actualOutput: isPassed ? (tc.expectedOutput || '<passed>') : '<no output recorded>',
        stderr: null,
        time: null,
      };
    });
  };

  // Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMode, setExportMode] = useState('detailed'); // 'detailed' | 'summarised'
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getAttempt(attemptId)
      .then(r => setAttempt(r.data.statusCode?.attempt))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [attemptId]);

  const setInfo = attempt?.questionSetId;
  const problems = setInfo?.problems || [];
  const submissions = attempt?.submissions || [];

  // Group submissions by problemId
  const subsByProblem = useMemo(() => {
    const map = {};
    submissions.forEach(sub => {
      const pid = (sub.problemId?._id || sub.problemId)?.toString();
      if (!map[pid]) map[pid] = [];
      map[pid].push(sub);
    });
    Object.keys(map).forEach(pid => {
      map[pid].sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
    });
    return map;
  }, [submissions]);

  // Calculate statistics per problem
  const problemStats = useMemo(() => {
    return problems.map((p, index) => {
      const pid = p._id.toString();
      const pSubs = subsByProblem[pid] || [];
      const hasAC = pSubs.some(s => s.verdict === 'AC');
      const latestSub = pSubs[pSubs.length - 1];
      const hasAttempted = pSubs.length > 0;
      
      const status = hasAC ? 'correct' : hasAttempted ? 'incorrect' : 'skipped';
      const section = p.category || p.section || setInfo?.category || 'General';

      const totalRuntimeMs = pSubs.reduce((acc, s) => acc + (s.runtime || 500), 0);
      const timeTakenSec = Math.max(12, Math.round(totalRuntimeMs / 1000) + (pSubs.length * 45));

      // Calculate score achieved based on the LAST attempt for this question
      const diffRules = getDifficultyPoints(p.difficulty);
      const maxPossiblePoints = diffRules.totalPoints;

      const lastAttemptScore = latestSub
        ? (latestSub.score !== undefined && latestSub.score !== null
            ? latestSub.score
            : calculateProblemScore(p.difficulty, latestSub.passedTests, latestSub.totalTests))
        : 0;

      return {
        problem: p,
        index: index + 1,
        section,
        status,
        submissions: pSubs,
        latestSub,
        bestSub: latestSub,
        maxScore: lastAttemptScore,
        maxPossiblePoints,
        hasAC: latestSub?.verdict === 'AC',
        timeTakenSec: hasAttempted ? timeTakenSec : 0,
      };
    });
  }, [problems, subsByProblem, setInfo]);

  // Overall Metrics & Score Calculations (Takes MAX score per question)
  const totalQuestions = problems.length;
  const correctCount = problemStats.filter(p => p.status === 'correct').length;
  const incorrectCount = problemStats.filter(p => p.status === 'incorrect').length;
  const skippedCount = problemStats.filter(p => p.status === 'skipped').length;
  const accuracyRate = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  const totalScore = useMemo(() => {
    return problemStats.reduce((acc, p) => acc + p.maxScore, 0);
  }, [problemStats]);

  const totalPossibleScore = useMemo(() => {
    return problemStats.reduce((acc, p) => acc + p.maxPossiblePoints, 0);
  }, [problemStats]);

  const scorePercentage = totalPossibleScore > 0 ? Math.round((totalScore / totalPossibleScore) * 100) : 0;

  // Sections Breakdown
  const sectionBreakdown = useMemo(() => {
    const map = {};
    problemStats.forEach(item => {
      const sec = item.section;
      if (!map[sec]) {
        map[sec] = { name: sec, total: 0, correct: 0, incorrect: 0, skipped: 0, timeSpentSec: 0 };
      }
      map[sec].total++;
      map[sec].timeSpentSec += item.timeTakenSec;
      if (item.status === 'correct') map[sec].correct++;
      else if (item.status === 'incorrect') map[sec].incorrect++;
      else map[sec].skipped++;
    });
    return Object.values(map);
  }, [problemStats]);

  // Total time spent
  const totalAttemptTimeSec = useMemo(() => {
    if (attempt?.startedAt && attempt?.endedAt) {
      return Math.round((new Date(attempt.endedAt) - new Date(attempt.startedAt)) / 1000);
    }
    return problemStats.reduce((acc, p) => acc + p.timeTakenSec, 0);
  }, [attempt, problemStats]);

  const formatSeconds = (sec) => {
    if (!sec || sec <= 0) return '0s';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  // Filtered problem cards
  const filteredProblems = useMemo(() => {
    return problemStats.filter(item => {
      const matchSection = selectedSection === 'All' || item.section === selectedSection;
      const matchStatus = selectedStatus === 'all' || item.status === selectedStatus;
      return matchSection && matchStatus;
    });
  }, [problemStats, selectedSection, selectedStatus]);

  // 1. DETAILED JSON REPORT GENERATOR (FOR AI)
  const detailedReportJson = useMemo(() => {
    return {
      reportType: "detailed_assessment_report_for_ai",
      generatedAt: new Date().toISOString(),
      assessmentMetadata: {
        attemptId: attempt?._id,
        questionBankName: setInfo?.name || "Assessment",
        category: setInfo?.category || "General",
        timingMode: setInfo?.timingMode || "collective",
        status: attempt?.status || "completed",
        attemptedAt: attempt?.startedAt,
        completedAt: attempt?.endedAt,
        totalTimeSpentSeconds: totalAttemptTimeSec,
        totalTimeFormatted: formatSeconds(totalAttemptTimeSec),
        totalQuestions,
        correctCount,
        incorrectCount,
        skippedCount,
        accuracyRate: `${accuracyRate}%`,
      },
      topicBreakdown: sectionBreakdown.map(sec => ({
        topic: sec.name,
        totalQuestions: sec.total,
        correct: sec.correct,
        incorrect: sec.incorrect,
        skipped: sec.skipped,
        timeSpent: formatSeconds(sec.timeSpentSec),
        accuracy: sec.total > 0 ? `${Math.round((sec.correct / sec.total) * 100)}%` : "0%",
      })),
      questions: problemStats.map(item => {
        const p = item.problem;
        const latestSub = item.latestSub;
        const failedHidden = latestSub?.testResults?.some(tr => tr.isHidden && !tr.passed);
        
        return {
          questionNumber: item.index,
          problemId: p._id,
          title: p.title,
          difficulty: p.difficulty,
          topic: item.section,
          description: p.description,
          inputFormat: p.inputFormat || null,
          outputFormat: p.outputFormat || null,
          constraints: p.constraints,
          examples: p.examples,
          status: item.status,
          timeSpentSeconds: item.timeTakenSec,
          timeSpentFormatted: formatSeconds(item.timeTakenSec),
          totalSubmissionsCount: item.submissions.length,
          latestVerdict: latestSub?.verdict || "Unattempted",
          testCasesSummary: {
            totalTests: latestSub?.totalTests || p.testCases?.length || 0,
            passedTests: latestSub?.passedTests || 0,
            hiddenTestCasesFailed: !!failedHidden,
          },
          allSubmissions: item.submissions.map((sub, sIdx) => ({
            submissionAttempt: sIdx + 1,
            language: sub.language,
            verdict: sub.verdict,
            runtimeMs: sub.runtime,
            memoryKb: sub.memory,
            passedTests: sub.passedTests,
            totalTests: sub.totalTests,
            submittedAt: sub.submittedAt,
            compileError: sub.compileError || null,
            submittedCode: sub.code,
            testCases: getSubmissionTestDetails(sub, p).map(td => ({
              caseNumber: td.index,
              type: td.isHidden ? 'Hidden' : 'Visible',
              status: td.passed ? 'PASSED' : 'FAILED',
              input: td.input,
              expectedOutput: td.expectedOutput,
              actualOutput: td.actualOutput,
              error: td.stderr || null,
              runtimeMs: td.time,
            })),
          })),
        };
      }),
      aiPromptInstruction: "Analyze my assessment code submissions in detail. Pinpoint logical bugs, edge cases I failed, algorithm time complexity bottlenecks, and provide optimized solution snippets.",
    };
  }, [attempt, setInfo, totalAttemptTimeSec, totalQuestions, correctCount, incorrectCount, skippedCount, accuracyRate, sectionBreakdown, problemStats]);

  // 2. SUMMARISED JSON REPORT GENERATOR (FOR AI)
  const summarisedReportJson = useMemo(() => {
    return {
      reportType: "summarised_assessment_report_for_ai",
      generatedAt: new Date().toISOString(),
      executiveSummary: {
        questionBank: setInfo?.name || "Assessment",
        overallAccuracy: `${accuracyRate}%`,
        score: `${correctCount} / ${totalQuestions}`,
        totalTimeSpent: formatSeconds(totalAttemptTimeSec),
        status: attempt?.status,
      },
      topicPerformance: sectionBreakdown.map(sec => ({
        topic: sec.name,
        accuracy: sec.total > 0 ? `${Math.round((sec.correct / sec.total) * 100)}%` : "0%",
        correctRatio: `${sec.correct}/${sec.total}`,
        timeSpent: formatSeconds(sec.timeSpentSec),
      })),
      questionSummaries: problemStats.map(item => {
        const p = item.problem;
        const latestSub = item.latestSub;
        const failedHidden = latestSub?.testResults?.some(tr => tr.isHidden && !tr.passed);

        return {
          qNo: item.index,
          title: p.title,
          topic: item.section,
          difficulty: p.difficulty,
          status: item.status.toUpperCase(),
          verdict: latestSub?.verdict || "SKIPPED",
          timeTaken: formatSeconds(item.timeTakenSec),
          testsPassed: `${latestSub?.passedTests || 0}/${latestSub?.totalTests || p.testCases?.length || 0}`,
          hiddenFailed: !!failedHidden,
          attemptsCount: item.submissions.length,
        };
      }),
      aiPromptInstruction: "Provide an executive performance assessment based on this summary. Identify my key strengths, weak topics, and suggest an actionable study schedule for upcoming interviews.",
    };
  }, [setInfo, accuracyRate, correctCount, totalQuestions, totalAttemptTimeSec, attempt, sectionBreakdown, problemStats]);

  const currentReportString = useMemo(() => {
    const data = exportMode === 'detailed' ? detailedReportJson : summarisedReportJson;
    return JSON.stringify(data, null, 2);
  }, [exportMode, detailedReportJson, summarisedReportJson]);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(currentReportString);
    setCopied(true);
    toast.success(`Copied ${exportMode === 'detailed' ? 'Detailed' : 'Summarised'} AI Report JSON to clipboard!`);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadJson = () => {
    const filename = `${(setInfo?.name || 'assessment').toLowerCase().replace(/\s+/g, '_')}_${exportMode}_report.json`;
    const blob = new Blob([currentReportString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Downloaded ${filename}`);
  };

  if (loading) return <Loader />;

  if (!attempt) {
    return (
      <div className="min-h-screen bg-[#0b132b] text-white flex flex-col items-center justify-center space-y-4">
        <p className="text-slate-400">Attempt record not found.</p>
        <Link to="/dashboard" className="text-sky-400 font-bold hover:underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const handleDeleteAttempt = () => {
    setIsDeleteModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0b132b] text-slate-100 font-sans pb-20">
      <Navbar />

      <div className="max-w-6xl mx-auto px-6 pt-8 space-y-8">
        
        {/* TOP HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold tracking-widest text-sky-400 uppercase">
              PERFORMANCE ASSESSMENT
            </span>
            <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1">
              Review Practice Results
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* EXPORT REPORT BUTTON */}
            <button
              onClick={() => setShowExportModal(true)}
              className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-2 shadow-lg shadow-blue-950/50"
            >
              <span>📊</span> Export Report (AI JSON)
            </button>

            {/* DELETE RECORD BUTTON */}
            <button
              onClick={handleDeleteAttempt}
              className="bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm"
            >
              <span>🗑️</span> Delete Record
            </button>

            <Link
              to="/dashboard"
              className="bg-[#18223a] hover:bg-[#202d4d] border border-[#2a3656] text-slate-300 text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* HERO OVERVIEW CARD */}
        <div className="bg-[#11192e] border border-[#1e2a47] rounded-3xl p-8 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-8">
          {/* Left Info */}
          <div className="space-y-4 max-w-xl">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider bg-sky-950/80 text-sky-400 border border-sky-800/80 px-2.5 py-0.5 rounded-md">
                QUESTION BANK
              </span>
              <h2 className="text-2xl font-extrabold text-white mt-2">
                {setInfo?.name || 'Assessment Set'}
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Attempted on {new Date(attempt.startedAt).toLocaleDateString()} at {new Date(attempt.startedAt).toLocaleTimeString()}
              </p>
            </div>

            {/* Badges Row */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="bg-[#080d1a] border border-[#232f48] text-slate-300 text-xs font-mono font-bold px-3 py-1 rounded-lg flex items-center gap-1.5">
                <span>⏱</span> Total Time: <strong className="text-white">{formatSeconds(totalAttemptTimeSec)}</strong>
              </span>
              <span className="bg-amber-950/60 border border-amber-800/60 text-amber-300 text-xs font-bold px-3 py-1 rounded-lg flex items-center gap-1.5 shadow-sm">
                <span>🏆</span> Score: <strong className="text-white">{totalScore} / {totalPossibleScore} pts</strong>
              </span>
              <span className="bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs font-bold px-3 py-1 rounded-lg flex items-center gap-1.5">
                <span className="text-emerald-400">●</span> Correct: {correctCount}
              </span>
              <span className="bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs font-bold px-3 py-1 rounded-lg flex items-center gap-1.5">
                <span className="text-rose-400">●</span> Incorrect: {incorrectCount}
              </span>
              {(attempt?.status === 'stopped_by_admin' || attempt?.stoppedByAdmin) && (
                <span className="bg-rose-950/80 border border-rose-600 text-rose-300 text-xs font-bold px-3 py-1 rounded-lg flex items-center gap-1.5 shadow-sm">
                  <span>🛑</span> Concluded by Administrator
                </span>
              )}
              <span className="bg-[#18223a] border border-[#2a3656] text-slate-400 text-xs font-bold px-3 py-1 rounded-lg flex items-center gap-1.5">
                <span className="text-slate-500">●</span> Skipped: {skippedCount}
              </span>
            </div>
          </div>

          {/* Right Score & Accuracy Panel */}
          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            {/* Total Points Score Card */}
            <div className="bg-[#080d1a] border border-[#1e2a47] rounded-2xl p-5 text-center min-w-[190px] shadow-inner flex flex-col justify-center">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                🏆 TOTAL SCORE
              </span>
              <div className="text-3xl font-black text-white my-0.5">
                {totalScore} <span className="text-slate-500 text-lg font-normal">/ {totalPossibleScore} pts</span>
              </div>
              <span className="text-xs font-bold text-amber-400 block mt-1">
                {scorePercentage}% Score Achieved
              </span>
            </div>

            {/* Questions AC Card */}
            <div className="bg-[#080d1a] border border-[#1e2a47] rounded-2xl p-5 text-center min-w-[170px] shadow-inner flex flex-col justify-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                SOLVED AC
              </span>
              <div className="text-3xl font-black text-sky-400 my-0.5">
                {correctCount} <span className="text-slate-600 text-lg font-normal">/ {totalQuestions}</span>
              </div>
              <span className="text-xs font-bold text-emerald-400 block mt-1">
                {accuracyRate}% Accuracy
              </span>
            </div>
          </div>
        </div>

        {/* SECTION BREAKDOWN & TIME SPENT CARDS */}
        {sectionBreakdown.length > 0 && (
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              SECTION BREAKDOWN & TIME SPENT (CLICK CARD TO FILTER)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {sectionBreakdown.map(sec => {
                const isSelected = selectedSection === sec.name;
                const secAccuracy = sec.total > 0 ? Math.round((sec.correct / sec.total) * 100) : 0;

                return (
                  <div
                    key={sec.name}
                    onClick={() => setSelectedSection(isSelected ? 'All' : sec.name)}
                    className={`bg-[#11192e] border rounded-2xl p-5 cursor-pointer transition shadow-lg ${
                      isSelected
                        ? 'border-sky-500 ring-1 ring-sky-500/40 bg-[#162340]'
                        : 'border-[#1e2a47] hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-bold text-white text-sm truncate">{sec.name}</h4>
                      <span className="bg-[#080d1a] border border-[#232f48] text-sky-300 text-[11px] font-mono px-2 py-0.5 rounded-md flex items-center gap-1 flex-shrink-0">
                        <span>⏱</span> {formatSeconds(sec.timeSpentSec)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                      <span>{sec.correct} / {sec.total} Correct</span>
                      <span className="font-bold text-emerald-400">{secAccuracy}%</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold">
                      <span className="text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900/60">
                        ✓ {sec.correct}
                      </span>
                      <span className="text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-900/60">
                        ✗ {sec.incorrect}
                      </span>
                      <span className="text-slate-400 bg-[#080d1a] px-2 py-0.5 rounded border border-[#232f48]">
                        - {sec.skipped} skipped
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* FILTER BAR: SECTION TABS & STATUS PILLS */}
        <div className="bg-[#11192e] border border-[#1e2a47] rounded-2xl p-6 space-y-4 shadow-lg">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">
              SECTION:
            </span>
            <button
              onClick={() => setSelectedSection('All')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition border ${
                selectedSection === 'All'
                  ? 'bg-blue-600 border-blue-500 text-white shadow'
                  : 'bg-[#18223a] border-[#243352] text-slate-400 hover:text-white'
              }`}
            >
              All Sections ({totalQuestions})
            </button>
            {sectionBreakdown.map(sec => (
              <button
                key={sec.name}
                onClick={() => setSelectedSection(sec.name)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition border ${
                  selectedSection === sec.name
                    ? 'bg-blue-600 border-blue-500 text-white shadow'
                    : 'bg-[#18223a] border-[#243352] text-slate-400 hover:text-white'
                }`}
              >
                {sec.name} ({sec.total})
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1e2a47]">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">
              STATUS:
            </span>
            {[
              { key: 'all', label: `All (${totalQuestions})` },
              { key: 'correct', label: `Correct (${correctCount})` },
              { key: 'incorrect', label: `Incorrect (${incorrectCount})` },
              { key: 'skipped', label: `Skipped (${skippedCount})` },
            ].map(pill => (
              <button
                key={pill.key}
                onClick={() => setSelectedStatus(pill.key)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition border ${
                  selectedStatus === pill.key
                    ? 'bg-sky-600 border-sky-500 text-white shadow'
                    : 'bg-[#080d1a] border-[#202c47] text-slate-400 hover:text-white'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        {/* DETAILED QUESTION CARDS LIST */}
        <div className="space-y-5">
          {filteredProblems.length === 0 ? (
            <div className="p-12 text-center bg-[#11192e] border border-[#1e2a47] rounded-2xl text-slate-500 text-sm">
              No questions match the selected section / status filter.
            </div>
          ) : (
            filteredProblems.map(item => {
              const p = item.problem;
              const subs = item.submissions;
              const hasOptions = p.options || p.optionA;
              const isCorrect = item.status === 'correct';
              const isIncorrect = item.status === 'incorrect';

              const latestSub = item.latestSub;
              const totalTC = latestSub?.totalTests || p.testCases?.length || 0;
              const passedTC = latestSub?.passedTests || 0;
              const hiddenTC = p.testCases?.filter(t => t.isHidden) || [];
              const visibleTC = p.testCases?.filter(t => !t.isHidden) || [];
              const failedHiddenTC = latestSub?.testResults?.some(tr => tr.isHidden && !tr.passed);

              return (
                <div
                  key={p._id}
                  className="bg-[#11192e] border border-[#1e2a47] rounded-2xl p-6 shadow-xl space-y-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-white font-extrabold text-base">
                        Q{item.index}.
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider bg-sky-950/70 text-sky-400 border border-sky-800/70 px-2.5 py-0.5 rounded">
                        {item.section}
                      </span>
                      <DifficultyChip difficulty={p.difficulty} />
                      <span className="text-xs font-mono font-bold bg-[#080d1a] border border-[#213154] text-amber-300 px-3 py-1 rounded-lg flex items-center gap-1.5 shadow-sm">
                        <span>🏆</span> Score: <strong className="text-white">{item.maxScore}</strong> / {item.maxPossiblePoints} pts
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to={`/practice/${p._id}?fromAttempt=${attempt._id}`}
                        className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white text-xs font-black px-4 py-2 rounded-xl transition-all shadow-lg shadow-blue-950/60 ring-2 ring-blue-400/50 flex items-center gap-2 hover:shadow-blue-500/30"
                        title="Open this question in practice coding editor"
                      >
                        <span className="text-sm">💻</span>
                        <span>Practice in Code Editor &rarr;</span>
                      </Link>

                      <span className="bg-[#080d1a] border border-[#232f48] text-sky-300 font-mono text-xs px-3 py-1 rounded-lg flex items-center gap-1.5">
                        <span>⏱</span> {formatSeconds(item.timeTakenSec)}
                      </span>

                      <span className={`text-xs font-bold px-3 py-1 rounded-lg border uppercase tracking-wider ${
                        isCorrect
                          ? 'bg-emerald-950/70 text-emerald-400 border-emerald-800/80'
                          : isIncorrect
                          ? 'bg-rose-950/70 text-rose-400 border-rose-800/80'
                          : 'bg-[#18223a] text-slate-400 border-[#2a3656]'
                      }`}>
                        {isCorrect ? 'CORRECT' : isIncorrect ? 'INCORRECT' : 'SKIPPED'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-white font-bold text-base leading-relaxed mb-2">
                      {p.title}
                    </h3>
                    {p.description && (
                      <p className="text-slate-300 text-xs md:text-sm leading-relaxed whitespace-pre-wrap bg-[#0c1426] border border-[#1b2744] p-4 rounded-xl">
                        {p.description}
                      </p>
                    )}
                    {p.inputFormat && (
                      <div className="mt-2.5">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Input Format:</span>
                        <pre className="text-slate-200 text-xs font-mono whitespace-pre-wrap bg-[#0c1426] border border-[#1b2744] p-3 rounded-xl leading-relaxed overflow-x-auto">
                          {p.inputFormat}
                        </pre>
                      </div>
                    )}
                    {p.constraints && (
                      <div className="mt-2.5">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Constraints:</span>
                        <pre className="text-slate-200 text-xs font-mono whitespace-pre-wrap bg-[#0c1426] border border-[#1b2744] p-3 rounded-xl leading-relaxed overflow-x-auto">
                          {p.constraints}
                        </pre>
                      </div>
                    )}
                  </div>

                  {hasOptions && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                      {['A', 'B', 'C', 'D'].map(opt => {
                        const optText = p[`option${opt}`] || (p.options && p.options[opt.charCodeAt(0) - 65]) || `Option ${opt}`;
                        const isAnswer = (p.correctAnswer || p.answer || 'A').toUpperCase() === opt;
                        return (
                          <div
                            key={opt}
                            className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
                              isAnswer
                                ? 'bg-emerald-950/60 border-emerald-600 text-emerald-300 font-bold'
                                : 'bg-[#080d1a] border-[#202c47] text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`w-5 h-5 rounded flex items-center justify-center font-bold ${
                                isAnswer ? 'bg-emerald-500 text-white' : 'bg-[#18223a] text-slate-400'
                              }`}>
                                {opt}
                              </span>
                              <span>{optText}</span>
                            </div>
                            {isAnswer && <span className="text-[11px] text-emerald-400 font-semibold">Correct Answer</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!hasOptions && (
                    <div className="bg-[#080d1a] border border-[#1e2a47] rounded-xl p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-slate-300 uppercase tracking-wider">
                          Test Case Results ({passedTC}/{totalTC} Passed)
                        </span>

                        <div className="flex items-center gap-3 font-mono flex-wrap">
                          <span className="text-slate-400">
                            Visible: <strong className="text-emerald-400">{visibleTC.length} Passed</strong>
                          </span>
                          <span className="text-slate-500">·</span>
                          <span className="text-slate-400">
                            Hidden: {failedHiddenTC ? (
                              <strong className="text-rose-400 bg-rose-950/50 border border-rose-800/60 px-2 py-0.5 rounded">
                                ❌ Hidden Test Case Failed ({latestSub?.verdict})
                              </strong>
                            ) : (
                              <strong className="text-emerald-400">{hiddenTC.length} Passed</strong>
                            )}
                          </span>

                          {p.testCases?.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setShowProblemTCMap(prev => ({ ...prev, [p._id]: !prev[p._id] }))}
                              className="bg-[#18223a] hover:bg-[#202d4d] border border-[#2a3656] text-sky-400 hover:text-white font-sans font-bold px-2.5 py-1 rounded-lg transition text-[11px]"
                            >
                              {showProblemTCMap[p._id] ? '▲ Hide All Problem Cases' : `🔍 View All ${p.testCases.length} Problem Cases (Visible & Hidden)`}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expandable Problem Test Cases List (Visible & Hidden) */}
                      {showProblemTCMap[p._id] && p.testCases?.length > 0 && (
                        <div className="pt-3 border-t border-[#1e2a47] space-y-3">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Full Problem Test Suite ({p.testCases.length} Cases)
                          </p>
                          <div className="space-y-2.5">
                            {p.testCases.map((tc, tcI) => (
                              <div
                                key={tcI}
                                className="bg-[#050811] border border-[#1b2744] p-3 rounded-xl space-y-2 text-xs font-mono"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-sky-400">
                                    Problem Test Case #{tcI + 1}
                                  </span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                                    tc.isHidden
                                      ? 'bg-purple-950/70 text-purple-300 border border-purple-800'
                                      : 'bg-blue-950/70 text-sky-300 border border-sky-800'
                                  }`}>
                                    {tc.isHidden ? '🔒 Hidden Case' : '👁 Visible Case'}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div className="bg-[#0b1020] border border-[#18233c] p-2.5 rounded-lg">
                                    <span className="text-slate-500 font-sans block text-[11px] mb-0.5">Input:</span>
                                    <pre className="text-slate-200 whitespace-pre-wrap font-mono text-xs overflow-x-auto">{tc.input || '<empty input>'}</pre>
                                  </div>
                                  <div className="bg-[#0b1020] border border-[#18233c] p-2.5 rounded-lg">
                                    <span className="text-slate-500 font-sans block text-[11px] mb-0.5">Expected Output:</span>
                                    <pre className="text-emerald-400 font-bold whitespace-pre-wrap font-mono text-xs overflow-x-auto">{tc.expectedOutput || '<empty output>'}</pre>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Test Cases Points Matrix */}
                  {totalTC > 0 && (
                    <div className="bg-[#080d1a] border border-[#1e2a47] rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                        <span className="font-bold text-slate-300">
                          🧪 Test Case Scoring Breakdown ({p.difficulty || 'Easy'} · Total {item.maxPossiblePoints} pts)
                        </span>
                        <span className="font-mono text-amber-300 font-bold">
                          Best Question Score: {item.maxScore} / {item.maxPossiblePoints} pts
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
                        {Array.from({ length: totalTC }).map((_, tcIdx) => {
                          const diffRules = getDifficultyPoints(p.difficulty);
                          const tcPts = diffRules.tcPoints?.[tcIdx] || Math.round(item.maxPossiblePoints / totalTC);
                          const tcObj = p.testCases?.[tcIdx];
                          const isVisible = tcObj ? !tcObj.isHidden : (tcIdx === 0);
                          const bestTestResult = item.bestSub?.testResults?.[tcIdx];
                          const isPassedInBest = bestTestResult ? bestTestResult.passed : (item.bestSub?.passedTests || 0) > tcIdx;

                          return (
                            <div
                              key={tcIdx}
                              className={`p-2 rounded-lg border text-center text-xs font-mono transition ${
                                isPassedInBest
                                  ? 'bg-emerald-950/40 border-emerald-700/70 text-emerald-300'
                                  : 'bg-rose-950/30 border-rose-900/50 text-rose-300'
                              }`}
                            >
                              <span className="block text-[10px] text-slate-400">
                                TC {tcIdx + 1} {isVisible ? '(Visible)' : '(Hidden)'}
                              </span>
                              <span className="font-bold block my-0.5">{isPassedInBest ? `+${tcPts} pts` : `0/${tcPts}`}</span>
                              <span className="text-[10px]">{isPassedInBest ? 'PASSED' : 'FAILED'}</span>
                            </div>
                          );
                        })}

                        {/* All 6 Solved Bonus Box */}
                        {(() => {
                          const diffRules = getDifficultyPoints(p.difficulty);
                          const hasBonus = (item.bestSub?.passedTests || 0) >= totalTC && totalTC > 0;
                          return (
                            <div
                              className={`p-2 rounded-lg border text-center text-xs font-mono transition ${
                                hasBonus
                                  ? 'bg-amber-950/60 border-amber-500/70 text-amber-300'
                                  : 'bg-[#131b2e] border-[#243354] text-slate-500'
                              }`}
                            >
                              <span className="block text-[10px] uppercase font-bold text-amber-400">All Solved</span>
                              <span className="font-bold block my-0.5">{hasBonus ? `+${diffRules.bonus} pts` : `0/${diffRules.bonus}`}</span>
                              <span className="text-[10px]">{hasBonus ? 'BONUS 🎉' : 'LOCKED'}</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-[#1e2a47]/60">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        All Submissions Made While Attempting ({subs.length})
                      </span>
                    </div>

                    {subs.length === 0 ? (
                      <div className="p-4 bg-[#080d1a] border border-[#1e2a47] rounded-xl text-center text-xs text-slate-500">
                        No submissions recorded for this question.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {subs.map((sub, sIdx) => {
                          const activeView = expandedSubMap[sub._id];
                          const subScore = sub.score !== undefined && sub.score !== null
                            ? sub.score
                            : calculateProblemScore(p.difficulty, sub.passedTests, sub.totalTests);
                          const isLast = (sub._id || sIdx) === (item.latestSub?._id || (subs.length - 1));
                          const isBest = subScore === item.maxScore && subScore > 0;
                          const testDetails = getSubmissionTestDetails(sub, p);

                          return (
                            <div
                              key={sub._id || sIdx}
                              className="bg-[#080d1a] border border-[#1e2a47] rounded-xl p-3.5 space-y-3"
                            >
                              <div className="flex items-center justify-between text-xs font-mono flex-wrap gap-2">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <span className="text-slate-500 font-bold">Attempt #{sIdx + 1}</span>
                                  <VerdictBadge verdict={sub.verdict} />
                                  <span className="text-slate-200 font-bold uppercase">{sub.language}</span>
                                  <span className="text-slate-500">·</span>
                                  <span className="text-slate-400">{sub.passedTests}/{sub.totalTests} tests passed</span>
                                  <span className="text-slate-500">·</span>
                                  <span className="text-amber-300 font-bold">{subScore} pts</span>
                                  {isLast ? (
                                    <span className="text-[10px] font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-md">
                                      ★ Final Attempt (Graded)
                                    </span>
                                  ) : isBest ? (
                                    <span className="text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-md">
                                      ★ High Score
                                    </span>
                                  ) : null}
                                </div>

                                <div className="flex items-center gap-2">
                                  {sub.runtime && <span className="text-slate-400">⏱ {sub.runtime}ms</span>}
                                  <span className="text-slate-500">{new Date(sub.submittedAt).toLocaleTimeString()}</span>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedSubMap(prev => ({
                                      ...prev,
                                      [sub._id]: prev[sub._id] === 'tests' ? null : 'tests',
                                    }))}
                                    className={`font-sans font-bold px-2.5 py-1 rounded-lg text-xs transition border ${
                                      activeView === 'tests'
                                        ? 'bg-sky-600 text-white border-sky-500'
                                        : 'bg-[#18223a] hover:bg-[#202d4d] border-[#2a3656] text-sky-400 hover:text-white'
                                    }`}
                                  >
                                    🧪 Test Results ({sub.passedTests}/{sub.totalTests})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedSubMap(prev => ({
                                      ...prev,
                                      [sub._id]: prev[sub._id] === 'code' ? null : 'code',
                                    }))}
                                    className={`font-sans font-bold px-2.5 py-1 rounded-lg text-xs transition border ${
                                      activeView === 'code'
                                        ? 'bg-purple-600 text-white border-purple-500'
                                        : 'bg-[#18223a] hover:bg-[#202d4d] border-[#2a3656] text-slate-300 hover:text-white'
                                    }`}
                                  >
                                    {activeView === 'code' ? '▲ Hide Code' : '🔍 View Code'}
                                  </button>
                                </div>
                              </div>

                              {/* TEST RESULTS FOR THIS ATTEMPT (VISIBLE & HIDDEN WITH ANSWERS) */}
                              {activeView === 'tests' && (
                                <div className="pt-3 border-t border-[#1e2a47] space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                      Attempt #{sIdx + 1} Test Case Breakdown & Answers
                                    </span>
                                    <span className="text-[11px] text-slate-400 font-mono">
                                      {sub.verdict === 'AC' ? '✅ All Cases Passed' : '⚠️ Inspect Answers Below'}
                                    </span>
                                  </div>

                                  {sub.compileError ? (
                                    <div className="p-3.5 bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs font-mono rounded-xl space-y-1">
                                      <span className="font-bold text-rose-400 block">Compilation / Diagnostics Error:</span>
                                      <pre className="whitespace-pre-wrap overflow-x-auto">{sub.compileError}</pre>
                                    </div>
                                  ) : (
                                    <div className="space-y-3">
                                      {testDetails.map((td) => (
                                        <div
                                          key={td.index}
                                          className={`p-3.5 rounded-xl border text-xs space-y-2.5 transition ${
                                            td.passed
                                              ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-300'
                                              : 'bg-rose-950/20 border-rose-800/60 text-rose-300'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between font-bold flex-wrap gap-1.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span>{td.passed ? '✓' : '✗'}</span>
                                              <span>Test Case #{td.index}</span>
                                              <span className={`text-[10px] px-2 py-0.5 rounded border uppercase ${
                                                td.isHidden
                                                  ? 'bg-purple-950/60 border-purple-700 text-purple-300'
                                                  : 'bg-blue-950/60 border-blue-700 text-sky-300'
                                              }`}>
                                                {td.isHidden ? '🔒 Hidden Case' : '👁 Visible Case'}
                                              </span>
                                              <span className={`text-[10px] px-2 py-0.5 rounded border font-mono ${
                                                td.passed
                                                  ? 'bg-emerald-900/40 border-emerald-700 text-emerald-300'
                                                  : 'bg-rose-900/40 border-rose-700 text-rose-300'
                                              }`}>
                                                {td.passed ? 'PASSED' : 'WRONG ANSWER'}
                                              </span>
                                            </div>
                                            {td.time && <span className="font-mono text-slate-400 text-[11px]">{td.time}ms</span>}
                                          </div>

                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
                                            <div className="bg-[#050811] border border-[#18233c] p-2.5 rounded-lg">
                                              <span className="text-slate-500 font-sans block text-[11px] mb-0.5">Input:</span>
                                              <pre className="text-slate-200 whitespace-pre-wrap font-mono text-xs overflow-x-auto">{td.input || '<empty input>'}</pre>
                                            </div>
                                            <div className="bg-[#050811] border border-[#18233c] p-2.5 rounded-lg">
                                              <span className="text-slate-500 font-sans block text-[11px] mb-0.5">Expected Output:</span>
                                              <pre className="text-emerald-400 font-bold whitespace-pre-wrap font-mono text-xs overflow-x-auto">{td.expectedOutput || '<empty output>'}</pre>
                                            </div>
                                          </div>

                                          <div className="bg-[#050811] border border-[#18233c] p-2.5 rounded-lg font-mono text-xs">
                                            <span className="text-slate-500 font-sans block text-[11px] mb-0.5">Answer Given in this Attempt:</span>
                                            <pre className={`whitespace-pre-wrap font-mono text-xs overflow-x-auto ${
                                              td.passed ? 'text-emerald-300 font-bold' : 'text-rose-400 font-bold'
                                            }`}>
                                              {td.actualOutput}
                                            </pre>
                                          </div>

                                          {td.stderr && (
                                            <pre className="text-xs font-mono text-rose-400 bg-rose-950/40 p-2.5 rounded-lg border border-rose-800/40 whitespace-pre-wrap overflow-x-auto">
                                              {td.stderr}
                                            </pre>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* CODE VIEW FOR THIS ATTEMPT */}
                              {activeView === 'code' && (
                                <div className="pt-2 border-t border-[#1e2a47] space-y-2">
                                  <pre className="p-4 bg-[#050811] border border-[#1b2744] text-emerald-300 font-mono text-xs rounded-xl overflow-x-auto leading-relaxed max-h-72">
                                    {sub.code}
                                  </pre>

                                  {sub.compileError && (
                                    <div className="p-3 bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs font-mono rounded-xl">
                                      <span className="font-bold text-rose-400 block mb-1">Compiler Error:</span>
                                      <pre className="whitespace-pre-wrap overflow-x-auto">{sub.compileError}</pre>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>
              );
            })
          )}
        </div>

      </div>

      {/* DUAL-MODE AI JSON EXPORT MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#11192e] border border-[#1e2a47] rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-6 bg-[#0c1426] border-b border-[#1e2a47] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-sky-400 uppercase tracking-widest block">
                  AI EVALUATION EXPORT
                </span>
                <h3 className="text-xl font-extrabold text-white">
                  Export Assessment Report (JSON for AI)
                </h3>
              </div>

              <button
                onClick={() => setShowExportModal(false)}
                className="w-8 h-8 rounded-xl bg-[#18223a] text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Mode Tabs */}
            <div className="px-6 pt-4 pb-2 bg-[#0c1426] border-b border-[#1e2a47] flex items-center gap-3">
              <button
                type="button"
                onClick={() => setExportMode('detailed')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${
                  exportMode === 'detailed'
                    ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                    : 'bg-[#11192e] border-[#1e2a47] text-slate-400 hover:text-white'
                }`}
              >
                <span>📄</span> Detailed Report (Full Code & Tests)
              </button>

              <button
                type="button"
                onClick={() => setExportMode('summarised')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${
                  exportMode === 'summarised'
                    ? 'bg-purple-600 border-purple-500 text-white shadow-md'
                    : 'bg-[#11192e] border-[#1e2a47] text-slate-400 hover:text-white'
                }`}
              >
                <span>⚡</span> Summarised Report (Executive Summary)
              </button>
            </div>

            {/* Mode Description Banner */}
            <div className="px-6 py-3 bg-[#080d1a] border-b border-[#1e2a47] text-xs text-slate-400">
              {exportMode === 'detailed' ? (
                <p>
                  <strong className="text-sky-400">Detailed Mode:</strong> Includes complete problem statements, all submission iterations with full code, compiler diagnostics, and test case verdicts. <span className="text-slate-300">Best for pasting into AI (ChatGPT/Claude/Gemini) for deep code review, edge case diagnosis, and optimization.</span>
                </p>
              ) : (
                <p>
                  <strong className="text-purple-400">Summarised Mode:</strong> Compact report with overall accuracy, topic breakdown, per-question score, time spent, and failed areas. <span className="text-slate-300">Best for quick AI evaluation, interview readiness grading, and targeted study plan generation.</span>
                </p>
              )}
            </div>

            {/* JSON Viewer */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#050811]">
              <pre className="text-xs font-mono text-emerald-300 whitespace-pre-wrap leading-relaxed select-all">
                {currentReportString}
              </pre>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-5 bg-[#0c1426] border-t border-[#1e2a47] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-[#18223a] hover:bg-[#202d4d] border border-[#2a3656] text-slate-300 text-xs font-bold px-3.5 py-2 rounded-xl transition"
                >
                  🖨️ Print / Save PDF
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow"
                >
                  <span>{copied ? '✓' : '📋'}</span>
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy JSON for AI'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow"
                >
                  <span>💾</span> Download .json
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      <ModalConfirm
        isOpen={isDeleteModalOpen}
        title="Delete Attempt Record?"
        message="Are you sure you want to permanently delete this assessment attempt record? This action cannot be undone."
        confirmText="Delete Record"
        cancelText="Cancel"
        isDanger={true}
        onCancel={() => setIsDeleteModalOpen(false)}
        onConfirm={async () => {
          setIsDeleteModalOpen(false);
          const toastId = toast.loading('Deleting attempt record...');
          try {
            await deleteAttempt(attemptId);
            toast.success('Attempt record deleted!', { id: toastId });
            navigate('/dashboard');
          } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete attempt', { id: toastId });
          }
        }}
      />
    </div>
  );
}
