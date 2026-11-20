const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

// checks our access token on every protected request, then loads the user
const requireUser = async (req, res, next) => {
  const token = req.get('authorization')?.replace('Bearer ', '');
  let claims = null;
  try {
    claims = jwt.verify(token, process.env.JWT_SECRET);
  } catch {}
  const user = claims?.type === 'access' ? await prisma.user.findUnique({ where: { id: claims.sub } }) : null;

  if (!user) return res.status(401).json({ success: false, message: 'Please sign in.' });
  if (user.status !== 'ACTIVE') return res.status(403).json({ success: false, message: 'This account is suspended.' });

  req.user = user;
  next();
};

module.exports = { requireUser };
