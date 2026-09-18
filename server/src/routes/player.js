import { Router } from 'express';
import { requireAuth } from '../middleware.js';
import { getPlaybackState, pausePlayback, startPlayback } from '../spotifyApi.js';
import { getUser, upsertUser, listQueues, queueMatchesTrack } from '../db.js';

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

    // The stored activeQueueId only reflects the last queue we explicitly created
    // or activated - if a track is actually playing and it's not part of that
    // queue (e.g. something else was picked directly in Spotify), it's stale.
    // Clear it so the UI stops showing a queue as "active" once it no longer
    // matches reality. Only do this when we have a confirmed track to compare
    // against - not when nothing/ambiguous is playing (e.g. a brief device
    // timeout), which shouldn't reset which queue you were last on.
    let activeQueueId = user?.activeQueueId ?? null;
    if (activeQueueId && state?.item) {
      const activeQueue = listQueues(req.session.spotifyId).find((q) => q.id === activeQueueId);
      if (!queueMatchesTrack(activeQueue, state)) {
        activeQueueId = null;
        upsertUser(req.session.spotifyId, { activeQueueId: null });
      }
    }

    res.json({
      ...summarizeState(state),
      activeQueueId,
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
