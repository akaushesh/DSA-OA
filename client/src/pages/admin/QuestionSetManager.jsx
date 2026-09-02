import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getQuestionSets, deleteQuestionSet } from '../../api/questionsets';
import Navbar from '../../components/Navbar';

export default function QuestionSetManager() {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getQuestionSets({ adminView: true, limit: 100 })
      .then(r => setSets(r.data.statusCode?.sets || []))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleDelete = async (id) => {
    if (!confirm('Delete this question set?')) return;
    await deleteQuestionSet(id);
    load();
  };

  return (
    <div className="min-h-screen bg-[#0f0f1c] text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Question Sets</h1>
          <Link to="/admin/questionsets/new" className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg">
            + New / Import
          </Link>
        </div>
        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : (
          <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl overflow-hidden">
            {sets.length === 0 && (
              <p className="text-gray-500 text-center py-10">No question sets yet.</p>
            )}
            {sets.map(s => (
              <div key={s._id} className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e35] last:border-0">
                <div>
                  <p className="text-white text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {s.category} · {s.timingMode} ·{' '}
                    {s.isPublished
                      ? <span className="text-green-400">Published</span>
                      : <span className="text-gray-500">Draft</span>
                    }
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    to={`/admin/questionsets/${s._id}/edit`}
                    className="text-xs text-blue-400 border border-blue-800 px-3 py-1 rounded hover:bg-blue-900/30"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(s._id)}
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
