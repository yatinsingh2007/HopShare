const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { clerkClient, verifyToken } = require('@clerk/express');
const prisma = require('../config/db');
const { findOrCreateUser } = require('./userService');

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

const hash = (secret) => crypto.createHash('sha256').update(secret).digest('hex');

// refresh token = "<sessionId>.<secret>", we only store the hash of the secret
const issueTokens = async (userId, sessionId) => {
  const secret = crypto.randomBytes(32).toString('base64url');
  const data = { tokenHash: hash(secret), expiresAt: new Date(Date.now() + THIRTY_DAYS) };

  const session = sessionId
    ? await prisma.session.update({ where: { id: sessionId }, data })
    : await prisma.session.create({ data: { ...data, userId } });

  const accessToken = jwt.sign({ sub: userId, sid: session.id }, process.env.JWT_SECRET, { expiresIn: '15m' });
  return { accessToken, refreshToken: `${session.id}.${secret}` };
};

const findSession = async (refreshToken) => {
  const [sessionId, secret] = String(refreshToken ?? '').split('.');
  if (!sessionId || !secret) return null;

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;

  if (hash(secret) !== session.tokenHash) {
    // an old refresh token was reused, so someone may have stolen it
    await prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
    return null;
  }
  return session;
};

// Clerk only tells us the email code / Google sign-in was valid. After that we use our own tokens.
const login = async (clerkToken) => {
  let clerkId;
  try {
    ({ sub: clerkId } = await verifyToken(clerkToken, { secretKey: process.env.CLERK_SECRET_KEY }));
  } catch {
    return null;
  }

  const user = await findOrCreateUser(clerkId, () => clerkClient.users.getUser(clerkId));
  return { user, ...(await issueTokens(user.id)) };
};

const refresh = async (refreshToken) => {
  const session = await findSession(refreshToken);
  return session ? issueTokens(session.userId, session.id) : null;
};

const logout = async (refreshToken) => {
  const session = await findSession(refreshToken);
  if (session) await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
};

const logoutAll = (userId) =>
  prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });

// used by requireUser on every request, so a logout takes effect straight away
const getUserFromAccessToken = async (accessToken) => {
  let claims;
  try {
    claims = jwt.verify(accessToken, process.env.JWT_SECRET);
  } catch {
    return null;
  }

  const session = await prisma.session.findUnique({ where: { id: claims.sid }, include: { user: true } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  return session.user;
};

module.exports = { login, refresh, logout, logoutAll, getUserFromAccessToken };
