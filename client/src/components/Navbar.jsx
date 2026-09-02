import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { logout } from '../app/authslice';
import authService from '../services/Auth';

export default function Navbar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { userData } = useSelector(s => s.auth);
  const role = useSelector(s => s.role?.role || s.auth?.userData?.role);

  const handleLogout = async () => {
    await authService.logout();
    dispatch(logout());
    navigate('/');
  };

  const username = userData?.username || 'User';
  const initial = username.charAt(0).toUpperCase();

  return (
    <nav className="bg-[#0b132b]/95 backdrop-blur border-b border-[#1b2744] px-6 py-3.5 flex items-center justify-between sticky top-0 z-50">
      {/* Brand Logo */}
      <Link to="/dashboard" className="flex items-center gap-3 group">
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-900/40 group-hover:scale-105 transition-transform">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <div className="text-white font-extrabold text-base tracking-tight leading-none flex items-center gap-1.5">
            DSA OA <span className="text-xs font-semibold text-sky-400 font-mono">PORTAL</span>
          </div>
          <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase leading-tight block mt-0.5">
            PRACTICE & ASSESSMENT
          </span>
        </div>
      </Link>

      {/* Navigation Links & User Pill */}
      <div className="flex items-center gap-4">
        <Link
          to="/dashboard"
          className={`text-xs font-semibold transition px-3 py-1.5 rounded-lg ${
            location.pathname === '/dashboard'
              ? 'text-white bg-[#152038]'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          Dashboard
        </Link>

        {/* + Upload Set button */}
        <Link
          to="/upload"
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-blue-900/30 active:scale-95"
        >
          <span>＋</span> Upload Set
        </Link>

        {/* Admin Panel (Admin only) */}
        {role === 'admin' && (
          <Link
            to="/admin"
            className="text-xs font-semibold text-purple-300 hover:text-purple-200 border border-purple-800 bg-purple-950/40 px-3.5 py-2 rounded-xl transition flex items-center gap-1.5"
          >
            <span>🛡️</span> Admin Panel
          </Link>
        )}

        {/* History */}
        <Link
          to="/history"
          className={`text-xs font-semibold transition px-2.5 py-1.5 rounded-lg ${
            location.pathname === '/history'
              ? 'text-white bg-[#152038]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          History
        </Link>

        {/* User Pill */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#1f2c4b]">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-inner">
            {initial}
          </div>
          <span className="text-xs font-semibold text-slate-200">{username}</span>
          <button
            onClick={handleLogout}
            title="Logout"
            className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-[#18223a] transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}
