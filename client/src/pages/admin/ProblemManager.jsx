import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProblems, deleteProblem } from '../../api/problems';
import Navbar from '../../components/Navbar';
import DifficultyChip from '../../components/DifficultyChip';

export default function ProblemManager() {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getProblems({ limit: 100 })
      .then(r => setProblems(r.data.statusCode?.problems || []))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleDelete = async (id) => {
    if (!confirm('Delete this problem?')) return;
    await deleteProblem(id);
    load();
  };

  return (
    <div className="min-h-screen bg-[#0f0f1c] text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Problems</h1>
          <Link to="/admin/problems/new" className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg">
            + New Problem
          </Link>
        </div>
        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : (
          <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl overflow-hidden">
            {problems.length === 0 && (
              <p className="text-gray-500 text-center py-10">No problems yet. Create your first one.</p>
            )}
            {problems.map((p, i) => (
              <div key={p._id} className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e35] last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-gray-600 text-sm w-6">{i + 1}.</span>
                  <span className="text-white text-sm font-medium">{p.title}</span>
                  <DifficultyChip difficulty={p.difficulty} />
                  <span className="text-xs text-gray-500 bg-[#0f0f1c] px-2 py-0.5 rounded">{p.category}</span>
                </div>
                <div className="flex gap-2">
                  <Link
                    to={`/admin/problems/${p._id}/edit`}
                    className="text-xs text-blue-400 border border-blue-800 px-3 py-1 rounded hover:bg-blue-900/30"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(p._id)}
                    className="text-xs text-red-400 border border-red-800 px-3 py-1 rounded hover:bg-red-900/30"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
