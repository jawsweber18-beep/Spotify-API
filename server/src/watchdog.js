import { listUsersWithKeepPlaying } from './db.js';
import { getPlaybackState, skipToNext } from './spotifyApi.js';

// Only intervene if caught paused this close to a track's end - the signature
// of Spotify's stuck-at-end-of-song bug. A pause further back in the track is
// left alone, since that's much more likely to be a deliberate pause from
// somewhere else (the Spotify app, a Bluetooth button, etc.).
const NEAR_END_MS = 10_000;

// Polling is adaptive rather than a fixed interval: for most of a track a
// check every 20s is plenty, but the closing stretch - where the bug
// actually happens - gets checked every 2s instead, so a stall gets caught
// within a couple of seconds rather than waiting out a long fixed interval.
// Since the fast rate only kicks in for the last ~10s of each track, this
// doesn't meaningfully increase average API usage.
const FAST_POLL_MS = 2_000;
const SLOW_POLL_MS = 20_000;

/** Checks one user and returns how long to wait before checking them again. */
async function checkUser(user) {
  const state = await getPlaybackState(user.spotifyId);

  // No known device, or the user's last command through the app was to pause -
  // in either case there's nothing to enforce right now.
  if (!state?.item || user.desiredState !== 'playing') return SLOW_POLL_MS;

  const remainingMs = state.item.duration_ms - state.progress_ms;

  if (!state.is_playing) {
    if (remainingMs > NEAR_END_MS) return SLOW_POLL_MS; // paused mid-track - leave it alone
    console.log(`[keep-playing] ${user.spotifyId}: caught paused ${Math.round(remainingMs / 1000)}s from the end, skipping to next`);
    await skipToNext(user.spotifyId);
    return FAST_POLL_MS; // quick follow-up check to confirm it took
  }

  // Still playing: once we're inside the danger zone, poll fast so a stall is
  // caught almost immediately. Otherwise, wait until we're about to enter it
  // rather than checking again on a fixed schedule.
  if (remainingMs <= NEAR_END_MS) return FAST_POLL_MS;
  return Math.max(FAST_POLL_MS, Math.min(SLOW_POLL_MS, remainingMs - NEAR_END_MS));
}

async function tick() {
  const users = listUsersWithKeepPlaying();
  let nextDelay = SLOW_POLL_MS;

  for (const user of users) {
    try {
      nextDelay = Math.min(nextDelay, await checkUser(user));
    } catch (err) {
      console.error(`[keep-playing] ${user.spotifyId}: check failed:`, err.message);
    }
  }

  setTimeout(tick, nextDelay);
}

export function startKeepPlayingWatchdog() {
  setTimeout(tick, FAST_POLL_MS);
}
