import { Router } from 'express';
import crypto from 'node:crypto';
import { requireAuth } from '../middleware.js';
import { listQueues, addQueue, updateQueue, removeQueue, upsertUser, getUser } from '../db.js';
import { getPlaybackState, startPlayback } from '../spotifyApi.js';

export const queuesRouter = Router();
queuesRouter.use(requireAuth);

queuesRouter.get('/', (req, res) => {
  res.json(listQueues(req.session.spotifyId));
});

// Save the currently playing context (playlist/album + track + position) as a new named slot.
queuesRouter.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name_required' });
  }

  try {
    const state = await getPlaybackState(req.session.spotifyId);
    if (!state?.item || !state.context?.uri) {
      return res.status(409).json({
        error: 'nothing_playing',
        message: 'Start playing a playlist or album in Spotify first, then save it as a queue.',
      });
    }

    const queue = {
      id: crypto.randomUUID(),
      name: name.trim(),
      contextUri: state.context.uri,
      trackUri: state.item.uri,
      trackName: state.item.name,
      artistName: state.item.artists?.map((a) => a.name).join(', ') ?? '',
      albumImageUrl: state.item.album?.images?.[0]?.url ?? null,
      positionMs: state.progress_ms,
      savedAt: Date.now(),
    };
    addQueue(req.session.spotifyId, queue);
    upsertUser(req.session.spotifyId, { activeQueueId: queue.id });
    res.status(201).json(queue);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'spotify_api_error', message: err.message });
  }
});

// Overwrite a saved slot's position with wherever playback currently is
// (e.g. tap "Save" right before switching away, or periodically while working out).
queuesRouter.put('/:id/save', async (req, res) => {
  try {
    const state = await getPlaybackState(req.session.spotifyId);
    if (!state?.item) {
      return res.status(409).json({ error: 'nothing_playing' });
    }
    const updated = updateQueue(req.session.spotifyId, req.params.id, {
      contextUri: state.context?.uri ?? undefined,
      trackUri: state.item.uri,
      trackName: state.item.name,
      artistName: state.item.artists?.map((a) => a.name).join(', ') ?? '',
      albumImageUrl: state.item.album?.images?.[0]?.url ?? null,
      positionMs: state.progress_ms,
      savedAt: Date.now(),
    });
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

    const state = await getPlaybackState(spotifyId);
    const currentActiveId = getUser(spotifyId)?.activeQueueId;

    if (state?.item && currentActiveId && currentActiveId !== targetId) {
      updateQueue(spotifyId, currentActiveId, {
        contextUri: state.context?.uri ?? undefined,
        trackUri: state.item.uri,
        trackName: state.item.name,
        artistName: state.item.artists?.map((a) => a.name).join(', ') ?? '',
        albumImageUrl: state.item.album?.images?.[0]?.url ?? null,
        positionMs: state.progress_ms,
        savedAt: Date.now(),
      });
    }

    await startPlayback(spotifyId, {
      contextUri: target.contextUri,
      trackUri: target.trackUri,
      positionMs: target.positionMs,
    });
    upsertUser(spotifyId, { activeQueueId: targetId });

    res.json({ ok: true, activeQueueId: targetId });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'spotify_api_error', message: err.message });
  }
});
