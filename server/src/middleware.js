export function requireAuth(req, res, next) {
  if (!req.session.spotifyId) {
    return res.status(401).json({ error: 'not_authenticated' });
  }
  next();
}
