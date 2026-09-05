import { getUser, upsertUser } from './db.js';
import { refreshAccessToken } from './spotifyAuth.js';

const API_BASE = 'https://api.spotify.com/v1';

/** Returns a usable access token for this user, refreshing it first if it has expired. */
export async function getValidAccessToken(spotifyId) {
  const user = getUser(spotifyId);
  if (!user) throw new Error('Unknown user');

  const isExpired = !user.expiresAt || Date.now() > user.expiresAt - 60_000; // refresh a minute early
  if (!isExpired) return user.accessToken;

  const refreshed = await refreshAccessToken(user.refreshToken);
  const updated = upsertUser(spotifyId, {
    accessToken: refreshed.access_token,
    // Spotify doesn't always return a new refresh token; keep the old one if so.
    refreshToken: refreshed.refresh_token ?? user.refreshToken,
    expiresAt: Date.now() + refreshed.expires_in * 1000,
  });
  return updated.accessToken;
}

async function spotifyFetch(spotifyId, path, options = {}) {
  const token = await getValidAccessToken(spotifyId);
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  return res;
}

export async function getMe(spotifyId) {
  const res = await spotifyFetch(spotifyId, '/me');
  if (!res.ok) throw new Error(`getMe failed: ${res.status}`);
  return res.json();
}

/** Fetch the profile for a raw access token, before we know the user's Spotify id yet. */
export async function getMeWithToken(accessToken) {
  const res = await fetch(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`getMeWithToken failed: ${res.status}`);
  return res.json();
}

/** Full playback state, or null if nothing is currently active on any device. */
export async function getPlaybackState(spotifyId) {
  const res = await spotifyFetch(spotifyId, '/me/player');
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`getPlaybackState failed: ${res.status}`);
  return res.json();
}

export async function pausePlayback(spotifyId) {
  const res = await spotifyFetch(spotifyId, '/me/player/pause', { method: 'PUT' });
  // Spotify returns 403 if playback is already paused or no active device - not fatal for our use case.
  if (!res.ok && res.status !== 403) throw new Error(`pausePlayback failed: ${res.status}`);
}

/**
 * Resume playback. With no args, resumes whatever was last active on the current device.
 * With contextUri, starts that playlist/album from the given track/position.
 */
export async function startPlayback(spotifyId, { contextUri, trackUri, positionMs } = {}) {
  const body = {};
  if (contextUri) {
    body.context_uri = contextUri;
    if (trackUri) body.offset = { uri: trackUri };
  }
  if (typeof positionMs === 'number') body.position_ms = positionMs;

  const res = await spotifyFetch(spotifyId, '/me/player/play', {
    method: 'PUT',
    body: Object.keys(body).length ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`startPlayback failed: ${res.status} ${text}`);
  }
}
