import 'dotenv/config';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { errorHandler } from './lib/errors.js';
import { initRealtime } from './lib/realtime.js';
import aiRouter from './routes/ai.js';
import authRouter from './routes/auth.js';
import dashboardRouter from './routes/dashboard.js';
import leaderboardRouter from './routes/leaderboard.js';
import progressRouter from './routes/progress.js';
import quizzesRouter from './routes/quizzes.js';
import resourcesRouter from './routes/resources.js';
import sessionsRouter from './routes/sessions.js';
import topicsRouter from './routes/topics.js';

const app = express();
// API_PORT wins locally so tools that set PORT for the web dev server don't move the API; hosts set PORT.
const port = Number(process.env.API_PORT ?? process.env.PORT ?? 4000);
const isProd = process.env.NODE_ENV === 'production';
// In production the API also serves the built React app, so everything is one origin.
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
const corsOrigin = isProd ? false : (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173');

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        // KaTeX uses inline styles, Inter comes from Google Fonts, and math.js is the calculator's external API.
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
        'connect-src': ["'self'", 'https://api.mathjs.org', 'wss:', 'ws:'],
        'img-src': ["'self'", 'data:'],
      },
    },
  }),
);
app.use(compression());
if (corsOrigin) app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 50, message: { error: 'Too many attempts. Try again later.' } });

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/topics', topicsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/quizzes', quizzesRouter);
app.use('/api/progress', progressRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/resources', resourcesRouter);
app.use('/api/ai', aiRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

if (existsSync(clientDist)) {
  // Hashed build assets never change, so browsers can cache them forever.
  app.use('/assets', express.static(path.join(clientDist, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  // Any other route is a client-side page: hand back index.html and let React Router take over.
  app.get(/^(?!\/socket\.io).*/, (_req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(errorHandler);

// Log stray async errors instead of crashing the whole server (and every live room with it).
process.on('unhandledRejection', (err) => console.error('Unhandled rejection', err));

const server = createServer(app);
initRealtime(server, corsOrigin);

server.listen(port, () => {
  console.log(`MathLink listening on http://localhost:${port}`);
});
