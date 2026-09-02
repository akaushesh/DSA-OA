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
    { label: 'Problems', value: stats?.problems, to: '/admin/problems', color: 'green' },
    { label: 'Question Sets', value: stats?.sets, to: '/admin/questionsets', color: 'purple' },
    { label: 'Submissions', value: stats?.submissions, to: '/admin/attempts', color: 'yellow' },
  ];

  const BG = { blue: 'border-blue-800 bg-blue-900/20', green: 'border-green-800 bg-green-900/20', purple: 'border-purple-800 bg-purple-900/20', yellow: 'border-yellow-800 bg-yellow-900/20' };
  const TEXT = { blue: 'text-blue-400', green: 'text-green-400', purple: 'text-purple-400', yellow: 'text-yellow-400' };

  return (
    <div className="min-h-screen bg-[#0f0f1c] text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-gray-400 text-sm mb-8">Monitor the platform</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {cards.map(c => (
            <Link key={c.label} to={c.to} className={`border rounded-xl p-5 hover:opacity-80 transition ${BG[c.color]}`}>
              <p className="text-xs text-gray-400 mb-1">{c.label}</p>
              <p className={`text-3xl font-bold ${TEXT[c.color]}`}>{stats ? c.value : '—'}</p>
            </Link>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { to: '/admin/problems/new', label: '+ New Problem', desc: 'Add a DSA problem with test cases' },
            { to: '/admin/questionsets/new', label: '+ New Question Set', desc: 'Create or import a question set' },
            { to: '/admin/attempts', label: '📋 View All Attempts', desc: 'Monitor all user attempts' },
            { to: '/admin/users', label: '👤 Manage Users', desc: 'View users and change roles' },
          ].map(item => (
            <Link key={item.to} to={item.to} className="bg-[#1a1a2e] border border-[#2d2d44] hover:border-blue-600 rounded-xl p-4 transition">
              <p className="text-white font-medium">{item.label}</p>
              <p className="text-gray-400 text-sm mt-0.5">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
