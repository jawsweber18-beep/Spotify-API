import { useEffect, useState } from 'react';

function formatMs(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export default function NowPlaying({ state, onPause, onResume, onSaveNew, busy }) {
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [displayMs, setDisplayMs] = useState(state?.progressMs ?? 0);

  // The server poll only lands every 5s; resync to its real value each time
  // it does (this is the source of truth) and let the 1s ticker below
  // interpolate smoothly in between instead of jumping in 5s steps.
  useEffect(() => {
    setDisplayMs(state?.progressMs ?? 0);
  }, [state?.progressMs, state?.track?.uri]);

  useEffect(() => {
    if (!state?.isPlaying) return;
    const id = setInterval(() => setDisplayMs((ms) => ms + 1000), 1000);
    return () => clearInterval(id);
  }, [state?.isPlaying, state?.track?.uri]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await onSaveNew(newName.trim());
      setNewName('');
    } finally {
      setSaving(false);
    }
  };

  if (!state?.track) {
    return (
      <div className="now-playing empty">
        <p>Nothing is playing right now.</p>
        <p className="hint">Open Spotify on any device and start a playlist, then come back here.</p>
      </div>
    );
  }

  return (
    <div className="now-playing">
      {state.track.albumImageUrl && <img src={state.track.albumImageUrl} alt="" className="album-art" />}
      <div className="track-info">
        <div className="track-name">{state.track.name}</div>
        <div className="artist-name">{state.track.artists}</div>
        <div className="progress-text">
          {formatMs(Math.min(displayMs, state.track.durationMs))} / {formatMs(state.track.durationMs)}
        </div>
      </div>
      <div className="controls">
        {state.isPlaying ? (
          <button className="btn" onClick={onPause} disabled={busy}>
            Pause
          </button>
        ) : (
          <button className="btn" onClick={onResume} disabled={busy}>
            Resume
          </button>
        )}
      </div>
      <form className="save-form" onSubmit={handleSave}>
        <input
          type="text"
          placeholder="Save this as a new queue..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          disabled={saving}
        />
        <button className="btn btn-primary" type="submit" disabled={saving || !newName.trim()}>
          Save
        </button>
      </form>
    </div>
  );
}
