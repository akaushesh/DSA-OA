import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { store } from './app/store';
import { Provider } from 'react-redux';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Protected, Secured } from './components/AuthLayout';

const L = (imp) => <React.Suspense fallback={null}>{React.createElement(React.lazy(imp))}</React.Suspense>;

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: L(() => import('./pages/Login')) },
      { path: 'register', element: L(() => import('./pages/Register')) },
      {
        path: 'dashboard',
        element: <Protected authentication>{L(() => import('./pages/Dashboard'))}</Protected>,
      },
      {
        path: 'upload',
        element: <Protected authentication>{L(() => import('./pages/admin/QuestionSetEditor'))}</Protected>,
      },
      {
        path: 'sets/new',
        element: <Protected authentication>{L(() => import('./pages/admin/QuestionSetEditor'))}</Protected>,
      },
      {
        path: 'problems/new',
        element: <Protected authentication>{L(() => import('./pages/admin/ProblemEditor'))}</Protected>,
      },
      {
        path: 'sets/:id',
        element: <Protected authentication>{L(() => import('./pages/QuestionSetView'))}</Protected>,
      },
      {
        path: 'attempt/:attemptId/problem/:problemId',
        element: <Protected authentication>{L(() => import('./pages/CodingArena'))}</Protected>,
      },
      {
        path: 'review/:attemptId',
        element: <Protected authentication>{L(() => import('./pages/ReviewResults'))}</Protected>,
      },
      {
        path: 'history',
        element: <Protected authentication>{L(() => import('./pages/History'))}</Protected>,
      },
      // Admin monitoring & management routes (restricted to role: admin)
      {
        path: 'admin',
        element: <Protected authentication><Secured requiredRole="admin">{L(() => import('./pages/admin/AdminDashboard'))}</Secured></Protected>,
      },
      {
        path: 'admin/problems',
        element: <Protected authentication><Secured requiredRole="admin">{L(() => import('./pages/admin/ProblemManager'))}</Secured></Protected>,
      },
      {
        path: 'admin/problems/new',
        element: <Protected authentication><Secured requiredRole="admin">{L(() => import('./pages/admin/ProblemEditor'))}</Secured></Protected>,
      },
      {
        path: 'admin/problems/:id/edit',
        element: <Protected authentication><Secured requiredRole="admin">{L(() => import('./pages/admin/ProblemEditor'))}</Secured></Protected>,
      },
      {
        path: 'admin/questionsets',
        element: <Protected authentication><Secured requiredRole="admin">{L(() => import('./pages/admin/QuestionSetManager'))}</Secured></Protected>,
      },
      {
        path: 'admin/questionsets/new',
        element: <Protected authentication><Secured requiredRole="admin">{L(() => import('./pages/admin/QuestionSetEditor'))}</Secured></Protected>,
      },
      {
        path: 'admin/questionsets/:id/edit',
        element: <Protected authentication><Secured requiredRole="admin">{L(() => import('./pages/admin/QuestionSetEditor'))}</Secured></Protected>,
      },
      {
        path: 'admin/attempts',
        element: <Protected authentication><Secured requiredRole="admin">{L(() => import('./pages/admin/AttemptMonitor'))}</Secured></Protected>,
      },
      {
        path: 'admin/users',
        element: <Protected authentication><Secured requiredRole="admin">{L(() => import('./pages/admin/UserManager'))}</Secured></Protected>,
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  </React.StrictMode>
);