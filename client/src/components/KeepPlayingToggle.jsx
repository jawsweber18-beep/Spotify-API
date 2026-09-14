export default function KeepPlayingToggle({ enabled, onChange, busy }) {
  return (
    <div className="keep-playing">
      <div className="keep-playing-row">
        <span className="keep-playing-title">Keep playing</span>
        <label className="switch">
          <input
            type="checkbox"
            checked={enabled}
            disabled={busy}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="switch-track"><span className="switch-thumb"></span></span>
        </label>
      </div>
      <details className="keep-playing-details">
        <summary>What does this do?</summary>
        <p className="keep-playing-hint">
          Fixes the Spotify bug where it stops instead of moving to the next song: if
          it's found paused within the last 10 seconds of a track, skips ahead
          automatically. Pauses earlier in a track are left alone.
        </p>
      </details>
    </div>
  );
}
