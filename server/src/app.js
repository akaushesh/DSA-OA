import "dotenv/config";
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

const app = express();

const configuredOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'https://dsa-oa.vercel.app',
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : []),
].filter(Boolean).map(o => o.replace(/\/+$/, ''));

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  const cleanOrigin = origin.replace(/\/+$/, '');
  if (configuredOrigins.includes(cleanOrigin)) return true;
  if (cleanOrigin.startsWith('http://localhost:')) return true;
  if (/^https:\/\/.*\.vercel\.app$/.test(cleanOrigin)) return true;
  if (/^https:\/\/.*\.devtunnels\.ms$/.test(cleanOrigin)) return true;
  if (/^https:\/\/.*\.github\.dev$/.test(cleanOrigin)) return true;
  return false;
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

app.use(express.json({ limit: '5mb' }));       // 5mb for large JSON question set uploads
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(express.static('public'));
app.use(cookieParser());

app.get('/api/ping', (_, res) => res.send('pong'));

// Routes
import userRouter from './routes/user.routes.js';
import problemRouter from './routes/problem.routes.js';
import questionSetRouter from './routes/questionset.routes.js';
import submissionRouter from './routes/submission.routes.js';
import attemptRouter from './routes/attempt.routes.js';
import adminRouter from './routes/admin.routes.js';

app.use('/api/users', userRouter);
app.use('/api/problems', problemRouter);
app.use('/api/questionsets', questionSetRouter);
app.use('/api/submissions', submissionRouter);
app.use('/api/attempts', attemptRouter);
app.use('/api/admin', adminRouter);

// Global error handler
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  res.status(status).json({ success: false, message: err.message || 'Internal Server Error' });
});

export { app };