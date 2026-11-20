const authService = require('../services/authService');
const { toPublicMe } = require('../services/userService');

// the refresh token lives in an httpOnly cookie, sent only to /api/auth
const REFRESH_COOKIE = 'refreshToken';

const warmUp = async (req, res) => {
  await authService.warmUp();
  res.json({ success: true });
};

// every way in ends the same: refresh token in the cookie, access token in the body
const signedIn = (res, result) => {
  if (result.user.status !== 'ACTIVE') return res.status(403).json({ success: false, message: 'This account is suspended.' });
  const { user, accessToken, refreshToken, expiresAt } = result;
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/auth',
    expires: expiresAt,
  });
  res.json({ success: true, data: { accessToken, user: toPublicMe(user) } });
};

// bcrypt only reads the first 72 bytes, so longer passwords are refused rather than silently cut
const passwordProblem = (password) => {
  if (typeof password !== 'string' || password.length < 8) return 'Use at least 8 characters for your password.';
  if (Buffer.byteLength(password) > 72) return 'That password is too long. Use 72 characters or fewer.';
  return null;
};

const login = async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({ success: false, message: 'Enter your email and password.' });
  }
  const result = await authService.loginWithPassword(email, password);
  if (!result) return res.status(401).json({ success: false, message: 'Email or password is incorrect.' });
  signedIn(res, result);
};

const setPassword = async (req, res) => {
  const { clerkToken, password } = req.body ?? {};
  if (!clerkToken) return res.status(400).json({ success: false, message: 'Missing sign-in token.' });
  const problem = passwordProblem(password);
  if (problem) return res.status(400).json({ success: false, message: problem });

  const result = await authService.setPassword(clerkToken, password);
  if (!result) return res.status(401).json({ success: false, message: 'That code has expired. Please start again.' });
  signedIn(res, result);
};

const loginWithClerk = async (req, res) => {
  const { clerkToken } = req.body ?? {};
  if (!clerkToken) return res.status(400).json({ success: false, message: 'Missing sign-in token.' });
  const result = await authService.loginWithClerk(clerkToken);
  if (!result) return res.status(401).json({ success: false, message: 'That sign-in has expired. Please try again.' });
  signedIn(res, result);
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

module.exports = { warmUp, login, setPassword, loginWithClerk, refresh, logout };
