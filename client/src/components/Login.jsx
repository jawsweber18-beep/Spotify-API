export default function Login({ error }) {
  return (
    <div className="login-screen">
      <img src="/icon.svg" alt="" className="login-logo" />
      <h1>Queues for Spotify</h1>
      <p>Save your place across multiple playlists and switch between them without losing progress.</p>
      {error && <p className="error">Login failed ({error}). Please try again.</p>}
      <a className="btn btn-primary" href="/auth/login">
        Connect with Spotify
      </a>
    </div>
  );
}
