const { clerkClient, getAuth } = require('@clerk/express');
const { findOrCreateUser } = require('../services/userService');

/**
 * Lets the request through only with a valid Clerk session token,
 * and puts our own User row on req.user (created on the first visit).
 */
const requireUser = async (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ success: false, message: 'Please sign in.' });

  req.user = await findOrCreateUser(userId, () => clerkClient.users.getUser(userId));
  next();
};

module.exports = { requireUser };
