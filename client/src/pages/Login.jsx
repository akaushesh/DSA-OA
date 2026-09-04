import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import authService from '../services/Auth';
import { login } from '../app/authslice';
import { setRole } from '../app/roleslice';
import { myAttempts } from '../api/attempts';

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await authService.login(form.username, form.password);
      dispatch(login({ user, accessToken: authService.getAccessToken() }));
      dispatch(setRole(user.role || 'user'));
      toast.success(`Welcome back, ${user.fullName || user.username}!`);

      if (user.role !== 'admin') {
        try {
          const res = await myAttempts({ limit: 10 });
          const atts = res.data.statusCode?.attempts || [];
          const ongoing = atts.find((a) => a.status === 'in_progress');
          if (ongoing) {
            const firstProb =
              ongoing.questionSetId?.problems?.[0]?._id ||
              ongoing.questionSetId?.problems?.[0] ||
              '';
            toast('Resuming your active test session in progress...', { icon: '⚡' });
            navigate(`/attempt/${ongoing._id}/problem/${firstProb}`, { replace: true });
            return;
          }
        } catch (err) {
          // ignore error and proceed
        }
      }

      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f1c] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white"><span className="text-blue-400">&lt;/&gt;</span> DSA Arena</h1>
          <p className="text-gray-400 mt-2 text-sm">Online Assessment Platform</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-8 space-y-5">
          <h2 className="text-xl font-semibold text-white">Sign In</h2>
          {error && <div className="bg-red-900/30 border border-red-700 text-red-300 text-sm px-3 py-2 rounded">{error}</div>}
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide">Username</label>
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              className="mt-1 w-full bg-[#0f0f1c] border border-[#2d2d44] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              required autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide">Password</label>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="mt-1 w-full bg-[#0f0f1c] border border-[#2d2d44] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 rounded-lg transition"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          <p className="text-center text-sm text-gray-400">
            Don't have an account? <Link to="/register" className="text-blue-400 hover:underline">Register</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
