const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { clerkClient, verifyToken } = require('@clerk/express');
const prisma = require('../config/db');
const { findOrCreateUser } = require('./userService');

// Both tokens are signed JWTs; nothing is stored. `type` stops a refresh token being used as an access token.
const issueTokens = (userId) => {
  const accessToken = jwt.sign({ sub: userId, type: 'access' }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ sub: userId, type: 'refresh' }, process.env.JWT_SECRET, { expiresIn: '30d' });
  return { accessToken, refreshToken, expiresAt: new Date(jwt.decode(refreshToken).exp * 1000) };
};

const verify = (token, type) => {
  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET);
    return claims.type === type ? claims : null;
  } catch {
    return null;
  }
};

const BCRYPT_ROUNDS = 10;
// compared against when the email is unknown, so a wrong email takes as long as a wrong password
const NO_USER_HASH = bcrypt.hashSync('no-such-user', BCRYPT_ROUNDS);

// Clerk only proves the person owns the email (code) or Google account. Everything after that is ours.
const userFromClerk = async (clerkToken) => {
  let clerkId;
  try {
    ({ sub: clerkId } = await verifyToken(clerkToken, { jwtKey: process.env.CLERK_JWT_KEY, secretKey: process.env.CLERK_SECRET_KEY }));
  } catch {
    return null;
  }
  return findOrCreateUser(clerkId, () => clerkClient.users.getUser(clerkId));
};

// Google sign-in: no password involved
const loginWithClerk = async (clerkToken) => {
  const user = await userFromClerk(clerkToken);
  return user && { user, ...issueTokens(user.id) };
};

// sign-up and "forgot password": the email code proves it's theirs, then the password is saved
const setPassword = async (clerkToken, password) => {
  const found = await userFromClerk(clerkToken);
  if (!found) return null;
  const user = await prisma.user.update({
    where: { id: found.id },
    data: { passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) },
  });
  return { user, ...issueTokens(user.id) };
};

const loginWithPassword = async (email, password) => {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  const matches = await bcrypt.compare(password, user?.passwordHash ?? NO_USER_HASH);
  return matches && user?.passwordHash ? { user, ...issueTokens(user.id) } : null;
};

// a new pair each time; suspended users get nothing
const refresh = async (refreshToken) => {
  const claims = verify(refreshToken, 'refresh');
  if (!claims) return null;
  const user = await prisma.user.findUnique({ where: { id: claims.sub } });
  return user?.status === 'ACTIVE' ? issueTokens(user.id) : null;
};

// used by requireUser on every request
const getUserFromAccessToken = async (accessToken) => {
  const claims = verify(accessToken, 'access');
  return claims ? prisma.user.findUnique({ where: { id: claims.sub } }) : null;
};

// Neon sleeps when idle; the app calls this as sign-in opens so the database is awake by login
const warmUp = () => prisma.$queryRaw`SELECT 1`;

module.exports = { warmUp, loginWithPassword, setPassword, loginWithClerk, refresh, getUserFromAccessToken };
