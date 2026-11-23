const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { initializeApp, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const prisma = require('./config/db');
const { stageOf } = require('./rideState');

// Live state lives here, in memory, while we run one server (README section 8).
// Moving to Redis later touches only this file.
const POSITION_TTL = 60_000;
const ACCESS_TTL = 15_000;
const positions = new Map(); // rideId -> Map(userId -> { latitude, longitude, at })
const access = new Map(); // rideId -> { members: Set<userId>, sharing, until }

let io = null;

// Push through Firebase Cloud Messaging, so alerts arrive even when the app is closed.
// FIREBASE_SERVICE_ACCOUNT holds the service-account JSON; without it, pushes are skipped.
const fcm = process.env.FIREBASE_SERVICE_ACCOUNT
  ? getMessaging(initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) }))
  : null;
const DEAD_TOKEN = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']);

const push = async (userId, title, body, data = {}) => {
  if (!fcm) return;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { fcmToken: true } });
    if (!user?.fcmToken) return;
    await fcm.send({
      token: user.fcmToken,
      notification: { title, body },
      data,
      // the app's "Your rides" channel, so it shows as a heads-up banner
      android: { priority: 'high', notification: { channelId: 'rides' } },
    });
  } catch (e) {
    // the app was uninstalled or the token rotated: forget it
    if (DEAD_TOKEN.has(e?.code)) prisma.user.update({ where: { id: userId }, data: { fcmToken: null } }).catch(() => {});
  }
};

// who is in a ride and whether they share location now; cached briefly so location updates don't hit the DB
const rideAccess = async (rideId) => {
  const cached = access.get(rideId);
  if (cached && cached.until > Date.now()) return cached;
  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    select: {
      time: true,
      bookedAt: true,
      pickedUpAt: true,
      endedAt: true, cancelledAt: true,
      users: { select: { id: true } },
      tripShares: { where: { stoppedAt: null, expiresAt: { gt: new Date() } }, select: { userId: true } },
    },
  });
  const stage = ride ? stageOf(ride) : 'past';
  const entry = {
    members: new Set(ride?.users.map((u) => u.id) ?? []),
    // the whole group shares from "cab booked" until "picked up"
    sharing: stage === 'booked',
    // riders with a trip-share link keep sending until the ride ends
    sharers: new Set(stage === 'booked' || stage === 'picked_up' ? (ride?.tripShares.map((t) => t.userId) ?? []) : []),
    until: Date.now() + ACCESS_TTL,
  };
  access.set(rideId, entry);
  return entry;
};

const freshPositions = (rideId, exceptUserId) => {
  const now = Date.now();
  return [...(positions.get(rideId) ?? new Map())]
    .filter(([userId, p]) => userId !== exceptUserId && now - p.at < POSITION_TTL)
    .map(([userId, p]) => ({ userId, ...p }));
};

// the handshake sends the same access token as HTTP, checked the same way as requireUser
const authenticate = async (socket, next) => {
  let claims = null;
  try {
    claims = jwt.verify(socket.handshake.auth?.token, process.env.JWT_SECRET);
  } catch {}
  const user =
    claims?.type === 'access'
      ? await prisma.user.findUnique({ where: { id: claims.sub }, select: { id: true, status: true } })
      : null;
  if (!user || user.status !== 'ACTIVE') return next(new Error('unauthorized'));
  socket.data.userId = user.id;
  next();
};

// { rideId } -> joins the ride's room; answers with the latest positions of the others
const watchRide = async (socket, { rideId } = {}, ack) => {
  if (typeof rideId !== 'string') return ack?.({ ok: false });
  const { members, sharing } = await rideAccess(rideId);
  if (!members.has(socket.data.userId)) return ack?.({ ok: false });
  socket.join(`ride:${rideId}`);
  ack?.({ ok: true, sharing, positions: freshPositions(rideId, socket.data.userId) });
};

// { rideId, latitude, longitude } -> kept for 60 s and passed to the rest of the group
const updateLocation = async (socket, { rideId, latitude, longitude } = {}) => {
  if (typeof rideId !== 'string') return;
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90) return;
  if (!Number.isFinite(longitude) || Math.abs(longitude) > 180) return;
  const { members, sharing, sharers } = await rideAccess(rideId);
  const me = socket.data.userId;
  if (!members.has(me) || (!sharing && !sharers.has(me))) return;

  const at = Date.now();
  if (!positions.has(rideId)) positions.set(rideId, new Map());
  positions.get(rideId).set(me, { latitude, longitude, at });
  // the group sees each other only while meeting up; a trip-share position is for its public link
  if (sharing) socket.to(`ride:${rideId}`).emit('location:update', { userId: me, latitude, longitude, at });
};

// drop positions nobody has refreshed in a minute, and rides left with none
const sweep = () => {
  const now = Date.now();
  for (const [rideId, riders] of positions) {
    for (const [userId, p] of riders) if (now - p.at >= POSITION_TTL) riders.delete(userId);
    if (!riders.size) positions.delete(rideId);
  }
  for (const [rideId, entry] of access) if (entry.until <= now) access.delete(rideId);
};

const attachSocket = (httpServer) => {
  io = new Server(httpServer);
  io.use((socket, next) => authenticate(socket, next).catch(() => next(new Error('unauthorized'))));
  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);
    // a failed DB lookup must not crash the server
    const safe = (handler) => (data, ack) => handler(socket, data, ack).catch(() => ack?.({ ok: false }));
    socket.on('ride:watch', safe(watchRide));
    socket.on('ride:unwatch', ({ rideId } = {}) => socket.leave(`ride:${rideId}`));
    socket.on('location:update', safe(updateLocation));
  });
  setInterval(sweep, 30_000).unref();
};

// called by controllers after a change
const emitToUser = (userId, event, data) => io?.to(`user:${userId}`).emit(event, data);
const rideChanged = (rideId) => {
  access.delete(rideId);
  io?.to(`ride:${rideId}`).emit('ride:updated', { rideId });
};

// emits the event and keeps a line for the user's Activity feed; a failed write never breaks the request
const tell = (userId, event, data, { kind, text }) => {
  emitToUser(userId, event, data);
  push(userId, 'HopShare', text, data?.rideId ? { rideId: data.rideId } : {});
  prisma.activity
    .create({ data: { userId, kind, rideId: data?.rideId ?? null, text } })
    .then(() => emitToUser(userId, 'activity:new', { kind }))
    .catch(() => {});
};

// a rider's latest position on a ride, if fresh (for the public trip-share page)
const positionOf = (rideId, userId) => {
  const p = positions.get(rideId)?.get(userId);
  return p && Date.now() - p.at < POSITION_TTL ? p : null;
};

module.exports = { attachSocket, emitToUser, rideChanged, tell, push, positionOf };
