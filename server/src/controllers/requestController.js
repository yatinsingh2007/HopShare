const { randomUUID } = require('node:crypto');
const prisma = require('../config/db');
const { MAX_MEMBERS, point, readPlace, activeRideOf } = require('./rideController');
const { emitToUser, rideChanged, tell } = require('../socket');

const notFound = (res) => res.status(404).json({ success: false, message: 'Ride not found.' });
const isLive = (ride) => ride.time.getTime() > Date.now() - 5 * 60_000;

// POST /api/rides/:id/requests { pickup, destination } — the requester's own stops
const requestToJoin = async (req, res) => {
  const pickup = readPlace(req.body?.pickup);
  const destination = readPlace(req.body?.destination);
  if (!pickup?.name || !destination?.name) {
    return res.status(400).json({ success: false, message: 'Pickup and destination are needed.' });
  }

  const ride = await prisma.ride.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      time: true,
      joinable: true,
      rideCreatorId: true,
      destinationName: true,
      _count: { select: { users: true } },
    },
  });
  if (!ride) return notFound(res);
  if (ride.rideCreatorId === req.user.id)
    return res.status(409).json({ success: false, message: 'This is your own group.' });
  if (!isLive(ride) || !ride.joinable || ride._count.users >= MAX_MEMBERS) {
    return res.status(409).json({
      success: false,
      message: 'This group is full or has already left.',
    });
  }

  const active = await activeRideOf(req.user.id);
  if (active)
    return res.status(409).json({
      success: false,
      message: 'You are already in a group.',
      rideId: active.id,
    });

  const pending = await prisma.joinRequest.findFirst({
    where: { rideId: ride.id, userId: req.user.id, status: 'PENDING' },
    select: { id: true },
  });
  if (pending)
    return res.status(409).json({
      success: false,
      message: 'You have already asked to join this group.',
    });

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "JoinRequest" (id, "rideId", "userId", pickup, "pickupName", destination, "destinationName")
    VALUES (${id}, ${ride.id}, ${req.user.id}, ${point(pickup)}, ${pickup.name.slice(0, 200)},
            ${point(destination)}, ${destination.name.slice(0, 200)})`;

  tell(ride.rideCreatorId, 'requests:updated', { rideId: ride.id, firstName: req.user.name }, {
    kind: 'request_new',
    text: `${req.user.name ?? 'A rider'} wants to join your group to ${ride.destinationName}`,
  });
  res.status(201).json({ success: true, data: { id, rideId: ride.id, status: 'PENDING' } });
};

// GET /api/rides/:id/requests — the creator sees who wants in, with how far their stops are from the group's
const listRequests = async (req, res) => {
  const ride = await prisma.ride.findUnique({
    where: { id: req.params.id },
    select: { rideCreatorId: true },
  });
  if (!ride || ride.rideCreatorId !== req.user.id) return notFound(res);

  const rows = await prisma.$queryRaw`
    SELECT j.id, j."createdAt", u.name AS "firstName",
           j."pickupName", ST_Y(j.pickup::geometry) AS "pickupLat", ST_X(j.pickup::geometry) AS "pickupLon",
           j."destinationName", ST_Y(j.destination::geometry) AS "dropLat", ST_X(j.destination::geometry) AS "dropLon",
           round(ST_Distance(j.pickup, r.source))::int AS "pickupOffM",
           round(ST_Distance(j.destination, r.destination))::int AS "dropOffM"
    FROM "JoinRequest" j
    JOIN "Ride" r ON r.id = j."rideId"
    JOIN "User" u ON u.id = j."userId"
    WHERE j."rideId" = ${req.params.id} AND j.status = 'PENDING'
    ORDER BY j."createdAt"`;

  res.json({
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      firstName: r.firstName,
      createdAt: r.createdAt,
      pickup: {
        latitude: r.pickupLat,
        longitude: r.pickupLon,
        name: r.pickupName,
      },
      destination: {
        latitude: r.dropLat,
        longitude: r.dropLon,
        name: r.destinationName,
      },
      pickupOffM: r.pickupOffM,
      dropOffM: r.dropOffM,
    })),
  });
};

// thrown inside the transaction to roll it back; errorHandler sends { success: false, message } with this status
class Refused extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// POST /api/rides/:id/requests/:requestId/accept — one transaction, the ride row locked so two accepts can't overfill it
const acceptRequest = async (req, res) => {
  const { id: rideId, requestId } = req.params;
  const result = await prisma.$transaction(async (tx) => {
    const [ride] = await tx.$queryRaw`
        SELECT id, time, joinable, "rideCreatorId", "destinationName" FROM "Ride" WHERE id = ${rideId} FOR UPDATE`;
    if (!ride || ride.rideCreatorId !== req.user.id) throw new Refused(404, 'Ride not found.');
    if (!isLive(ride) || !ride.joinable) throw new Refused(409, 'This group has already left or is closed.');

    const request = await tx.joinRequest.findFirst({
      where: { id: requestId, rideId },
    });
    if (!request) throw new Refused(404, 'Request not found.');
    if (request.status !== 'PENDING') throw new Refused(409, 'This request was withdrawn or already answered.');

    const members = await tx.ride.findUnique({
      where: { id: rideId },
      select: { _count: { select: { users: true } } },
    });
    if (members._count.users >= MAX_MEMBERS) throw new Refused(409, 'Your group is full.');

    // the rider may have joined another group since asking: first accept wins
    if (await activeRideOf(request.userId, tx)) return { taken: true };

    await tx.$executeRaw`INSERT INTO "_RideUsers" ("A", "B") VALUES (${rideId}, ${request.userId})`;
    await tx.joinRequest.update({
      where: { id: request.id },
      data: { status: 'ACCEPTED', respondedAt: new Date() },
    });
    // their other pending requests lose; those groups' creators get a fresh list
    const lost = await tx.joinRequest.findMany({
      where: { userId: request.userId, status: 'PENDING', id: { not: request.id } },
      select: { ride: { select: { rideCreatorId: true, id: true } } },
    });
    await tx.joinRequest.updateMany({
      where: {
        userId: request.userId,
        status: 'PENDING',
        id: { not: request.id },
      },
      data: { status: 'CANCELLED', respondedAt: new Date() },
    });

    const full = members._count.users + 1 >= MAX_MEMBERS;
    let crowdedOut = [];
    if (full) {
      crowdedOut = await tx.joinRequest.findMany({ where: { rideId, status: 'PENDING' }, select: { userId: true } });
      await tx.ride.update({
        where: { id: rideId },
        data: { joinable: false },
      });
      await tx.joinRequest.updateMany({
        where: { rideId, status: 'PENDING' },
        data: { status: 'CANCELLED', respondedAt: new Date() },
      });
    }
    return { members: members._count.users + 1, full, requesterId: request.userId, lost, crowdedOut, to: ride.destinationName };
  });

  if (result.taken) {
    await prisma.joinRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELLED', respondedAt: new Date() },
    });
    return res.status(409).json({
      success: false,
      message: 'This rider has already joined another group.',
    });
  }
  const { requesterId, lost, crowdedOut, to, ...data } = result;
  tell(requesterId, 'request:answered', { rideId, status: 'ACCEPTED' }, {
    kind: 'request_accepted',
    text: `You're in ${req.user.name ?? 'the'}${req.user.name ? "'s" : ''} group to ${to}`,
  });
  for (const { ride } of lost) emitToUser(ride.rideCreatorId, 'requests:updated', { rideId: ride.id });
  for (const { userId } of crowdedOut) {
    tell(userId, 'request:answered', { rideId, status: 'CANCELLED' }, {
      kind: 'request_closed',
      text: `The group to ${to} filled up, so your request was closed`,
    });
  }
  rideChanged(rideId);
  res.json({
    success: true,
    data: {
      requestId,
      status: 'ACCEPTED',
      ...data,
      seatsLeft: MAX_MEMBERS - data.members,
    },
  });
};

// POST /api/rides/:id/requests/:requestId/reject — creator only
const rejectRequest = async (req, res) => {
  const { id: rideId, requestId } = req.params;
  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    select: { rideCreatorId: true, destinationName: true },
  });
  if (!ride || ride.rideCreatorId !== req.user.id) return notFound(res);

  const { count } = await prisma.joinRequest.updateMany({
    where: { id: requestId, rideId, status: 'PENDING' },
    data: { status: 'REJECTED', respondedAt: new Date() },
  });
  if (!count)
    return res.status(409).json({
      success: false,
      message: 'This request was withdrawn or already answered.',
    });
  const { userId } = await prisma.joinRequest.findUnique({ where: { id: requestId }, select: { userId: true } });
  tell(userId, 'request:answered', { rideId, status: 'REJECTED' }, {
    kind: 'request_closed',
    text: `Your request to join the group to ${ride.destinationName} wasn't accepted`,
  });
  res.json({ success: true, data: { requestId, status: 'REJECTED' } });
};

// POST /api/rides/:id/requests/:requestId/cancel — the requester withdraws
const cancelRequest = async (req, res) => {
  const { id: rideId, requestId } = req.params;
  const { count } = await prisma.joinRequest.updateMany({
    where: { id: requestId, rideId, userId: req.user.id, status: 'PENDING' },
    data: { status: 'CANCELLED', respondedAt: new Date() },
  });
  if (!count) return res.status(409).json({ success: false, message: 'This request was already answered.' });
  const ride = await prisma.ride.findUnique({ where: { id: rideId }, select: { rideCreatorId: true } });
  if (ride) emitToUser(ride.rideCreatorId, 'requests:updated', { rideId });
  res.json({ success: true, data: { requestId, status: 'CANCELLED' } });
};

// GET /api/rides/requests/mine — my requests still waiting, for live groups only
const myRequests = async (req, res) => {
  const rows = await prisma.joinRequest.findMany({
    where: {
      userId: req.user.id,
      status: 'PENDING',
      ride: { time: { gt: new Date(Date.now() - 5 * 60_000) } },
    },
    select: {
      id: true,
      createdAt: true,
      ride: {
        select: {
          id: true,
          sourceName: true,
          destinationName: true,
          time: true,
          rideCreator: { select: { name: true } },
          _count: { select: { users: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    success: true,
    data: rows.map(({ id, createdAt, ride }) => ({
      id,
      createdAt,
      rideId: ride.id,
      pickupName: ride.sourceName,
      destinationName: ride.destinationName,
      leaveAt: ride.time,
      creatorName: ride.rideCreator.name,
      members: ride._count.users,
    })),
  });
};

module.exports = {
  requestToJoin,
  listRequests,
  acceptRequest,
  rejectRequest,
  cancelRequest,
  myRequests,
};
