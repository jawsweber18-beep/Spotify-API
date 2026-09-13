export default function KeepPlayingToggle({ enabled, onChange, busy }) {
  return (
    <div className="keep-playing">
      <div className="keep-playing-text">
        <div className="keep-playing-title">Keep playing</div>
        <div className="keep-playing-hint">
          If Spotify stops on its own, resume it automatically. This also overrides
          pausing from anywhere other than the Pause button above — the Spotify app,
          a Bluetooth button, a smart speaker.
        </div>
      </div>
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
  );
}
