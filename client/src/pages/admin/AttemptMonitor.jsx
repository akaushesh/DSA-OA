import { useEffect, useState } from 'react';
import { allAttempts } from '../../api/attempts';
import Navbar from '../../components/Navbar';

const STATUS_COLORS = {
  completed: 'text-green-400',
  timed_out: 'text-red-400',
  in_progress: 'text-yellow-400',
};

export default function AttemptMonitor() {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    allAttempts({ limit: 100 })
      .then(r => setAttempts(r.data.statusCode?.attempts || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#0f0f1c] text-white">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-6">All Attempts</h1>
        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : (
          <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl overflow-hidden">
            <div className="grid grid-cols-5 px-4 py-2 border-b border-[#2d2d44] text-xs text-gray-500 uppercase tracking-wide">
              <span>User</span>
              <span>Question Set</span>
              <span>Mode</span>
              <span>Status</span>
              <span>Started</span>
            </div>
            {attempts.length === 0 && (
              <p className="text-gray-500 text-center py-10">No attempts yet.</p>
            )}
            {attempts.map(a => (
              <div key={a._id} className="grid grid-cols-5 px-4 py-3 border-b border-[#1e1e35] last:border-0 text-sm items-center">
                <span className="text-white font-mono">{a.userId?.username || '—'}</span>
                <span className="text-gray-300">{a.questionSetId?.name || '—'}</span>
                <span className="text-gray-400 text-xs">{a.timingMode}</span>
                <span className={STATUS_COLORS[a.status] || 'text-gray-400'}>
                  {a.status?.replace('_', ' ')}
                </span>
                <span className="text-gray-500 text-xs">{new Date(a.startedAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
