import QueueCard from './QueueCard.jsx';

export default function QueueList({ queues, activeQueueId, onActivate, onSaveHere, onRename, onDelete, busy }) {
  if (!queues.length) {
    return (
      <div className="queue-list empty">
        <p>No saved queues yet.</p>
        <p className="hint">Play something in Spotify, then use "Save this as a new queue" above.</p>
      </div>
    );
  }

  return (
    <div className="queue-list">
      {queues.map((q) => (
        <QueueCard
          key={q.id}
          queue={q}
          isActive={q.id === activeQueueId}
          busy={busy}
          onActivate={() => onActivate(q.id)}
          onSaveHere={() => onSaveHere(q.id)}
          onRename={(name) => onRename(q.id, name)}
          onDelete={() => onDelete(q.id)}
        />
      ))}
    </div>
  );
}
