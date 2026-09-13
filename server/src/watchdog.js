import { listUsersWithKeepPlaying } from './db.js';
import { getPlaybackState, skipToNext } from './spotifyApi.js';

const POLL_MS = 15_000;
// Only intervene if caught paused this close to a track's end - the signature
// of Spotify's stuck-at-end-of-song bug. A pause further back in the track is
// left alone, since that's much more likely to be a deliberate pause from
// somewhere else (the Spotify app, a Bluetooth button, etc.).
const NEAR_END_MS = 10_000;

async function checkUser(user) {
  const state = await getPlaybackState(user.spotifyId);

  // No known device, or the user's last command through the app was to pause -
  // in either case there's nothing to enforce right now.
  if (!state?.item || user.desiredState !== 'playing' || state.is_playing) return;

  const remainingMs = state.item.duration_ms - state.progress_ms;
  if (remainingMs > NEAR_END_MS) return; // paused mid-track - leave it alone

  console.log(`[keep-playing] ${user.spotifyId}: caught paused ${Math.round(remainingMs / 1000)}s from the end, skipping to next`);
  await skipToNext(user.spotifyId);
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
