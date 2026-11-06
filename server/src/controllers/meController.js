const { toPublicMe, updateName } = require('../services/userService');

const getMe = (req, res) => {
  res.json({ success: true, data: toPublicMe(req.user) });
};

const updateMe = async (req, res) => {
  const firstName = typeof req.body?.firstName === 'string' ? req.body.firstName.trim() : '';
  if (firstName.length < 1 || firstName.length > 50) {
    return res.status(400).json({ success: false, message: 'Please enter a first name (up to 50 characters).' });
  }

  const user = await updateName(req.user.id, firstName);
  res.json({ success: true, data: toPublicMe(user) });
};

module.exports = { getMe, updateMe };
