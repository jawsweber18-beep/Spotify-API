import { getUser, listUserIds, listQueues, updateQueue } from './db.js';
import { getPlaybackState } from './spotifyApi.js';

const POLL_MS = 15_000;

// While a song is actively playing inside the active saved queue's own
// context, keep that queue's bookmark refreshed every poll - so switching
// tracks, walking away, or the app being closed never loses more than one
// poll interval's worth of progress. Paused playback is left alone since
// there's nothing new to capture.
async function checkUser(spotifyId) {
  const user = getUser(spotifyId);
  if (!user?.activeQueueId) return;

  const activeQueue = listQueues(spotifyId).find((q) => q.id === user.activeQueueId);
  if (!activeQueue) return;

  const state = await getPlaybackState(spotifyId);
  if (!state?.item || !state.context?.uri || !state.is_playing) return;
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
