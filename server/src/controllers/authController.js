const authService = require('../services/authService');
const { toPublicMe } = require('../services/userService');

const login = async (req, res) => {
  const { clerkToken } = req.body ?? {};
  if (!clerkToken) return res.status(400).json({ success: false, message: 'Missing sign-in token.' });

  const result = await authService.login(clerkToken);
  if (!result) return res.status(401).json({ success: false, message: 'That sign-in has expired. Please try again.' });
  if (result.user.status !== 'ACTIVE') return res.status(403).json({ success: false, message: 'This account is suspended.' });

  const { user, accessToken, refreshToken } = result;
  res.json({ success: true, data: { accessToken, refreshToken, user: toPublicMe(user) } });
};

const refresh = async (req, res) => {
  const tokens = await authService.refresh(req.body?.refreshToken);
  if (!tokens) return res.status(401).json({ success: false, message: 'Your session has ended. Please sign in again.' });
  res.json({ success: true, data: tokens });
};

const logout = async (req, res) => {
  await authService.logout(req.body?.refreshToken);
  res.json({ success: true, message: 'Signed out.' });
};

const logoutAll = async (req, res) => {
  await authService.logoutAll(req.user.id);
  res.json({ success: true, message: 'Signed out on all devices.' });
};

module.exports = { login, refresh, logout, logoutAll };
