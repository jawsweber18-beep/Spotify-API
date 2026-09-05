# Queues for Spotify

Spotify only lets you play one thing at a time, and switching away from a
playlist to listen to something else loses your place in it. This app fixes
that: save your current spot in a playlist/album as a named **queue**, switch
to another queue whenever you want, and switching back resumes exactly where
you left off. It's a mobile-friendly web app you can add to your phone's home
screen.

**Important constraint:** this does not play two things at once — Spotify's
API doesn't support that. It saves and restores your position so switching
between "streams" is instant and lossless, one at a time.

## How it works

- `server/` — Node/Express backend. Handles Spotify OAuth login and talks to
  the Spotify Web API on your behalf (play/pause, read what's playing, seek).
  Saved queues (name, playlist/album URI, track, position) are stored per
  Spotify account in `server/data.json`.
- `client/` — React (Vite) frontend. Mobile-first UI: current track, a button
  to save it as a new queue, and a list of saved queues you can tap to switch
  between.

The dev server proxies `/api` and `/auth` from the frontend straight to the
backend, so the browser only ever talks to one origin. This matters for
phone use — mobile browsers are strict about cookies across origins.

## 1. Create a Spotify app

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   and create an app.
2. Note the **Client ID** and **Client Secret**.
3. Add a **Redirect URI**. For local desktop testing use exactly:
   `http://127.0.0.1:8888/auth/callback`
   (Spotify requires HTTPS for redirect URIs *except* for the loopback
   address `127.0.0.1` — see the phone section below for testing on a phone.)

## 2. Configure the backend

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:

```
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8888/auth/callback
CLIENT_URL=http://127.0.0.1:5173
SESSION_SECRET=<any long random string>
```

Install and run:

```bash
npm install
npm run dev
```

## 3. Run the frontend

```bash
cd client
npm install
npm run dev
```

Open `http://127.0.0.1:5173`, click **Connect with Spotify**, and log in.

**You also need Spotify open and active on some device** (phone app, desktop
app, or web player) — the Web API can control an already-active device but
can't wake one up from nothing. Start playing a playlist there first, then
use this app to save/switch queues.

## 4. Using it from your phone

You have two options:

### Option A — same Wi-Fi network (no HTTPS needed)

Since `127.0.0.1` only works for requests from the same machine, phone access
needs a real reachable address instead:

1. Find your computer's LAN IP (e.g. `192.168.1.23`).
2. Keep `SPOTIFY_REDIRECT_URI` as `http://127.0.0.1:8888/auth/callback` and do
   the actual Spotify login from a browser tab on your computer once — the
   session cookie is tied to whichever origin the app is loaded from, so for
   day-to-day phone use, prefer Option B below (it's not much more setup and
   avoids IP/cookie quirks entirely).

Option A is fiddly because Spotify's redirect URI rules block plain-HTTP
non-loopback addresses. Option B below is the practical way to use this from
a phone during local development.

### Option B — a tunnel (recommended, works from anywhere)

Use a tool like [ngrok](https://ngrok.com) or `cloudflared` to get a public
HTTPS URL that forwards to your frontend dev server:

```bash
ngrok http 5173
```

This gives you a URL like `https://abcd1234.ngrok-free.app`. Then:

1. In the Spotify dashboard, add a Redirect URI:
   `https://abcd1234.ngrok-free.app/auth/callback`
2. In `server/.env`, set:
   ```
   SPOTIFY_REDIRECT_URI=https://abcd1234.ngrok-free.app/auth/callback
   CLIENT_URL=https://abcd1234.ngrok-free.app
   ```
3. Restart the backend (`npm run dev` in `server/`) so it picks up the new
   `.env` values.
4. Open the ngrok URL on your phone and log in. Vite proxies `/api` and
   `/auth` through to your backend automatically, so only the one tunnel is
   needed.
5. From your phone's browser share sheet, choose **Add to Home Screen** to
   get an app-like icon that opens straight into it.

Free ngrok URLs change every time you restart it — update the Spotify
dashboard redirect URI and `server/.env` each time, or use a paid/static
domain if you'll do this often.

## Notes

- `server/data.json` is your local database of saved tokens and queues —
  it's gitignored, don't commit it.
- Playback control requires Spotify Premium for some actions (like starting
  playback from a specific position); free accounts can still browse but may
  hit `403` from Spotify's API on some player actions.
