import { listUsersWithKeepPlaying } from './db.js';
import { getPlaybackState, startPlayback, skipToNext } from './spotifyApi.js';

const POLL_MS = 20_000;
const NEAR_END_MS = 3000; // close enough to the end of a track to skip instead of resume

async function checkUser(user) {
  const state = await getPlaybackState(user.spotifyId);

  // No known device, or the user's last command through the app was to pause -
  // in either case there's nothing to enforce right now.
  if (!state?.item || user.desiredState !== 'playing' || state.is_playing) return;

  const nearEndOfTrack = state.item.duration_ms - state.progress_ms < NEAR_END_MS;

  if (nearEndOfTrack) {
    console.log(`[keep-playing] ${user.spotifyId}: stalled at end of track, skipping to next`);
    await skipToNext(user.spotifyId);
  } else {
    console.log(`[keep-playing] ${user.spotifyId}: found paused unexpectedly, resuming`);
    await startPlayback(user.spotifyId, {
      contextUri: state.context?.uri,
      trackUri: state.item.uri,
      positionMs: state.progress_ms,
    });
  }
}

export function startKeepPlayingWatchdog() {
  setInterval(async () => {
    const users = listUsersWithKeepPlaying();
    for (const user of users) {
      try {
        await checkUser(user);
      } catch (err) {
        console.error(`[keep-playing] ${user.spotifyId}: check failed:`, err.message);
      }
    }
  }, POLL_MS);
}
