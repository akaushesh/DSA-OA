import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createQuestionSet, importQuestionSet, updateQuestionSet, getQuestionSet } from '../../api/questionsets';
import { normalizeStarterCode } from '../../utils/starterCode';
import Navbar from '../../components/Navbar';

const SAMPLE_DSA_JSON = [
  {
    "title": "Number of Islands",
    "difficulty": "Medium",
    "category": "Graphs",
    "description": "Given an m x n 2D binary grid grid which represents a map of '1's (land) and '0's (water), return the number of islands.\n\nAn island is surrounded by water and is formed by connecting adjacent lands horizontally or vertically. You may assume all four edges of the grid are all surrounded by water.",
    "inputFormat": "First line contains two space-separated integers m and n.\nNext m lines each contain n space-separated characters ('0' or '1').",
    "outputFormat": "Print a single integer representing the total number of islands.",
    "constraints": "1 <= m, n <= 300\ngrid[i][j] is '0' or '1'",
    "starterCode": {
      "cpp": "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // Boilerplate for Number of Islands\n    return 0;\n}",
      "java": "import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        // Boilerplate for Number of Islands\n    }\n}"
    },
    "examples": [
      {
        "input": "grid = [[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"0\",\"0\",\"1\",\"0\",\"0\"],[\"0\",\"0\",\"0\",\"1\",\"1\"]]",
        "output": "3",
        "explanation": "There are 3 separate connected components of 1s."
      }
    ],
    "timeLimit": 900,
    "memoryLimit": 256,
    "testCases": [
      { "input": "4 5\n1 1 0 0 0\n1 1 0 0 0\n0 0 1 0 0\n0 0 0 1 1", "expectedOutput": "3", "isHidden": false },
      { "input": "3 3\n1 1 1\n0 1 0\n1 1 1", "expectedOutput": "1", "isHidden": true }
    ]
  },
  {
    "title": "Two Sum",
    "difficulty": "Easy",
    "category": "Arrays",
    "description": "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.",
    "inputFormat": "First line contains two space-separated integers n and target.\nSecond line contains n space-separated integers representing array nums.",
    "outputFormat": "Print two space-separated indices.",
    "constraints": "2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9",
    "examples": [
      {
        "input": "nums = [2,7,11,15], target = 9",
        "output": "[0,1]",
        "explanation": "Because nums[0] + nums[1] == 9, we return [0, 1]."
      }
    ],
    "timeLimit": 600,
    "memoryLimit": 256,
    "testCases": [
      { "input": "4 9\n2 7 11 15", "expectedOutput": "0 1", "isHidden": false },
      { "input": "3 6\n3 2 4", "expectedOutput": "1 2", "isHidden": true }
    ]
  },
  {
    "title": "Coin Change",
    "difficulty": "Medium",
    "category": "Dynamic Programming",
    "description": "You are given an integer array coins representing coins of different denominations and an integer amount representing a total amount of money.\n\nReturn the fewest number of coins that you need to make up that amount. If that amount of money cannot be made up by any combination of the coins, return -1.",
    "inputFormat": "First line contains two space-separated integers n and amount.\nSecond line contains n space-separated integers representing the coins array.",
    "outputFormat": "Print a single integer representing the fewest coins needed, or -1 if not possible.",
    "constraints": "1 <= coins.length <= 12\n1 <= coins[i] <= 2^31 - 1\n0 <= amount <= 10^4",
    "examples": [
      {
        "input": "coins = [1,2,5], amount = 11",
        "output": "3",
        "explanation": "11 = 5 + 5 + 1"
      }
    ],
    "timeLimit": 1200,
    "memoryLimit": 256,
    "testCases": [
      { "input": "3 11\n1 2 5", "expectedOutput": "3", "isHidden": false },
      { "input": "1 0\n1", "expectedOutput": "0", "isHidden": true },
      { "input": "1 3\n2", "expectedOutput": "-1", "isHidden": true }
    ]
  }
];

const TIMER_PRESETS = [5, 10, 15, 20, 30, 45, 60];

export default function QuestionSetEditor() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('General');
  const [timerMinutes, setTimerMinutes] = useState(15);
  const [timingMode, setTimingMode] = useState('per_problem'); // 'collective' | 'per_problem'
  const [jsonInput, setJsonInput] = useState(JSON.stringify(SAMPLE_DSA_JSON, null, 2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!!id);

  useEffect(() => {
    if (id) {
      getQuestionSet(id)
        .then(r => {
          const s = r.data.statusCode?.set;
          if (s) {
            setTitle(s.name || '');
            setCategory(s.category || 'General');
            setTimingMode(s.timingMode || 'per_problem');
            setTimerMinutes(Math.round((s.totalTimeLimit || 900) / 60));

            if (s.problems && s.problems.length > 0) {
              const formattedProblems = s.problems.map(p => ({
                ...(p._id ? { _id: p._id } : {}),
                title: p.title,
                difficulty: p.difficulty,
                category: p.category || s.category || 'General',
                description: p.description,
                inputFormat: p.inputFormat || p.input_format || '',
                outputFormat: p.outputFormat || p.output_format || '',
                constraints: p.constraints || '',
                starterCode: normalizeStarterCode(p.starterCode || p.starter_code),
                examples: p.examples || [],
                timeLimit: p.timeLimit || s.totalTimeLimit || 900,
                memoryLimit: p.memoryLimit || 256,
                testCases: p.testCases || [],
              }));
              setJsonInput(JSON.stringify(formattedProblems, null, 2));
            }
          }
        })
        .catch(err => {
          toast.error('Failed to load question set details');
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  // Parse and validate live questions from JSON
  const parsedData = useMemo(() => {
    try {
      if (!jsonInput.trim()) return { valid: false, error: 'JSON cannot be empty', items: [] };
      const parsed = JSON.parse(jsonInput);
      
      const rawItems = Array.isArray(parsed) ? parsed : (parsed.problems || parsed.questions || [parsed]);
      const items = rawItems.map(item => {
        const rawStarter = item.starterCode ?? item.starter_code ?? item.starter ?? item.boilerplate ?? item.template ?? item.code;
        return {
          ...item,
          starterCode: normalizeStarterCode(rawStarter),
        };
      });
      
      const sections = {};
      items.forEach(item => {
        const sec = item.section || item.category || category || 'General';
        sections[sec] = (sections[sec] || 0) + 1;
      });

      return {
        valid: true,
        error: null,
        items,
        count: items.length,
        sections,
        sectionCount: Object.keys(sections).length,
      };
    } catch (err) {
      return {
        valid: false,
        error: err.message,
        items: [],
        count: 0,
        sections: {},
        sectionCount: 0,
      };
    }
  }, [jsonInput, category]);

  // Update a single question's timeLimit in JSON string
  const updateQuestionTimer = (index, minutes) => {
    if (!parsedData.valid) return;
    try {
      const items = [...parsedData.items];
      if (items[index]) {
        items[index] = {
          ...items[index],
          timeLimit: minutes * 60,
        };
        setJsonInput(JSON.stringify(items, null, 2));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const applyGlobalTimerToAll = (mins) => {
    setTimerMinutes(mins);
    if (!parsedData.valid) return;
    try {
      const items = parsedData.items.map(item => ({
        ...item,
        timeLimit: mins * 60,
      }));
      setJsonInput(JSON.stringify(items, null, 2));
    } catch (err) {
      console.error(err);
    }
  };

  const handleInsertSample = () => {
    setTitle('Blind 75 Core Practice Set');
    setCategory('DSA & Algorithms');
    setTimingMode('per_problem');
    setTimerMinutes(15);
    setJsonInput(JSON.stringify(SAMPLE_DSA_JSON, null, 2));
    setError('');
    toast.success('Sample DSA problem set loaded into editor');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please provide a Question Set Title');
      toast.error('Please provide a Question Set Title');
      return;
    }

    if (!parsedData.valid) {
      setError(`Invalid JSON: ${parsedData.error}`);
      toast.error(`Invalid JSON syntax: ${parsedData.error}`);
      return;
    }

    if (!parsedData.items.length) {
      setError('At least one problem/question must be provided in the JSON array');
      toast.error('At least one problem must be in JSON array');
      return;
    }

    setSaving(true);
    const toastId = toast.loading('Uploading question set to database...');
    try {
      const payload = {
        name: title.trim(),
        category: category.trim() || 'General',
        description: `Practice question set containing ${parsedData.count} assessment problems`,
        timingMode: timingMode,
        totalTimeLimit: timerMinutes * 60,
        isPublished: true,
        problems: parsedData.items.map((p, idx) => {
          const rawStarter = p.starterCode ?? p.starter_code ?? p.starter ?? p.boilerplate ?? p.template ?? p.code;
          return {
            ...(p._id ? { _id: p._id } : {}),
            title: p.title || p.questionText || `Problem ${idx + 1}`,
            description: p.description || p.questionText || '',
            difficulty: p.difficulty || 'Medium',
            category: p.category || p.section || category || 'General',
            inputFormat: p.inputFormat || p.input_format || '',
            outputFormat: p.outputFormat || p.output_format || '',
            constraints: p.constraints || '',
            starterCode: normalizeStarterCode(rawStarter),
            timeLimit: p.timeLimit || timerMinutes * 60,
            memoryLimit: p.memoryLimit || 256,
            examples: p.examples || [],
            testCases: p.testCases || (p.options ? [
              { input: '1', expectedOutput: p.correctAnswer || p.answer || 'A', isHidden: false }
            ] : [
              { input: 'sample', expectedOutput: 'output', isHidden: false }
            ]),
          };
        }),
      };

      if (id) {
        await updateQuestionSet(id, payload);
        toast.success('Question set updated successfully!', { id: toastId });
      } else {
        await importQuestionSet(payload);
        toast.success('Question set uploaded and published!', { id: toastId });
      }

      navigate('/dashboard');
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Upload failed';
      setError(errMsg);
      toast.error(errMsg, { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b132b] flex items-center justify-center text-white">
        <div className="animate-pulse text-gray-400">Loading Question Set...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b132b] text-slate-100 font-sans pb-16">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 pt-8">
        {/* Header Eyebrow & Title */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <span className="text-xs font-bold tracking-widest text-sky-400 uppercase">
              QUESTION MANAGEMENT
            </span>
            <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1">
              Bulk Upload Question Set
            </h1>
          </div>
          <Link
            to="/dashboard"
            className="bg-[#18223a] hover:bg-[#202d4d] border border-[#2a3656] text-slate-300 text-sm font-medium px-4 py-2 rounded-xl transition flex items-center gap-2 shadow-sm"
          >
            Back to Dashboard
          </Link>
        </div>

        {error && (
          <div className="mb-6 bg-red-950/50 border border-red-800 text-red-300 text-sm px-4 py-3 rounded-xl flex items-center justify-between shadow-lg">
            <span>⚠️ {error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-white font-bold ml-4">✕</button>
          </div>
        )}

        {/* 2-Column Split: Form (Left) + Live Preview (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: UPLOAD FORM */}
          <form onSubmit={handleSubmit} className="lg:col-span-6 bg-[#11192e] border border-[#1e2a47] rounded-2xl p-6 space-y-6 shadow-xl">
            
            {/* Question Set Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                QUESTION SET TITLE
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. DBMS & SQL Aptitude Practice Set"
                className="w-full bg-[#0a0f1d] border border-[#232f48] text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                CATEGORY
              </label>
              <input
                type="text"
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="General, Graphs, Arrays, DP..."
                className="w-full bg-[#0a0f1d] border border-[#232f48] text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
                required
              />
            </div>

            {/* Timing Mode & Default Timer Duration */}
            <div className="bg-[#152038] border border-[#202e4d] rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  ASSESSMENT TIMING MODE
                </label>
                <span className="text-[11px] text-sky-400 font-medium">
                  {timingMode === 'per_problem' ? '⏱ Individual Timer per Question' : '⏱ Collective Timer (One total timer)'}
                </span>
              </div>

              {/* Timing Mode Segmented Tabs */}
              <div className="grid grid-cols-2 gap-2 bg-[#0a0f1d] p-1 rounded-xl border border-[#232f48]">
                <button
                  type="button"
                  onClick={() => setTimingMode('per_problem')}
                  className={`py-2 text-xs font-bold rounded-lg transition ${
                    timingMode === 'per_problem'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ⚡ Per-Question Timers
                </button>
                <button
                  type="button"
                  onClick={() => setTimingMode('collective')}
                  className={`py-2 text-xs font-bold rounded-lg transition ${
                    timingMode === 'collective'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ⏳ Collective Set Timer
                </button>
              </div>

              {/* Global Default Timer */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">
                  {timingMode === 'per_problem' ? 'DEFAULT QUESTION DURATION (Quick apply)' : 'TOTAL ASSESSMENT TIME'}
                </label>
                
                {/* Preset Buttons */}
                <div className="grid grid-cols-7 gap-1.5 mb-2.5">
                  {TIMER_PRESETS.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => applyGlobalTimerToAll(preset)}
                      className={`py-1.5 text-xs font-semibold rounded-lg transition border ${
                        timerMinutes === preset
                          ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-900/50'
                          : 'bg-[#18223a] border-[#243352] text-slate-300 hover:border-slate-500 hover:text-white'
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
                    max="300"
                    value={timerMinutes}
                    onChange={e => applyGlobalTimerToAll(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-[#0a0f1d] border border-[#232f48] text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-sky-500 pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                    min
                  </span>
                </div>
              </div>

              {/* Per-Question Individual Timers List (if per_problem mode) */}
              {timingMode === 'per_problem' && parsedData.valid && parsedData.items.length > 0 && (
                <div className="pt-3 border-t border-[#232f48] space-y-2">
                  <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider block">
                    CUSTOM QUESTION TIMERS ({parsedData.items.length} QUESTIONS)
                  </span>
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-700">
                    {parsedData.items.map((q, idx) => {
                      const qMins = Math.round((q.timeLimit || timerMinutes * 60) / 60);
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-3 bg-[#0d1527] border border-[#1e2a47] px-3 py-2 rounded-xl text-xs"
                        >
                          <span className="truncate max-w-[180px] font-medium text-slate-200">
                            Q{idx + 1}. {q.title || q.questionText || 'Problem'}
                          </span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {[5, 10, 15, 20, 30].map(m => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => updateQuestionTimer(idx, m)}
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition ${
                                  qMins === m
                                    ? 'bg-sky-600 border-sky-500 text-white font-bold'
                                    : 'bg-[#18223a] border-[#243352] text-slate-400 hover:text-white'
                                }`}
                              >
                                {m}m
                              </button>
                            ))}
                            <div className="flex items-center bg-[#0a0f1d] border border-[#243352] rounded px-1.5 py-0.5">
                              <input
                                type="number"
                                min="1"
                                max="180"
                                value={qMins}
                                onChange={e => updateQuestionTimer(idx, Math.max(1, Number(e.target.value)))}
                                className="w-8 bg-transparent text-white font-bold text-center text-xs focus:outline-none"
                              />
                              <span className="text-[10px] text-slate-500">m</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Validation Banner + Insert Sample */}
            <div className="flex items-center justify-between bg-[#152038] border border-[#223152] rounded-xl px-4 py-3 text-xs">
              <div className="flex items-center gap-2">
                <span className={parsedData.valid ? 'text-emerald-400' : 'text-rose-400'}>
                  {parsedData.valid ? '●' : '▲'}
                </span>
                <span className={parsedData.valid ? 'text-emerald-300 font-medium' : 'text-rose-300 font-medium'}>
                  {parsedData.valid
                    ? `Valid — ${parsedData.count} question${parsedData.count === 1 ? '' : 's'}${parsedData.sectionCount > 1 ? `, ${parsedData.sectionCount} sections` : ''}`
                    : `Invalid JSON syntax: ${parsedData.error}`}
                </span>
              </div>
              <button
                type="button"
                onClick={handleInsertSample}
                className="text-sky-400 hover:text-sky-300 font-semibold underline underline-offset-2 hover:opacity-90"
              >
                Insert Sample
              </button>
            </div>

            {/* JSON Textarea */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                JSON QUESTIONS ARRAY
              </label>
              <textarea
                value={jsonInput}
                onChange={e => setJsonInput(e.target.value)}
                rows={13}
                className="w-full bg-[#080d1a] border border-[#202c47] text-emerald-400 font-mono text-xs rounded-xl p-4 leading-relaxed focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 resize-y"
                placeholder='[ { "title": "...", "description": "...", "starterCode": { "cpp": "...", "java": "..." }, "testCases": [...] } ]'
                spellCheck={false}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={saving || !parsedData.valid}
              className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none text-white font-bold py-3.5 rounded-xl text-sm transition shadow-lg shadow-blue-900/40"
            >
              {saving ? 'Uploading Question Set...' : 'Upload Question Set'}
            </button>
          </form>

          {/* RIGHT COLUMN: LIVE QUESTION PREVIEW */}
          <div className="lg:col-span-6 bg-[#11192e] border border-[#1e2a47] rounded-2xl p-6 shadow-xl sticky top-6 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#1e2a47] flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sky-400 text-sm">👁</span>
                <span className="text-xs font-bold tracking-widest text-sky-400 uppercase">
                  LIVE QUESTION PREVIEW
                </span>
              </div>
              <span className="text-xs font-medium text-slate-400 bg-[#18223a] px-2.5 py-1 rounded-full border border-[#243352]">
                {parsedData.count} question{parsedData.count === 1 ? '' : 's'}
              </span>
            </div>

            {/* Scrollable Questions Container */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-slate-700">
              {!parsedData.valid && (
                <div className="p-8 text-center bg-[#0d1527] border border-rose-900/50 rounded-xl">
                  <div className="text-rose-400 text-3xl mb-2">⚠️</div>
                  <p className="text-rose-300 font-semibold text-sm">Cannot Render Preview</p>
                  <p className="text-slate-400 text-xs mt-1">{parsedData.error}</p>
                </div>
              )}

              {parsedData.valid && parsedData.items.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-sm">
                  Paste JSON in the left panel to preview questions here.
                </div>
              )}

              {parsedData.valid && parsedData.items.map((q, idx) => {
                const qTitle = q.title || q.questionText || `Question ${idx + 1}`;
                const qCategory = q.category || q.section || category || 'General';
                const qDifficulty = q.difficulty || 'Medium';
                const qMins = Math.round((q.timeLimit || timerMinutes * 60) / 60);
                const hasOptions = q.optionA || q.options;
                const correctAnswer = q.correctAnswer || q.answer || 'A';

                return (
                  <div
                    key={idx}
                    className="bg-[#152038] border border-[#223152] rounded-xl p-5 hover:border-sky-500/50 transition group"
                  >
                    {/* Top Row: Q# Badge + Section + Timer Badge + Answer/Difficulty Badge */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="bg-[#223152] text-sky-300 font-bold text-xs px-2.5 py-0.5 rounded-md">
                          Q{idx + 1}
                        </span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-400/90 bg-sky-950/60 border border-sky-800/60 px-2 py-0.5 rounded">
                          {qCategory}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* Per-question Timer Badge */}
                        <div className="flex items-center gap-1 bg-[#0a0f1d] border border-sky-800/50 text-sky-300 px-2.5 py-0.5 rounded-full text-xs font-mono">
                          <span>⏱</span>
                          <input
                            type="number"
                            min="1"
                            max="180"
                            value={qMins}
                            onChange={e => updateQuestionTimer(idx, Math.max(1, Number(e.target.value)))}
                            className="w-7 bg-transparent text-center font-bold text-white focus:outline-none"
                            title="Click to change duration for this question"
                          />
                          <span className="text-slate-400 text-[10px]">min</span>
                        </div>

                        {hasOptions ? (
                          <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-0.5 rounded-full">
                            Answer: {correctAnswer}
                          </span>
                        ) : (
                          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                            qDifficulty === 'Easy'
                              ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60'
                              : qDifficulty === 'Hard'
                              ? 'text-rose-400 bg-rose-950/60 border-rose-800/60'
                              : 'text-amber-400 bg-amber-950/60 border-amber-800/60'
                          }`}>
                            {qDifficulty}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Question Statement / Title */}
                    <h3 className="text-white font-semibold text-sm leading-relaxed mb-3">
                      {qTitle}
                    </h3>

                    {/* Description preview if present */}
                    {q.description && q.description !== qTitle && (
                      <div className="text-slate-300 text-xs leading-relaxed mb-3 whitespace-pre-wrap max-h-40 overflow-y-auto bg-[#0c1426] p-3 rounded-lg border border-[#1b2744] scrollbar-thin scrollbar-thumb-slate-700">
                        {q.description}
                      </div>
                    )}

                    {/* Input Format preview if present */}
                    {q.inputFormat && (
                      <div className="text-slate-300 text-xs mb-3 bg-[#0c1426] p-2.5 rounded-lg border border-[#1b2744]">
                        <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block mb-1">Input Format:</span>
                        <pre className="text-slate-200 font-mono text-[11px] whitespace-pre-wrap">{q.inputFormat}</pre>
                      </div>
                    )}

                    {/* Starter Code Indicator if present */}
                    {(q.starterCode?.cpp || q.starterCode?.java) && (
                      <div className="mb-3 flex items-center gap-2 text-[11px] font-mono text-purple-300 bg-purple-950/40 border border-purple-800/50 px-2.5 py-1 rounded-lg">
                        <span>⚡ Starter Code:</span>
                        {q.starterCode.cpp && <span className="bg-purple-900/60 px-1.5 py-0.5 rounded text-[10px]">C++</span>}
                        {q.starterCode.java && <span className="bg-purple-900/60 px-1.5 py-0.5 rounded text-[10px]">Java</span>}
                      </div>
                    )}

                    {/* MCQs Option Grid if this is an Aptitude/MCQ item */}
                    {hasOptions && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                        {['A', 'B', 'C', 'D'].map(opt => {
                          const optText = q[`option${opt}`] || (q.options && q.options[opt.charCodeAt(0) - 65]) || `Option ${opt}`;
                          const isCorrect = correctAnswer.toUpperCase() === opt;
                          return (
                            <div
                              key={opt}
                              className={`px-3 py-2 rounded-lg text-xs border flex items-start gap-2 ${
                                isCorrect
                                  ? 'bg-emerald-950/70 border-emerald-700 text-emerald-300 font-medium'
                                  : 'bg-[#0f172a] border-[#202c47] text-slate-300'
                              }`}
                            >
                              <span className={`font-bold ${isCorrect ? 'text-emerald-400' : 'text-slate-500'}`}>
                                {opt}.
                              </span>
                              <span className="truncate">{optText}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* DSA Test cases preview if present */}
                    {q.testCases?.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-[#223152]/60 flex items-center justify-between text-xs text-slate-400">
                        <span>🧪 {q.testCases.length} Test Case{q.testCases.length === 1 ? '' : 's'}</span>
                        <span className="text-slate-500">
                          {q.testCases.filter(t => !t.isHidden).length} visible, {q.testCases.filter(t => t.isHidden).length} hidden
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
