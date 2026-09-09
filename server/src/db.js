import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data.json');

function load() {
  if (!existsSync(DB_PATH)) return { users: {} };
  try {
    return JSON.parse(readFileSync(DB_PATH, 'utf-8'));
  } catch {
    return { users: {} };
  }
}

function save(data) {
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Small JSON-file store. Fine for a single-user app on a server with a real
// persistent disk; each spotify account gets its own tokens + saved queues.
export function getUser(spotifyId) {
  const data = load();
  return data.users[spotifyId] ?? null;
}

export function upsertUser(spotifyId, fields) {
  const data = load();
  data.users[spotifyId] = { ...(data.users[spotifyId] ?? { queues: [] }), ...fields };
  save(data);
  return data.users[spotifyId];
}

export function listQueues(spotifyId) {
  const user = getUser(spotifyId);
  return user?.queues ?? [];
}

export function addQueue(spotifyId, queue) {
  const data = load();
  const user = data.users[spotifyId];
  if (!user) throw new Error('Unknown user');
  user.queues.push(queue);
  save(data);
  return queue;
}

export function updateQueue(spotifyId, queueId, fields) {
  const data = load();
  const user = data.users[spotifyId];
  if (!user) throw new Error('Unknown user');
  const queue = user.queues.find((q) => q.id === queueId);
  if (!queue) return null;
  Object.assign(queue, fields);
  save(data);
  return queue;
}

export function removeQueue(spotifyId, queueId) {
  const data = load();
  const user = data.users[spotifyId];
  if (!user) throw new Error('Unknown user');
  const before = user.queues.length;
  user.queues = user.queues.filter((q) => q.id !== queueId);
  save(data);
  return user.queues.length < before;
}
