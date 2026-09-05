import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import Login from './components/Login.jsx';
import NowPlaying from './components/NowPlaying.jsx';
import QueueList from './components/QueueList.jsx';

const POLL_MS = 5000;

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [playerState, setPlayerState] = useState(null);
  const [queues, setQueues] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const loginError = new URLSearchParams(window.location.search).get('error');

  const refresh = useCallback(async () => {
    try {
      const [state, queueList] = await Promise.all([api.playerState(), api.listQueues()]);
      setPlayerState(state);
      setQueues(queueList);
    } catch (err) {
      if (err.code === 'not_authenticated') setUser(null);
    }
  }, []);

  useEffect(() => {
    api
      .me()
      .then((me) => setUser(me))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [user, refresh]);

  const runAction = async (fn) => {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setNotice(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="center-message">Loading...</div>;
  if (!user) return <Login error={loginError} />;

  return (
    <div className="app">
      <header>
        <h1>Queues for Spotify</h1>
        <button
          className="btn btn-link"
          onClick={() => api.logout().then(() => setUser(null))}
        >
          Log out
        </button>
      </header>

      {notice && <div className="notice">{notice}</div>}

      <NowPlaying
        state={playerState}
        busy={busy}
        onPause={() => runAction(api.pause)}
        onResume={() => runAction(api.resume)}
        onSaveNew={(name) => runAction(() => api.createQueue(name))}
      />

      <QueueList
        queues={queues}
        activeQueueId={playerState?.activeQueueId}
        busy={busy}
        onActivate={(id) => runAction(() => api.activateQueue(id))}
        onSaveHere={(id) => runAction(() => api.saveQueue(id))}
        onRename={(id, name) => runAction(() => api.renameQueue(id, name))}
        onDelete={(id) => runAction(() => api.deleteQueue(id))}
      />
    </div>
  );
}
