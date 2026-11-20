const authService = require('../services/authService');
const { toPublicMe } = require('../services/userService');

// the refresh token lives in an httpOnly cookie, sent only to /api/auth
const REFRESH_COOKIE = 'refreshToken';

const warmUp = async (req, res) => {
  await authService.warmUp();
  res.json({ success: true });
};

const login = async (req, res) => {
  const { clerkToken } = req.body ?? {};
  if (!clerkToken) return res.status(400).json({ success: false, message: 'Missing sign-in token.' });

  const result = await authService.login(clerkToken);
  if (!result) return res.status(401).json({ success: false, message: 'That sign-in has expired. Please try again.' });
  if (result.user.status !== 'ACTIVE') return res.status(403).json({ success: false, message: 'This account is suspended.' });

  const { user, accessToken, refreshToken, expiresAt } = result;
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/auth',
    expires: expiresAt,
  });
  res.json({ success: true, data: { accessToken, user: toPublicMe(user) } });
};

const refresh = async (req, res) => {
  const tokens = await authService.refresh(req.cookies?.[REFRESH_COOKIE]);
  if (!tokens) {
    res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/auth' });
    return res.status(401).json({ success: false, message: 'Your session has ended. Please sign in again.' });
  }
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/auth',
    expires: tokens.expiresAt,
  });
  res.json({ success: true, data: { accessToken: tokens.accessToken } });
};

// tokens aren't stored, so signing out just drops the cookie; the app forgets its access token
const logout = (req, res) => {
  res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/auth' });
  res.json({ success: true, message: 'Signed out.' });
};

module.exports = { warmUp, login, refresh, logout };
