// All requests are same-origin (proxied by Vite to the backend), so cookies
// flow naturally — no need to hardcode a backend URL here.

async function request(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options,
  });

  if (res.status === 401) {
    const err = new Error('not_authenticated');
    err.code = 'not_authenticated';
    throw err;
  }
  if (!res.ok) {
    let body;
    try {
      body = await res.json();
    } catch {
      body = { error: res.statusText };
    }
    const err = new Error(body.message || body.error || 'request_failed');
    err.code = body.error;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  me: () => request('/api/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),

  playerState: () => request('/api/player/state'),
  pause: () => request('/api/player/pause', { method: 'PUT' }),
  resume: () => request('/api/player/resume', { method: 'PUT' }),

  listQueues: () => request('/api/queues'),
  createQueue: (name) => request('/api/queues', { method: 'POST', body: JSON.stringify({ name }) }),
  saveQueue: (id) => request(`/api/queues/${id}/save`, { method: 'PUT' }),
  renameQueue: (id, name) => request(`/api/queues/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  deleteQueue: (id) => request(`/api/queues/${id}`, { method: 'DELETE' }),
  activateQueue: (id) => request(`/api/queues/${id}/activate`, { method: 'POST' }),
};
