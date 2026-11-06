const { getUserFromAccessToken } = require('../services/authService');

const requireUser = async (req, res, next) => {
  const token = req.get('authorization')?.replace('Bearer ', '');
  const user = token && (await getUserFromAccessToken(token));

  if (!user) return res.status(401).json({ success: false, message: 'Please sign in.' });
  if (user.status !== 'ACTIVE') return res.status(403).json({ success: false, message: 'This account is suspended.' });

  req.user = user;
  next();
};

module.exports = { requireUser };
