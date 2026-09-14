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
  between — sortable by Recent (last switched to), Name, or Added (creation
  order); your choice is remembered in the browser.

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

## 5. Always-on deployment on a home server (Apache)

If you have a Linux server at home already running Apache for another site,
you can host this alongside it, always-on, for free — no cold starts, no
tunnel, works from your phone over the public internet. Config templates are
in `deploy/`.

This assumes a setup like: Ubuntu + Apache serving an existing site over
HTTPS via a Let's Encrypt cert from certbot, using a free dynamic-DNS domain
(DuckDNS, dpdns.org, etc.) rather than a real registrar domain. Since that
kind of cert only covers your exact existing hostname (no wildcard), the
cleanest path is a **second, independent DDNS hostname** for this app rather
than a subdomain of your existing one.

### 5.1 Get a domain for this app

Register a new free hostname at [duckdns.org](https://www.duckdns.org) (or
whatever DDNS provider you already use), e.g. `spotify-queues.duckdns.org`,
pointed at your home IP. If you already run a DDNS updater script/cron job to
keep your existing hostname's IP current, add this new hostname to it too so
it keeps working after your IP changes.

### 5.2 Install Node.js and enable Apache modules

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo a2enmod proxy proxy_http
sudo systemctl reload apache2
```

### 5.3 Get the app onto the server and build it

```bash
sudo git clone <your-repo-url> /opt/spotify-queues
cd /opt/spotify-queues
sudo chown -R "$USER":"$USER" /opt/spotify-queues
cd client && npm install && npm run build && cd ..
cd server && npm install && cd ..
```

### 5.4 Configure the backend

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:

```
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
SPOTIFY_REDIRECT_URI=https://spotify-queues.duckdns.org/auth/callback
CLIENT_URL=https://spotify-queues.duckdns.org
SESSION_SECRET=<any long random string>
NODE_ENV=production
```

In the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard),
add `https://spotify-queues.duckdns.org/auth/callback` as another Redirect
URI on your app (you can keep the localhost one too — Spotify allows
multiple).

### 5.5 Run the backend as a systemd service

```bash
sudo cp /opt/spotify-queues/deploy/spotify-queues.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now spotify-queues
sudo systemctl status spotify-queues   # should say "active (running)"
```

If the service file's `WorkingDirectory`, `User`, or `Group` don't match
where you cloned the repo or your Linux username, edit
`/etc/systemd/system/spotify-queues.service` before enabling it.

### 5.6 Add the Apache vhost and get a certificate

```bash
sudo cp /opt/spotify-queues/deploy/apache-vhost.conf /etc/apache2/sites-available/spotify-queues.conf
sudo nano /etc/apache2/sites-available/spotify-queues.conf   # replace the placeholder hostname
sudo a2ensite spotify-queues.conf
sudo systemctl reload apache2
sudo certbot --apache -d spotify-queues.duckdns.org
```

Certbot will rewrite the vhost file to add the `:443` block and an
HTTP→HTTPS redirect, the same way it already did for your existing site.

### 5.7 Test it

Visit `https://spotify-queues.duckdns.org` from your phone (on or off your
home Wi-Fi) and log in. "Add to Home Screen" from your browser's share sheet
for an app-like icon.

To ship a future code change: `git pull`, re-run the client build if the
frontend changed, then `sudo systemctl restart spotify-queues`.

## "Keep playing" (auto-resume watchdog)

Some setups hit a known Spotify annoyance where playback stops instead of
advancing to the next track. There's a toggle in the app for this: when on,
the backend watches for a track that's paused within the last 10 seconds of
its runtime — the signature of that bug — and skips to the next track.

Polling is adaptive rather than a fixed interval: a check every 20s is
plenty for most of a track, but once it's within that last-10-seconds
window the backend switches to checking every 2s, so a stall is caught in a
couple of seconds instead of waiting out a long fixed interval. Because the
fast rate only ever runs during that short window per track, this doesn't
meaningfully add to Spotify API usage.

The Spotify API doesn't say *why* playback stopped, so this still can't tell
"the bug" apart from you pausing some other way. Restricting it to the last
10 seconds of a track keeps false positives rare: an intentional pause is
overwhelmingly more likely to land somewhere in the middle of a song than in
its closing seconds. If you do want it to leave a track alone right at the
end, use *this app's* Pause button — that's the one thing it always treats
as intentional, tracked as each user's `desiredState` in `server/data.json`,
flipped to `'playing'` by Resume/Save-and-switch-queue and to `'paused'` by
Pause.

Because this runs as a server-side loop (`server/src/watchdog.js`), it keeps
working even with your phone locked or the browser tab closed — it only
depends on the backend being up, which on the home-server deployment above
it always is.

## Notes

- `server/data.json` is your local database of saved tokens and queues —
  it's gitignored, don't commit it.
- Playback control requires Spotify Premium for some actions (like starting
  playback from a specific position); free accounts can still browse but may
  hit `403` from Spotify's API on some player actions.
