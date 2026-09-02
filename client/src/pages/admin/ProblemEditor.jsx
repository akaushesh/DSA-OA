import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createProblem, updateProblem, getProblem } from '../../api/problems';
import Navbar from '../../components/Navbar';

const emptyForm = {
  title: '',
  description: '',
  difficulty: 'Medium',
  category: '',
  constraints: '',
  timeLimit: 1800,
  memoryLimit: 256,
  examples: [{ input: '', output: '', explanation: '' }],
  testCases: [{ input: '', expectedOutput: '', isHidden: false }],
};

export default function ProblemEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    getProblem(id, true)
      .then(r => {
        const p = r.data.statusCode?.problem;
        if (p) setForm({
          title: p.title,
          description: p.description,
          difficulty: p.difficulty,
          category: p.category,
          constraints: p.constraints || '',
          timeLimit: p.timeLimit || 1800,
          memoryLimit: p.memoryLimit || 256,
          examples: p.examples?.length ? p.examples : emptyForm.examples,
          testCases: p.testCases?.length ? p.testCases : emptyForm.testCases,
        });
      })
      .finally(() => setLoading(false));
  }, [id]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const setTC = (i, key, val) =>
    setForm(f => ({ ...f, testCases: f.testCases.map((tc, j) => j === i ? { ...tc, [key]: val } : tc) }));

  const setEx = (i, key, val) =>
    setForm(f => ({ ...f, examples: f.examples.map((ex, j) => j === i ? { ...ex, [key]: val } : ex) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (id) await updateProblem(id, form);
      else await createProblem(form);
      navigate('/admin/problems');
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full bg-[#0f0f1c] border border-[#2d2d44] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500';
  const lbl = 'block text-xs text-gray-400 uppercase tracking-wide mb-1';

  if (loading) return (
    <div className="min-h-screen bg-[#0f0f1c] flex items-center justify-center text-white">Loading...</div>
  );

  return (
    <div className="min-h-screen bg-[#0f0f1c] text-white">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-6">{id ? 'Edit Problem' : 'New Problem'}</h1>
        {error && (
          <div className="mb-4 bg-red-900/30 border border-red-700 text-red-300 text-sm px-3 py-2 rounded">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={lbl}>Title</label>
              <input className={inp} value={form.title} onChange={e => set('title', e.target.value)} required />
            </div>
            <div>
              <label className={lbl}>Difficulty</label>
              <select className={inp} value={form.difficulty} onChange={e => set('difficulty', e.target.value)}>
                {['Easy', 'Medium', 'Hard'].map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Category</label>
              <input className={inp} value={form.category} onChange={e => set('category', e.target.value)} required placeholder="e.g. Arrays, Graphs" />
            </div>
            <div>
              <label className={lbl}>Time Limit (seconds, per-problem mode)</label>
              <input type="number" className={inp} value={form.timeLimit} onChange={e => set('timeLimit', Number(e.target.value))} />
            </div>
            <div>
              <label className={lbl}>Memory Limit (MB)</label>
              <input type="number" className={inp} value={form.memoryLimit} onChange={e => set('memoryLimit', Number(e.target.value))} />
            </div>
          </div>

          <div>
            <label className={lbl}>Description</label>
            <textarea className={inp + ' h-36 resize-y'} value={form.description} onChange={e => set('description', e.target.value)} required />
          </div>

          <div>
            <label className={lbl}>Constraints</label>
            <textarea className={inp + ' h-16 resize-y'} value={form.constraints} onChange={e => set('constraints', e.target.value)} />
          </div>

          {/* Examples */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={lbl}>Examples</label>
              <button type="button" onClick={() => set('examples', [...form.examples, { input: '', output: '', explanation: '' }])}
                className="text-xs text-blue-400 hover:text-blue-300">+ Add</button>
            </div>
            {form.examples.map((ex, i) => (
              <div key={i} className="mb-3 bg-[#1a1a2e] border border-[#2d2d44] rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={lbl}>Input</label>
                    <textarea className={inp + ' h-12 resize-y font-mono text-xs'} value={ex.input} onChange={e => setEx(i, 'input', e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>Output</label>
                    <textarea className={inp + ' h-12 resize-y font-mono text-xs'} value={ex.output} onChange={e => setEx(i, 'output', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className={lbl}>Explanation (optional)</label>
                  <input className={inp + ' text-xs'} value={ex.explanation} onChange={e => setEx(i, 'explanation', e.target.value)} />
                </div>
                {form.examples.length > 1 && (
                  <button type="button" onClick={() => set('examples', form.examples.filter((_, j) => j !== i))}
                    className="text-xs text-red-400 hover:text-red-300">Remove</button>
                )}
              </div>
            ))}
          </div>

          {/* Test Cases */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={lbl}>Test Cases</label>
              <button type="button" onClick={() => set('testCases', [...form.testCases, { input: '', expectedOutput: '', isHidden: false }])}
                className="text-xs text-blue-400 hover:text-blue-300">+ Add</button>
            </div>
            {form.testCases.map((tc, i) => (
              <div key={i} className="mb-3 bg-[#1a1a2e] border border-[#2d2d44] rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Test {i + 1}</span>
                  <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
                    <input type="checkbox" checked={tc.isHidden} onChange={e => setTC(i, 'isHidden', e.target.checked)}
                      className="accent-purple-500" />
                    <span className={tc.isHidden ? 'text-purple-400' : ''}>Hidden</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={lbl}>Input</label>
                    <textarea className={inp + ' h-20 resize-y font-mono text-xs'} value={tc.input} onChange={e => setTC(i, 'input', e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>Expected Output</label>
                    <textarea className={inp + ' h-20 resize-y font-mono text-xs'} value={tc.expectedOutput} onChange={e => setTC(i, 'expectedOutput', e.target.value)} />
                  </div>
                </div>
                {form.testCases.length > 1 && (
                  <button type="button" onClick={() => set('testCases', form.testCases.filter((_, j) => j !== i))}
                    className="text-xs text-red-400 hover:text-red-300">Remove</button>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-semibold px-6 py-2 rounded-lg">
              {saving ? 'Saving...' : 'Save Problem'}
            </button>
            <button type="button" onClick={() => navigate('/admin/problems')}
              className="border border-[#2d2d44] text-gray-400 hover:text-white px-6 py-2 rounded-lg">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
