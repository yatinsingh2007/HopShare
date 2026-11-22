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

// handle@bank, e.g. riya.s@okhdfc
const UPI_ID = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{2,64}$/;

// PATCH /api/me { firstName?, upiId? } — send upiId as "" to remove it
const updateMe = async (req, res) => {
  const { firstName, upiId } = req.body ?? {};
  const data = {};

  if (firstName !== undefined) {
    const name = typeof firstName === 'string' ? firstName.trim() : '';
    if (name.length < 1 || name.length > 50) {
      return res.status(400).json({ success: false, message: 'Please enter a first name (up to 50 characters).' });
    }
    data.name = name;
  }

  if (upiId !== undefined) {
    const id = typeof upiId === 'string' ? upiId.trim().toLowerCase() : null;
    if (id === null || (id && !UPI_ID.test(id))) {
      return res.status(400).json({ success: false, message: 'That UPI ID doesn\'t look right. It looks like name@bank.' });
    }
    data.upiId = id || null;
  }

  if (!Object.keys(data).length) return res.status(400).json({ success: false, message: 'Nothing to update.' });

  const user = await prisma.user.update({ where: { id: req.user.id }, data });
  res.json({ success: true, data: toPublicMe(user) });
};

// GET /api/me/activity — the latest 50 things that happened to me, and how many are unread
const myActivity = async (req, res) => {
  const [items, unread] = await Promise.all([
    prisma.activity.findMany({
      where: { userId: req.user.id },
      select: { id: true, kind: true, rideId: true, text: true, createdAt: true, readAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.activity.count({ where: { userId: req.user.id, readAt: null } }),
  ]);
  res.json({ success: true, data: { items, unread } });
};

// POST /api/me/activity/read — opening the feed marks everything read
const readActivity = async (req, res) => {
  await prisma.activity.updateMany({ where: { userId: req.user.id, readAt: null }, data: { readAt: new Date() } });
  res.json({ success: true, data: { unread: 0 } });
};

module.exports = { toPublicMe, getMe, updateMe, myActivity, readActivity };
