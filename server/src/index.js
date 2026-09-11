import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { playerRouter } from './routes/player.js';
import { queuesRouter } from './routes/queues.js';
import { requireAuth } from './middleware.js';
import { getUser } from './db.js';
import { startAutoSavePoller } from './autoSave.js';

const requiredEnvVars = ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SPOTIFY_REDIRECT_URI', 'SESSION_SECRET'];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}. Copy server/.env.example to server/.env and fill it in.`);
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 8888;
const CLIENT_URL = process.env.CLIENT_URL || 'http://127.0.0.1:5173';
const isProduction = process.env.NODE_ENV === 'production';

// Behind a reverse proxy (Apache/nginx) in production, so req.secure etc.
// need to trust the proxy's X-Forwarded-* headers.
if (isProduction) app.set('trust proxy', 1);

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  })
);

app.get('/api/me', requireAuth, (req, res) => {
  const user = getUser(req.session.spotifyId);
  res.json({ id: req.session.spotifyId, displayName: user?.displayName ?? null });
});

app.use('/auth', authRouter);
app.use('/api/player', playerRouter);
app.use('/api/queues', queuesRouter);

app.get('/health', (req, res) => res.json({ ok: true }));

// Bind to loopback only - in production this sits behind Apache, which is the
// only thing that should be reachable from outside the machine.
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Spotify Queues server listening on http://127.0.0.1:${PORT}`);
});

startAutoSavePoller();
