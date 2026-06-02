import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

import { requireAuth } from './auth.js';
import authRoutes from './routes/authRoutes.js';
import developerRoutes from './routes/developerRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import processRoutes from './routes/processRoutes.js';
import teammateRoutes from './routes/teammateRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import userRoutes from './routes/userRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const app = express();

// CLIENT_ORIGIN may be a comma-separated list of allowed origins
// (e.g. "https://ipi.vercel.app,https://www.mydomain.com").
const allowedOrigins = CLIENT_ORIGIN.split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl / same-origin / server-to-server
      if (allowedOrigins.includes(origin)) return cb(null, true);
      if (/^https?:\/\/localhost:\d+$/.test(origin)) return cb(null, true);
      if (/\.vercel\.app$/.test(new URL(origin).hostname)) return cb(null, true);
      if (/\.netlify\.app$/.test(new URL(origin).hostname)) return cb(null, true);
      cb(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);

app.use('/api', requireAuth);
app.use('/api/developers', developerRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/processes', processRoutes);
app.use('/api/teammates', teammateRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', userRoutes);

const clientDist = path.resolve(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const server = app.listen(PORT, () => {
  console.log(`IPI server listening on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\nPort ${PORT} is already in use.\n` +
        `Stop the other process, then run dev again:\n` +
        `  netstat -ano | findstr :${PORT}\n` +
        `  taskkill /PID <pid> /F\n` +
        `Or use a different port: set PORT=4001 in server/.env\n`
    );
    process.exit(1);
  }
  throw err;
});
