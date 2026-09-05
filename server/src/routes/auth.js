import { Router } from 'express';
import crypto from 'node:crypto';
import { buildAuthorizeUrl, exchangeCodeForTokens } from '../spotifyAuth.js';
import { upsertUser } from '../db.js';
import { getMeWithToken } from '../spotifyApi.js';

export const authRouter = Router();

authRouter.get('/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  res.redirect(buildAuthorizeUrl(state));
});

authRouter.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${process.env.CLIENT_URL}/?error=${encodeURIComponent(error)}`);
  }
  if (!state || state !== req.session.oauthState) {
    return res.redirect(`${process.env.CLIENT_URL}/?error=state_mismatch`);
  }
  delete req.session.oauthState;

  try {
    const tokens = await exchangeCodeForTokens(code);
    const profile = await getMeWithToken(tokens.access_token);

    upsertUser(profile.id, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      displayName: profile.display_name,
    });

    req.session.spotifyId = profile.id;
    res.redirect(`${process.env.CLIENT_URL}/`);
  } catch (err) {
    console.error('OAuth callback failed:', err);
    res.redirect(`${process.env.CLIENT_URL}/?error=auth_failed`);
  }
});

authRouter.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});
