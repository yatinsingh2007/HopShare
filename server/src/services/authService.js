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

// Clerk only tells us the email code was valid. After that we use our own tokens.
const login = async (clerkToken) => {
  let clerkId;
  try {
    ({ sub: clerkId } = await verifyToken(clerkToken, { jwtKey: process.env.CLERK_JWT_KEY, secretKey: process.env.CLERK_SECRET_KEY }));
  } catch {
    return null;
  }

  const user = await findOrCreateUser(clerkId, () => clerkClient.users.getUser(clerkId));
  return { user, ...issueTokens(user.id) };
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

module.exports = { warmUp, login, refresh, getUserFromAccessToken };
