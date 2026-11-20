const prisma = require('../config/db');

// what the app may see about the signed-in user (never the password hash)
const toPublicMe = (user) => ({
  id: user.id,
  firstName: user.name,
  email: user.email,
  upiId: user.upiId,
  profileComplete: !!user.name && !!user.upiId,
});

const getMe = (req, res) => {
  res.json({ success: true, data: toPublicMe(req.user) });
};

const updateMe = async (req, res) => {
  const firstName = typeof req.body?.firstName === 'string' ? req.body.firstName.trim() : '';
  if (firstName.length < 1 || firstName.length > 50) {
    return res.status(400).json({ success: false, message: 'Please enter a first name (up to 50 characters).' });
  }

  const user = await prisma.user.update({ where: { id: req.user.id }, data: { name: firstName } });
  res.json({ success: true, data: toPublicMe(user) });
};

module.exports = { toPublicMe, getMe, updateMe };
