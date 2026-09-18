import { useEffect, useMemo, useState } from 'react';
import QueueCard from './QueueCard.jsx';

const SORT_STORAGE_KEY = 'queues-sort-order';

const SORTS = {
  recent: { label: 'Recent', compare: (a, b) => (b.lastActivatedAt ?? b.savedAt ?? 0) - (a.lastActivatedAt ?? a.savedAt ?? 0) },
  name: { label: 'Name', compare: (a, b) => a.name.localeCompare(b.name) },
  added: { label: 'Added', compare: (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) },
};

function loadStoredSort() {
  try {
    const stored = localStorage.getItem(SORT_STORAGE_KEY);
    return stored && SORTS[stored] ? stored : 'recent';
  } catch {
    return 'recent';
  }
}

export default function QueueList({ queues, activeQueueId, isPlaying, onActivate, onPause, onResume, onRename, onDelete, busy }) {
  const [sortKey, setSortKey] = useState(loadStoredSort);

  useEffect(() => {
    try {
      localStorage.setItem(SORT_STORAGE_KEY, sortKey);
    } catch {
      // ignore - sort just won't persist across visits
    }
  }, [sortKey]);

  const sortedQueues = useMemo(() => [...queues].sort(SORTS[sortKey].compare), [queues, sortKey]);

  if (!queues.length) {
    return (
      <div className="queue-list empty">
        <p>No saved queues yet.</p>
        <p className="hint">Play something in Spotify, then use "Save this as a new queue" above.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="sort-control" role="group" aria-label="Sort queues by">
        {Object.entries(SORTS).map(([key, { label }]) => (
          <button
            key={key}
            type="button"
            className={`sort-btn${sortKey === key ? ' active' : ''}`}
            aria-pressed={sortKey === key}
            onClick={() => setSortKey(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="queue-list">
        {sortedQueues.map((q) => (
          <QueueCard
            key={q.id}
            queue={q}
            isActive={q.id === activeQueueId}
            isPlaying={isPlaying}
            busy={busy}
            onActivate={() => onActivate(q.id)}
            onPause={onPause}
            onResume={onResume}
            onRename={(name) => onRename(q.id, name)}
            onDelete={() => onDelete(q.id)}
          />
        ))}
      </div>
    </div>
  );
}
