import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStats } from '../../api/admin';
import Navbar from '../../components/Navbar';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    getStats().then(r => setStats(r.data.statusCode)).catch(() => {});
  }, []);

  const cards = [
    { label: 'Total Users', value: stats?.users, to: '/admin/users', color: 'blue' },
    { label: 'Live Active Tests', value: stats?.activeAttempts || 0, to: '/admin/attempts', color: stats?.activeAttempts > 0 ? 'emerald' : 'purple', isLive: stats?.activeAttempts > 0 },
    { label: 'Question Sets', value: stats?.sets, to: '/admin/questionsets', color: 'purple' },
    { label: 'Total Submissions', value: stats?.submissions, to: '/admin/attempts', color: 'yellow' },
  ];

  const BG = {
    blue: 'border-blue-800 bg-blue-900/20',
    green: 'border-green-800 bg-green-900/20',
    purple: 'border-purple-800 bg-purple-900/20',
    yellow: 'border-yellow-800 bg-yellow-900/20',
    emerald: 'border-emerald-700/80 bg-emerald-950/40 ring-1 ring-emerald-500/30 shadow-lg shadow-emerald-950/50',
  };
  const TEXT = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
    yellow: 'text-yellow-400',
    emerald: 'text-emerald-400',
  };

  return (
    <div className="min-h-screen bg-[#0b132b] text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-black mb-1">Admin Dashboard</h1>
        <p className="text-gray-400 text-sm mb-6">Monitor the platform & control assessments</p>

        {/* Live Banner if active tests are running */}
        {stats?.activeAttempts > 0 && (
          <Link
            to="/admin/attempts"
            className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-emerald-900/40 to-teal-950/60 border border-emerald-500/60 flex items-center justify-between shadow-lg shadow-emerald-950/50 hover:border-emerald-400 transition group"
          >
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></span>
              <div>
                <p className="text-white text-sm font-extrabold flex items-center gap-2">
                  <span>⚡</span> {stats.activeAttempts} Student Test(s) In-Progress Live Right Now!
                </p>
                <p className="text-xs text-emerald-300/80 mt-0.5">
                  Click here to open the Live Assessment Monitor, track real-time question progress, and exercise full supervisor control.
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-400 bg-[#080d1a] border border-emerald-500/40 px-3.5 py-1.5 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition">
              Open Live Monitor →
            </span>
          </Link>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {cards.map(c => (
            <Link key={c.label} to={c.to} className={`border rounded-xl p-5 hover:opacity-80 transition relative ${BG[c.color]}`}>
              {c.isLive && (
                <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              )}
              <p className="text-xs text-gray-400 mb-1">{c.label}</p>
              <p className={`text-3xl font-bold ${TEXT[c.color]}`}>{stats ? c.value : '—'}</p>
            </Link>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { to: '/admin/attempts', label: '🛡️ Live Assessment Monitor & Control', desc: 'Real-time visibility into all user attempts, progress, code, and controls', highlight: true },
            { to: '/admin/users', label: '👤 Manage Users', desc: 'View registered users and change roles' },
            { to: '/admin/problems/new', label: '+ New Problem', desc: 'Add a DSA problem with test cases' },
            { to: '/admin/questionsets/new', label: '+ New Question Set', desc: 'Create or import a question set' },
          ].map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={`p-4.5 rounded-xl transition border ${
                item.highlight
                  ? 'bg-purple-950/30 border-purple-600 hover:border-purple-400 shadow-md shadow-purple-950/40'
                  : 'bg-[#11192e] border-[#1f2c4b] hover:border-blue-600'
              }`}
            >
              <p className="text-white font-bold text-sm">{item.label}</p>
              <p className="text-gray-400 text-xs mt-1">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
