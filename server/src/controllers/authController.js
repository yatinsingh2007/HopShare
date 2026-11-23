const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { clerkClient, verifyToken } = require('@clerk/express');
const prisma = require('../config/db');
const { toPublicMe } = require('./meController');

// the refresh token lives in an httpOnly cookie, sent only to /api/auth
const REFRESH_COOKIE = 'refreshToken';
const BCRYPT_ROUNDS = 10;
// compared against when the email is unknown, so a wrong email takes as long as a wrong password
const NO_USER_HASH = bcrypt.hashSync('no-such-user', BCRYPT_ROUNDS);

// Both tokens are signed JWTs; nothing is stored. `type` stops a refresh token being used as an access token.
const issueTokens = (userId) => {
  const accessToken = jwt.sign({ sub: userId, type: 'access' }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ sub: userId, type: 'refresh' }, process.env.JWT_SECRET, { expiresIn: '30d' });
  return { accessToken, refreshToken, expiresAt: new Date(jwt.decode(refreshToken).exp * 1000) };
};

// every way in ends the same: refresh token in the cookie, access token in the body
const sendSignedIn = (res, user) => {
  if (user.status !== 'ACTIVE') return res.status(403).json({ success: false, message: 'This account is suspended.' });
  const { accessToken, refreshToken, expiresAt } = issueTokens(user.id);
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/auth',
    expires: expiresAt,
  });
  res.json({ success: true, data: { accessToken, user: toPublicMe(user) } });
};

// Clerk only proves the person owns the email (code) or Google account; the user record is ours
const userFromClerk = async (clerkToken) => {
  let clerkId;
  try {
    ({ sub: clerkId } = await verifyToken(clerkToken, { jwtKey: process.env.CLERK_JWT_KEY, secretKey: process.env.CLERK_SECRET_KEY }));
  } catch {
    return null;
  }

  const existing = await prisma.user.findUnique({ where: { clerkId } });
  if (existing) return existing;

  const clerkUser = await clerkClient.users.getUser(clerkId);
  return prisma.user.upsert({
    where: { clerkId },
    update: {},
    create: {
      clerkId,
      email: clerkUser.primaryEmailAddress?.emailAddress ?? null,
      name: clerkUser.firstName ?? null,
    },
  });
};

// bcrypt only reads the first 72 bytes, so longer passwords are refused rather than silently cut
const passwordProblem = (password) => {
  if (typeof password !== 'string' || password.length < 8) return 'Use at least 8 characters for your password.';
  if (Buffer.byteLength(password) > 72) return 'That password is too long. Use 72 characters or fewer.';
  return null;
};

// Neon sleeps when idle; the app calls this as sign-in opens so the database is awake by login
const warmUp = async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ success: true });
};

const login = async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({ success: false, message: 'Enter your email and password.' });
  }

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  const matches = await bcrypt.compare(password, user?.passwordHash ?? NO_USER_HASH);
  if (!matches || !user?.passwordHash) {
    return res.status(401).json({ success: false, message: 'Email or password is incorrect.' });
  }
  sendSignedIn(res, user);
};

// sign-up and "forgot password": the email code proves it's theirs, then the password is saved
const setPassword = async (req, res) => {
  const { clerkToken, password } = req.body ?? {};
  if (!clerkToken) return res.status(400).json({ success: false, message: 'Missing sign-in token.' });
  const problem = passwordProblem(password);
  if (problem) return res.status(400).json({ success: false, message: problem });

  const found = await userFromClerk(clerkToken);
  if (!found) return res.status(401).json({ success: false, message: 'That code has expired. Please start again.' });

  const user = await prisma.user.update({
    where: { id: found.id },
    data: { passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) },
  });
  sendSignedIn(res, user);
};

// Google sign-in: no password involved
const loginWithClerk = async (req, res) => {
  const { clerkToken } = req.body ?? {};
  if (!clerkToken) return res.status(400).json({ success: false, message: 'Missing sign-in token.' });

  const user = await userFromClerk(clerkToken);
  if (!user) return res.status(401).json({ success: false, message: 'That sign-in has expired. Please try again.' });
  sendSignedIn(res, user);
};

// a new pair each time; suspended users get nothing
const refresh = async (req, res) => {
  let claims = null;
  try {
    claims = jwt.verify(req.cookies?.[REFRESH_COOKIE], process.env.JWT_SECRET);
  } catch {}
  const user = claims?.type === 'refresh' ? await prisma.user.findUnique({ where: { id: claims.sub } }) : null;

  if (user?.status !== 'ACTIVE') {
    res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/auth' });
    return res.status(401).json({ success: false, message: 'Your session has ended. Please sign in again.' });
  }

  const { accessToken, refreshToken, expiresAt } = issueTokens(user.id);
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/auth',
    expires: expiresAt,
  });
  res.json({ success: true, data: { accessToken } });
};

// tokens aren't stored, so signing out just drops the cookie; the app forgets its access token
const logout = (req, res) => {
  res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/auth' });
  res.json({ success: true, message: 'Signed out.' });
};

module.exports = { warmUp, login, setPassword, loginWithClerk, refresh, logout };
