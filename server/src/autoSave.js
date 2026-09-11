import { getUser, listUserIds, listQueues, updateQueue } from './db.js';
import { getPlaybackState } from './spotifyApi.js';

const POLL_MS = 15_000;

// Last track URI we saw per user, purely in memory - losing it on a restart
// just skips one auto-save cycle, which is harmless.
const lastSeenTrackUri = new Map();

// If the track just changed while playback is still inside the active saved
// queue's context, refresh that queue's bookmark to the new track/position.
// This runs independently of the web app being open, so switching tracks
// (or just walking away) never loses your place in a saved queue.
async function checkUser(spotifyId) {
  const user = getUser(spotifyId);
  if (!user?.activeQueueId) return;

  const activeQueue = listQueues(spotifyId).find((q) => q.id === user.activeQueueId);
  if (!activeQueue) return;

  const state = await getPlaybackState(spotifyId);
  if (!state?.item || !state.context?.uri) return;

  const previousTrackUri = lastSeenTrackUri.get(spotifyId);
  lastSeenTrackUri.set(spotifyId, state.item.uri);
  if (!previousTrackUri || previousTrackUri === state.item.uri) return;
  if (activeQueue.contextUri !== state.context.uri) return;

  updateQueue(spotifyId, activeQueue.id, {
    trackUri: state.item.uri,
    trackName: state.item.name,
    artistName: state.item.artists?.map((a) => a.name).join(', ') ?? '',
    albumImageUrl: state.item.album?.images?.[0]?.url ?? null,
    positionMs: state.progress_ms,
    savedAt: Date.now(),
  });
}

export function startAutoSavePoller() {
  setInterval(() => {
    for (const spotifyId of listUserIds()) {
      checkUser(spotifyId).catch((err) => {
        console.error(`auto-save: failed for ${spotifyId}:`, err.message);
      });
    }
  }, POLL_MS);
  console.log(`Auto-save poller running every ${POLL_MS / 1000}s`);
}
