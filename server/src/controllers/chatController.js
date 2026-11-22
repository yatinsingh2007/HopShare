const prisma = require('../config/db');
const { emitToUser } = require('../socket');
const { stageOf } = require('../rideState');

const PAGE = 50;
const MAX_LENGTH = 500;
// the group can still sort out payments for a day after the ride ends
const OPEN_AFTER_END_MS = 24 * 60 * 60_000;
// at most 10 messages in 10 seconds per rider, kept in memory like the other live state
const BURST = 10;
const BURST_MS = 10_000;
const recent = new Map(); // userId -> [timestamps]

const refuse = (res, status, message) => res.status(status).json({ success: false, message });

const memberRide = (rideId, userId) =>
  prisma.ride.findFirst({
    where: { id: rideId, users: { some: { id: userId } } },
    select: {
      id: true,
      time: true,
      bookedAt: true,
      pickedUpAt: true,
      endedAt: true, cancelledAt: true,
      chat: { select: { id: true } },
      users: { select: { id: true } },
    },
  });

// open while the ride is live, and for a day after it ends
const isOpen = (ride) => {
  const stage = stageOf(ride);
  if (stage === 'ended') return Date.now() - ride.endedAt.getTime() < OPEN_AFTER_END_MS;
  return stage !== 'past';
};

const view = (m, meId) => ({
  id: m.id,
  senderId: m.senderId,
  // privacy: first name only, like everywhere else
  firstName: m.sender.name,
  content: m.content,
  createdAt: m.createdAt,
  isMe: m.senderId === meId,
});

// GET /api/rides/:id/messages?before=<ISO time> — newest 50 (or the 50 before `before`), oldest first
const listMessages = async (req, res) => {
  const ride = await memberRide(req.params.id, req.user.id);
  if (!ride) return refuse(res, 404, 'Ride not found.');

  const before = req.query.before ? new Date(req.query.before) : null;
  if (before && Number.isNaN(before.getTime())) return refuse(res, 400, 'Bad page.');

  const rows = ride.chat
    ? await prisma.message.findMany({
        where: { chatId: ride.chat.id, ...(before && { createdAt: { lt: before } }) },
        select: { id: true, senderId: true, content: true, createdAt: true, sender: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: PAGE,
      })
    : [];

  res.json({
    success: true,
    data: {
      messages: rows.reverse().map((m) => view(m, req.user.id)),
      hasMore: rows.length === PAGE,
      open: isOpen(ride),
    },
  });
};

// POST /api/rides/:id/messages { content } — sends to everyone in the group over the socket
const sendMessage = async (req, res) => {
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  if (!content) return refuse(res, 400, 'Type a message first.');
  if (content.length > MAX_LENGTH) return refuse(res, 400, `Messages can be up to ${MAX_LENGTH} characters.`);

  const ride = await memberRide(req.params.id, req.user.id);
  if (!ride) return refuse(res, 404, 'Ride not found.');
  if (!isOpen(ride)) return refuse(res, 409, 'This chat has closed.');

  const now = Date.now();
  const mine = (recent.get(req.user.id) ?? []).filter((t) => now - t < BURST_MS);
  if (mine.length >= BURST) return refuse(res, 429, 'Slow down a little.');
  recent.set(req.user.id, [...mine, now]);

  // the chat is made the first time someone writes
  const chat = ride.chat ?? (await prisma.chat.upsert({ where: { rideId: ride.id }, create: { rideId: ride.id }, update: {}, select: { id: true } }));
  const message = await prisma.message.create({
    data: { chatId: chat.id, senderId: req.user.id, content },
    select: { id: true, senderId: true, content: true, createdAt: true, sender: { select: { name: true } } },
  });

  // to each member's own room, so the badge updates even when the chat isn't open
  for (const { id } of ride.users) {
    emitToUser(id, 'chat:message', { rideId: ride.id, message: view(message, id) });
  }
  res.status(201).json({ success: true, data: view(message, req.user.id) });
};

// forget riders who have been quiet, so the map doesn't grow
setInterval(() => {
  const now = Date.now();
  for (const [userId, times] of recent) if (times.every((t) => now - t >= BURST_MS)) recent.delete(userId);
}, 60_000).unref();

module.exports = { listMessages, sendMessage };
