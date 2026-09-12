import { Router } from 'express';
import crypto from 'node:crypto';
import { requireAuth } from '../middleware.js';
import { listQueues, addQueue, updateQueue, removeQueue, upsertUser, getUser } from '../db.js';
import { getPlaybackState, getQueue, startPlayback, getAvailableDevices } from '../spotifyApi.js';

export const queuesRouter = Router();
queuesRouter.use(requireAuth);

// Total tracks kept per saved queue: the current one plus up to this many upcoming.
const MAX_UPCOMING_TRACKS = 50;

// Snapshot of "what's playing right now, plus what's queued up next" - this is what
// gets replayed when a saved queue is later activated, so switching back to it resumes
// the current song *and* picks up the following songs, not just a lone bookmark.
async function buildQueueSnapshot(spotifyId) {
  const [state, queue] = await Promise.all([getPlaybackState(spotifyId), getQueue(spotifyId)]);
  if (!state?.item) return null;

  const upcoming = (queue?.queue ?? []).map((t) => t.uri);
  return {
    trackUris: [state.item.uri, ...upcoming].slice(0, MAX_UPCOMING_TRACKS + 1),
    contextUri: state.context?.uri ?? null,
    trackName: state.item.name,
    artistName: state.item.artists?.map((a) => a.name).join(', ') ?? '',
    albumImageUrl: state.item.album?.images?.[0]?.url ?? null,
    positionMs: state.progress_ms,
    savedAt: Date.now(),
  };
}

// Spotify's play endpoint targets whichever device is already "active" and fails
// outright if there isn't one - which is exactly the case where nothing is playing
// yet. When that happens, fall back to explicitly targeting an available device
// (Spotify open somewhere, even idle) instead of leaving the user stuck.
async function resolveDeviceIdIfNeeded(spotifyId) {
  const state = await getPlaybackState(spotifyId);
  if (state) return undefined; // a device is already active - no need to target one

  const devices = await getAvailableDevices(spotifyId);
  const chosen = devices.find((d) => !d.is_restricted) ?? devices[0];
  if (!chosen) {
    const err = new Error('No Spotify devices available');
    err.code = 'no_devices';
    throw err;
  }
  return chosen.id;
}

queuesRouter.get('/', (req, res) => {
  res.json(listQueues(req.session.spotifyId));
});

// Save whatever's currently playing, plus what's queued up next, as a new named slot.
queuesRouter.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name_required' });
  }

  try {
    const snapshot = await buildQueueSnapshot(req.session.spotifyId);
    if (!snapshot) {
      return res.status(409).json({
        error: 'nothing_playing',
        message: 'Start playing something in Spotify first, then save it as a queue.',
      });
    }

    const queue = { id: crypto.randomUUID(), name: name.trim(), ...snapshot };
    addQueue(req.session.spotifyId, queue);
    upsertUser(req.session.spotifyId, { activeQueueId: queue.id });
    res.status(201).json(queue);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'spotify_api_error', message: err.message });
  }
});

// Overwrite a saved slot with wherever playback (and its upcoming queue) currently is
// (e.g. tap "Save" right before switching away, or periodically while working out).
queuesRouter.put('/:id/save', async (req, res) => {
  try {
    const snapshot = await buildQueueSnapshot(req.session.spotifyId);
    if (!snapshot) {
      return res.status(409).json({ error: 'nothing_playing' });
    }
    const updated = updateQueue(req.session.spotifyId, req.params.id, snapshot);
    if (!updated) return res.status(404).json({ error: 'not_found' });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'spotify_api_error', message: err.message });
  }
});

queuesRouter.patch('/:id', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name_required' });
  const updated = updateQueue(req.session.spotifyId, req.params.id, { name: name.trim() });
  if (!updated) return res.status(404).json({ error: 'not_found' });
  res.json(updated);
});

queuesRouter.delete('/:id', (req, res) => {
  const removed = removeQueue(req.session.spotifyId, req.params.id);
  if (!removed) return res.status(404).json({ error: 'not_found' });
  res.status(204).end();
});

// Switch playback to this saved slot. Whatever queue is currently active gets its
// position auto-saved first, so you never lose your place when you switch away.
queuesRouter.post('/:id/activate', async (req, res) => {
  const spotifyId = req.session.spotifyId;
  const targetId = req.params.id;

  try {
    const queues = listQueues(spotifyId);
    const target = queues.find((q) => q.id === targetId);
    if (!target) return res.status(404).json({ error: 'not_found' });

    const currentActiveId = getUser(spotifyId)?.activeQueueId;
    if (currentActiveId && currentActiveId !== targetId) {
      const outgoingSnapshot = await buildQueueSnapshot(spotifyId);
      if (outgoingSnapshot) updateQueue(spotifyId, currentActiveId, outgoingSnapshot);
    }

    const deviceId = await resolveDeviceIdIfNeeded(spotifyId);

    // Saved queues from before upcoming-track support only have a single
    // trackUri/contextUri - fall back to the old context-based replay for those.
    await startPlayback(spotifyId, {
      ...(target.trackUris?.length
        ? { uris: target.trackUris }
        : { contextUri: target.contextUri, trackUri: target.trackUri }),
      positionMs: target.positionMs,
      deviceId,
    });
    upsertUser(spotifyId, { activeQueueId: targetId });

    res.json({ ok: true, activeQueueId: targetId });
  } catch (err) {
    if (err.code === 'no_devices') {
      return res.status(409).json({
        error: 'no_devices',
        message: 'No Spotify device found. Open Spotify on your phone, computer, or a speaker first, then try again.',
      });
    }
    console.error(err);
    res.status(502).json({ error: 'spotify_api_error', message: err.message });
  }
});
