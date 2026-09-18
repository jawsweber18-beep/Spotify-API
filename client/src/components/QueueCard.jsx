import { useState } from 'react';

function formatMs(ms) {
  const totalSec = Math.floor((ms ?? 0) / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export default function QueueCard({ queue, isActive, isPlaying, onActivate, onPause, onResume, onRename, onDelete, busy }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(queue.name);

  const submitRename = (e) => {
    e.preventDefault();
    if (name.trim() && name.trim() !== queue.name) onRename(name.trim());
    setEditing(false);
  };

  return (
    <div className={`queue-card${isActive ? ' active' : ''}`}>
      {queue.albumImageUrl && <img src={queue.albumImageUrl} alt="" className="queue-art" />}
      <div className="queue-info">
        {editing ? (
          <form onSubmit={submitRename}>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={submitRename}
            />
          </form>
        ) : (
          <div className="queue-name" onClick={() => setEditing(true)} title="Tap to rename">
            {queue.name} {isActive && <span className="badge">playing</span>}
          </div>
        )}
        <div className="queue-track">
          {queue.trackName} — {queue.artistName}
        </div>
        <div className="queue-position">saved at {formatMs(queue.positionMs)}</div>
      </div>
      <div className="queue-actions">
        {!isActive && (
          <button className="btn btn-primary" onClick={onActivate} disabled={busy}>
            Switch to this
          </button>
        )}
        {isActive && (
          <button className="btn" onClick={isPlaying ? onPause : onResume} disabled={busy}>
            {isPlaying ? 'Pause' : 'Resume'}
          </button>
        )}
        <button className="btn btn-danger" onClick={onDelete} disabled={busy}>
          Delete
        </button>
      </div>
    </div>
  );
}
