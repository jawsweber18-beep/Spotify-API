import { Router } from 'express';
import { requireAuth } from '../middleware.js';
import { getPlaybackState, pausePlayback, startPlayback } from '../spotifyApi.js';
import { getUser, upsertUser } from '../db.js';

export const playerRouter = Router();
playerRouter.use(requireAuth);

function summarizeState(state) {
  if (!state || !state.item) return { isPlaying: false };
  return {
    isPlaying: state.is_playing,
    progressMs: state.progress_ms,
    track: {
      uri: state.item.uri,
      name: state.item.name,
      artists: state.item.artists?.map((a) => a.name).join(', '),
      albumImageUrl: state.item.album?.images?.[0]?.url ?? null,
      durationMs: state.item.duration_ms,
    },
    contextUri: state.context?.uri ?? null,
    device: state.device ? { name: state.device.name, type: state.device.type } : null,
  };
}

playerRouter.get('/state', async (req, res) => {
  try {
    const state = await getPlaybackState(req.session.spotifyId);
    const user = getUser(req.session.spotifyId);
    res.json({
      ...summarizeState(state),
      activeQueueId: user?.activeQueueId ?? null,
      keepPlayingEnabled: !!user?.keepPlayingEnabled,
    });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'spotify_api_error', message: err.message });
  }
});

playerRouter.put('/pause', async (req, res) => {
  try {
    await pausePlayback(req.session.spotifyId);
    // This is the one thing the keep-playing watchdog treats as a real,
    // intentional pause - it won't fight this.
    upsertUser(req.session.spotifyId, { desiredState: 'paused' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'spotify_api_error', message: err.message });
  }
});

playerRouter.put('/resume', async (req, res) => {
  try {
    await startPlayback(req.session.spotifyId);
    upsertUser(req.session.spotifyId, { desiredState: 'playing' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'spotify_api_error', message: err.message });
  }
});

// Toggles the "force keep playing" watchdog. Turning it on also declares
// intent to be playing right now, so the watchdog starts enforcing immediately.
playerRouter.put('/keep-playing', (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled_required' });
  }
  const user = upsertUser(req.session.spotifyId, {
    keepPlayingEnabled: enabled,
    desiredState: enabled ? 'playing' : null,
  });
  res.json({ keepPlayingEnabled: user.keepPlayingEnabled });
});
