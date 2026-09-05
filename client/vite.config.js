import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Backend always runs on the same machine as this dev server, so we proxy
// /api and /auth to it. That keeps the browser talking to a single origin
// (this dev server's URL, whether that's localhost or a tunnel like ngrok
// pointed at this port) which avoids cross-site cookie issues on mobile browsers.
const API_TARGET = process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8888';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // bind 0.0.0.0 so phones on the same network (or a tunnel) can reach it
    allowedHosts: true, // needed to accept requests via an ngrok/cloudflared hostname
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/auth': { target: API_TARGET, changeOrigin: true },
    },
  },
});
