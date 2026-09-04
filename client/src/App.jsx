import { useDispatch } from 'react-redux';
import { useEffect, useState } from 'react';
import authService from './services/Auth.js';
import Loader from './components/Loader.jsx';
import { login, logout } from './app/authslice';
import { setRole } from './app/roleslice';
import { Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

function App() {
  const [loading, setLoading] = useState(true);
  const dispatch = useDispatch();

  useEffect(() => {
    const token = authService.getAccessToken();
    if (token && !authService.isTokenExpired(token)) {
      authService.setAuthHeader(token);
      authService
        .getCurrentUser()
        .then((user) => {
          if (user) {
            dispatch(login({ user, accessToken: token }));
            dispatch(setRole(user.role || 'user'));
          } else {
            dispatch(logout());
            authService.clearAuthData();
          }
        })
        .catch(() => {
          dispatch(logout());
          authService.clearAuthData();
        })
        .finally(() => setLoading(false));
    } else {
      if (token) authService.clearAuthData();
      dispatch(logout());
      setLoading(false);
    }
  }, [dispatch]);

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#0f172a',
            color: '#f8fafc',
            border: '1.5px solid #2563eb',
            borderRadius: '16px',
            fontSize: '15px',
            fontWeight: '600',
            padding: '14px 22px',
            minWidth: '320px',
            maxWidth: '480px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(37, 99, 235, 0.3)',
          },
          success: {
            style: {
              border: '1.5px solid #10b981',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(16, 185, 129, 0.3)',
            },
            iconTheme: {
              primary: '#10b981',
              secondary: '#0f172a',
            },
          },
          error: {
            style: {
              border: '1.5px solid #f43f5e',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(244, 63, 94, 0.3)',
            },
            iconTheme: {
              primary: '#f43f5e',
              secondary: '#0f172a',
            },
          },
        }}
      />
      {loading ? <Loader /> : <Outlet />}
    </>
  );
}

export default App;