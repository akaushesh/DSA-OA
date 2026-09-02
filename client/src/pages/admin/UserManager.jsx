import { useEffect, useState } from 'react';
import { listUsers, updateUserRole } from '../../api/admin';
import Navbar from '../../components/Navbar';

export default function UserManager() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    listUsers({ limit: 100 })
      .then(r => setUsers(r.data.statusCode?.users || []))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const toggleRole = async (id, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`Change role to ${newRole}?`)) return;
    await updateUserRole(id, newRole);
    load();
  };

  return (
    <div className="min-h-screen bg-[#0f0f1c] text-white">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-6">Users</h1>
        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : (
          <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl overflow-hidden">
            <div className="grid grid-cols-4 px-4 py-2 border-b border-[#2d2d44] text-xs text-gray-500 uppercase tracking-wide">
              <span>Username</span>
              <span>Full Name</span>
              <span>Role</span>
              <span>Action</span>
            </div>
            {users.map(u => (
              <div key={u._id} className="grid grid-cols-4 px-4 py-3 border-b border-[#1e1e35] last:border-0 text-sm items-center">
                <span className="text-white font-mono">{u.username}</span>
                <span className="text-gray-300">{u.fullName}</span>
                <span className={u.role === 'admin' ? 'text-purple-400 font-semibold' : 'text-gray-400'}>{u.role}</span>
                <button
                  onClick={() => toggleRole(u._id, u.role)}
                  className="text-xs border border-[#2d2d44] text-gray-400 hover:border-blue-600 hover:text-blue-300 px-3 py-1 rounded w-fit transition"
                >
                  Make {u.role === 'admin' ? 'User' : 'Admin'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
