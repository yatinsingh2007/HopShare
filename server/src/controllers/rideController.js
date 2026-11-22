const { randomUUID } = require('node:crypto');
const { Prisma } = require('../../generated/prisma');
const prisma = require('../config/db');
const { rideChanged, tell } = require('../socket');
const { isLiveRide, stageOf, liveRideWhere } = require('../rideState');

const MATCH_METRES = 1000;
const WINDOW_MINUTES = 15;
const MAX_LEAD_MINUTES = 120;
const MAX_MEMBERS = 4;
// shared city cabs: the drop can be at most 70 km (straight line) from the pickup; the app filters the same way
const MAX_RIDE_KM = 70;
const TOO_FAR = `Rides go up to ${MAX_RIDE_KM} km. Pick a destination closer to your pickup.`;

const kmBetween = (a, b) => {
  const rad = (d) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};
const tooFar = (a, b) => kmBetween(a, b) > MAX_RIDE_KM;

// PostGIS wants [lon, lat]
const point = ({ longitude, latitude }) =>
  Prisma.sql`ST_SetSRID(ST_MakePoint(${longitude}::float8, ${latitude}::float8), 4326)::geography`;

// one active group at a time: any live group the user is in
const activeRideOf = (userId, db = prisma) =>
  db.ride.findFirst({
    where: { users: { some: { id: userId } }, ...liveRideWhere() },
    select: { id: true },
  });

// a place from the app: { latitude, longitude, name }
const readPlace = (place) => {
  const latitude = Number(place?.latitude);
  const longitude = Number(place?.longitude);
  const name = typeof place?.name === 'string' ? place.name.trim() : '';
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90) return null;
  if (!Number.isFinite(longitude) || Math.abs(longitude) > 180) return null;
  return { latitude, longitude, name };
};

// "now" up to 2 hours ahead; a few minutes in the past is allowed for clock drift
const readLeaveAt = (value) => {
  const leaveAt = value ? new Date(value) : new Date();
  const minutesAhead = (leaveAt - Date.now()) / 60_000;
  if (Number.isNaN(minutesAhead) || minutesAhead < -5 || minutesAhead > MAX_LEAD_MINUTES) return null;
  return leaveAt;
};

// GET /api/rides/match?pickupLat=&pickupLon=&dropLat=&dropLon=&leaveAt=
const matchRides = async (req, res) => {
  const { pickupLat, pickupLon, dropLat, dropLon, leaveAt: leaveAtParam } = req.query;
  const pickup = readPlace({ latitude: pickupLat, longitude: pickupLon });
  const drop = readPlace({ latitude: dropLat, longitude: dropLon });
  const leaveAt = readLeaveAt(leaveAtParam);
  if (!pickup || !drop) return res.status(400).json({ success: false, message: 'Pickup and destination are needed.' });
  if (tooFar(pickup, drop)) return res.status(400).json({ success: false, message: TOO_FAR });
  if (!leaveAt) return res.status(400).json({ success: false, message: 'Leaving time must be within the next 2 hours.' });

  const from = new Date(leaveAt.getTime() - WINDOW_MINUTES * 60_000);
  const to = new Date(leaveAt.getTime() + WINDOW_MINUTES * 60_000);
  const me = point(pickup);
  const myDrop = point(drop);

  // both ends within 1 km, leaving within ±15 min, room left, and not a ride I'm already in
  const rides = await prisma.$queryRaw`
    SELECT r.id, r."sourceName", r."destinationName", r.time, u.name AS "creatorName",
           ST_Y(r.source::geometry) AS "pickupLat", ST_X(r.source::geometry) AS "pickupLon",
           ST_Y(r.destination::geometry) AS "dropLat", ST_X(r.destination::geometry) AS "dropLon",
           round(ST_Distance(r.source, ${me}))::int AS "walkToPickupM",
           round(ST_Distance(r.destination, ${myDrop}))::int AS "walkFromDropM",
           (SELECT count(*) FROM "_RideUsers" m WHERE m."A" = r.id)::int AS members,
           EXISTS (SELECT 1 FROM "JoinRequest" j
                   WHERE j."rideId" = r.id AND j."userId" = ${req.user.id} AND j.status = 'PENDING') AS requested
    FROM "Ride" r
    JOIN "User" u ON u.id = r."rideCreatorId"
    WHERE r.joinable
      AND r.time BETWEEN ${from} AND ${to}
      AND r.time > now() - interval '5 minutes'
      AND ST_DWithin(r.source, ${me}, ${MATCH_METRES})
      AND ST_DWithin(r.destination, ${myDrop}, ${MATCH_METRES})
      AND NOT EXISTS (SELECT 1 FROM "_RideUsers" m WHERE m."A" = r.id AND m."B" = ${req.user.id})
      AND (SELECT count(*) FROM "_RideUsers" m WHERE m."A" = r.id) < ${MAX_MEMBERS}
    ORDER BY r.time, "walkToPickupM"
    LIMIT 20`;

  res.json({
    success: true,
    data: rides.map((r) => ({
      id: r.id,
      pickup: { latitude: r.pickupLat, longitude: r.pickupLon, name: r.sourceName },
      destination: { latitude: r.dropLat, longitude: r.dropLon, name: r.destinationName },
      leaveAt: r.time,
      walkToPickupM: r.walkToPickupM,
      walkFromDropM: r.walkFromDropM,
      members: r.members,
      seatsLeft: MAX_MEMBERS - r.members,
      creatorName: r.creatorName,
      requested: r.requested,
    })),
  });
};

// POST /api/rides { pickup, destination, leaveAt } — "Start my own group"; the creator is its first member
const createRide = async (req, res) => {
  const pickup = readPlace(req.body?.pickup);
  const destination = readPlace(req.body?.destination);
  const leaveAt = readLeaveAt(req.body?.leaveAt);
  if (!pickup?.name || !destination?.name) {
    return res.status(400).json({ success: false, message: 'Pickup and destination are needed.' });
  }
  if (tooFar(pickup, destination)) return res.status(400).json({ success: false, message: TOO_FAR });
  if (!leaveAt) return res.status(400).json({ success: false, message: 'Leaving time must be within the next 2 hours.' });

  const active = await activeRideOf(req.user.id);
  if (active) return res.status(409).json({ success: false, message: 'You are already in a group.', rideId: active.id });

  const id = randomUUID();
  await prisma.$transaction([
    prisma.$executeRaw`
      INSERT INTO "Ride" (id, source, "sourceName", destination, "destinationName", time, "rideCreatorId")
      VALUES (${id}, ${point(pickup)}, ${pickup.name.slice(0, 200)},
              ${point(destination)}, ${destination.name.slice(0, 200)}, ${leaveAt}, ${req.user.id})`,
    prisma.$executeRaw`INSERT INTO "_RideUsers" ("A", "B") VALUES (${id}, ${req.user.id})`,
  ]);

  res.status(201).json({
    success: true,
    data: { id, pickup, destination, leaveAt, members: 1, seatsLeft: MAX_MEMBERS - 1 },
  });
};

// GET /api/rides/mine — groups I'm in, newest first
const myRides = async (req, res) => {
  const rides = await prisma.ride.findMany({
    where: { users: { some: { id: req.user.id } } },
    select: {
      id: true,
      sourceName: true,
      destinationName: true,
      time: true,
      rideCreatorId: true,
      bookedAt: true,
      pickedUpAt: true,
      endedAt: true, cancelledAt: true,
      farePaise: true,
      paymentStatus: true,
      // my share, if I owe the booker
      payments: { where: { fromId: req.user.id }, select: { amountPaise: true, status: true } },
      _count: { select: { users: true } },
    },
    orderBy: { time: 'desc' },
    take: 20,
  });

  res.json({
    success: true,
    data: rides.map((r) => ({
      id: r.id,
      pickupName: r.sourceName,
      destinationName: r.destinationName,
      leaveAt: r.time,
      members: r._count.users,
      seatsLeft: MAX_MEMBERS - r._count.users,
      isCreator: r.rideCreatorId === req.user.id,
      live: isLiveRide(r),
      stage: stageOf(r),
      farePaise: r.farePaise,
      settled: r.paymentStatus === 'PAID',
      myShare: r.payments[0] ?? null,
    })),
  });
};

// GET /api/rides/:id — only for people in the group; anyone else gets 404, so ids can't be probed
const getRide = async (req, res) => {
  const ride = await prisma.ride.findFirst({
    where: { id: req.params.id, users: { some: { id: req.user.id } } },
    select: {
      id: true,
      sourceName: true,
      destinationName: true,
      time: true,
      rideCreatorId: true,
      bookedAt: true,
      cabNumber: true,
      tripLink: true,
      pickedUpAt: true,
      endedAt: true, cancelledAt: true,
      farePaise: true,
      paymentStatus: true,
      rideCreator: { select: { upiId: true } },
      users: { select: { id: true, name: true } },
      payments: {
        select: { id: true, fromId: true, amountPaise: true, status: true, claimedAt: true },
        orderBy: { createdAt: 'asc' },
      },
      tripShares: {
        where: { userId: req.user.id, stoppedAt: null, expiresAt: { gt: new Date() } },
        select: { token: true },
        take: 1,
      },
      chat: { select: { messages: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 } } },
    },
  });
  if (!ride) return res.status(404).json({ success: false, message: 'Ride not found.' });

  const [where] = await prisma.$queryRaw`
    SELECT ST_Y(source::geometry) AS "pickupLat", ST_X(source::geometry) AS "pickupLon",
           ST_Y(destination::geometry) AS "dropLat", ST_X(destination::geometry) AS "dropLon"
    FROM "Ride" WHERE id = ${ride.id}`;

  // creator first, then everyone else
  const members = ride.users
    .map((u) => ({ id: u.id, firstName: u.name, isCreator: u.id === ride.rideCreatorId, isMe: u.id === req.user.id }))
    .sort((a, b) => Number(b.isCreator) - Number(a.isCreator));

  res.json({
    success: true,
    data: {
      id: ride.id,
      pickup: { latitude: where.pickupLat, longitude: where.pickupLon, name: ride.sourceName },
      destination: { latitude: where.dropLat, longitude: where.dropLon, name: ride.destinationName },
      leaveAt: ride.time,
      // open → booked → picked_up → ended, or past
      stage: stageOf(ride),
      live: isLiveRide(ride),
      isCreator: ride.rideCreatorId === req.user.id,
      members,
      seatsLeft: MAX_MEMBERS - members.length,
      booking: ride.bookedAt
        ? {
            bookedAt: ride.bookedAt,
            cabNumber: ride.cabNumber,
            tripLink: ride.tripLink,
          }
        : null,
      fare: ride.endedAt ? fareView(ride, members, req.user.id) : null,
      // am I sending a public live link for this ride?
      sharingTrip: !ride.endedAt && !ride.cancelledAt && ride.tripShares.length > 0,
      // when the group chat last had a message, so the app can show a "new" dot
      lastMessageAt: ride.chat?.messages[0]?.createdAt ?? null,
    },
  });
};

// the split once the booker has entered the fare; the booker's UPI ID is shown so the others can pay
const fareView = (ride, members, meId) => {
  const name = (id) => members.find((m) => m.id === id)?.firstName ?? 'Rider';
  return {
    farePaise: ride.farePaise,
    // everyone who rode, booker included; leftover paise stay with the booker
    riders: ride.payments.length + 1,
    sharePaise: ride.payments[0]?.amountPaise ?? ride.farePaise,
    bookerUpiId: ride.rideCreator.upiId,
    settled: ride.paymentStatus === 'PAID',
    payments: ride.payments.map((p) => ({
      id: p.id,
      userId: p.fromId,
      firstName: name(p.fromId),
      amountPaise: p.amountPaise,
      status: p.status,
      claimedAt: p.claimedAt,
      isMe: p.fromId === meId,
    })),
  };
};

// optional text: trimmed, empty becomes null, too long is refused
const readText = (value, max) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.trim().length > max) return undefined;
  return value.trim() || null;
};

// only https links, since the others will open it
const readLink = (value) => {
  const text = readText(value, 500);
  if (!text) return text;
  try {
    return new URL(text).protocol === 'https:' ? text : undefined;
  } catch {
    return undefined;
  }
};

// POST /api/rides/:id/booked { cabNumber?, tripLink? } — the booker says the cab is booked.
// Closes the group to new riders and cancels pending requests. Calling it again updates the details.
const markBooked = async (req, res) => {
  const body = req.body ?? {};
  const cabNumber = readText(body.cabNumber, 15);
  const tripLink = readLink(body.tripLink);
  if (cabNumber === undefined) return res.status(400).json({ success: false, message: 'Cab number can be up to 15 characters.' });
  if (tripLink === undefined) return res.status(400).json({ success: false, message: 'Trip link must be a https:// link.' });

  const ride = await prisma.ride.findFirst({
    where: { id: req.params.id, users: { some: { id: req.user.id } } },
    select: { id: true, time: true, rideCreatorId: true, bookedAt: true, destinationName: true, users: { select: { id: true } } },
  });
  if (!ride) return res.status(404).json({ success: false, message: 'Ride not found.' });
  if (ride.rideCreatorId !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Only the person who started the group books the cab.' });
  }
  if (ride.time.getTime() <= Date.now() - 5 * 60_000) {
    return res.status(409).json({ success: false, message: 'This group has already left.' });
  }

  const bookedAt = ride.bookedAt ?? new Date();
  const crowdedOut = await prisma.joinRequest.findMany({
    where: { rideId: ride.id, status: 'PENDING' },
    select: { userId: true },
  });
  await prisma.$transaction([
    prisma.ride.update({
      where: { id: ride.id },
      data: { bookedAt, joinable: false, cabNumber: cabNumber?.toUpperCase() ?? null, tripLink },
    }),
    prisma.joinRequest.updateMany({
      where: { rideId: ride.id, status: 'PENDING' },
      data: { status: 'CANCELLED', respondedAt: new Date() },
    }),
  ]);

  for (const { userId } of crowdedOut) {
    tell(userId, 'request:answered', { rideId: ride.id, status: 'CANCELLED' }, {
      kind: 'request_closed',
      text: `The group to ${ride.destinationName} booked its cab, so your request was closed`,
    });
  }
  // first booking only: tell the others the cab is on its way
  if (!ride.bookedAt) {
    for (const { id } of ride.users.filter((u) => u.id !== req.user.id)) {
      tell(id, 'cab:booked', { rideId: ride.id }, {
        kind: 'cab_booked',
        text: `${req.user.name ?? 'Your booker'} booked the cab to ${ride.destinationName}`,
      });
    }
  }
  rideChanged(ride.id);
  res.json({
    success: true,
    data: { bookedAt, cabNumber: cabNumber?.toUpperCase() ?? null, tripLink },
  });
};

// the ride, if I'm in it, with what cancel and leave need
const rideForMember = (rideId, userId) =>
  prisma.ride.findFirst({
    where: { id: rideId, users: { some: { id: userId } } },
    select: {
      id: true,
      time: true,
      bookedAt: true,
      pickedUpAt: true,
      endedAt: true,
      cancelledAt: true,
      rideCreatorId: true,
      destinationName: true,
      users: { select: { id: true } },
    },
  });

// POST /api/rides/:id/cancel — the person who started the group calls it off, any time before pickup.
// Everyone in it is told, waiting requests close, and live location and trip links stop.
const cancelRide = async (req, res) => {
  const ride = await rideForMember(req.params.id, req.user.id);
  if (!ride) return res.status(404).json({ success: false, message: 'Ride not found.' });
  if (ride.rideCreatorId !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Only the person who started the group can cancel it. You can leave it instead.' });
  }
  const stage = stageOf(ride);
  if (stage !== 'open' && stage !== 'booked') {
    return res.status(409).json({ success: false, message: 'This ride can no longer be cancelled.' });
  }

  const now = new Date();
  const waiting = await prisma.joinRequest.findMany({ where: { rideId: ride.id, status: 'PENDING' }, select: { userId: true } });
  await prisma.$transaction([
    prisma.ride.update({ where: { id: ride.id }, data: { cancelledAt: now, joinable: false } }),
    prisma.joinRequest.updateMany({ where: { rideId: ride.id, status: 'PENDING' }, data: { status: 'CANCELLED', respondedAt: now } }),
    prisma.tripShare.updateMany({ where: { rideId: ride.id, stoppedAt: null }, data: { stoppedAt: now } }),
  ]);

  const who = req.user.name ?? 'The person who started it';
  for (const { id } of ride.users.filter((u) => u.id !== req.user.id)) {
    tell(id, 'ride:cancelled', { rideId: ride.id }, {
      kind: 'ride_cancelled',
      text: `${who} cancelled the ride to ${ride.destinationName}${ride.bookedAt ? '. If a cab was booked, they will cancel it' : ''}`,
    });
  }
  for (const { userId } of waiting) {
    tell(userId, 'request:answered', { rideId: ride.id, status: 'CANCELLED' }, {
      kind: 'request_closed',
      text: `The group to ${ride.destinationName} was cancelled, so your request was closed`,
    });
  }
  rideChanged(ride.id);
  res.json({ success: true, data: { cancelledAt: now } });
};

// POST /api/rides/:id/leave — a rider who joined drops out before pickup. The seat opens again if the
// cab isn't booked yet; the person who started the group is told.
const leaveRide = async (req, res) => {
  const ride = await rideForMember(req.params.id, req.user.id);
  if (!ride) return res.status(404).json({ success: false, message: 'Ride not found.' });
  if (ride.rideCreatorId === req.user.id) {
    return res.status(409).json({ success: false, message: 'You started this group, so cancel it instead.' });
  }
  const stage = stageOf(ride);
  if (stage !== 'open' && stage !== 'booked') {
    return res.status(409).json({ success: false, message: 'You can only leave before pickup.' });
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.$executeRaw`DELETE FROM "_RideUsers" WHERE "A" = ${ride.id} AND "B" = ${req.user.id}`,
    // a seat opens only while the group is still looking for riders
    ...(ride.bookedAt ? [] : [prisma.ride.update({ where: { id: ride.id }, data: { joinable: true } })]),
    prisma.tripShare.updateMany({ where: { rideId: ride.id, userId: req.user.id, stoppedAt: null }, data: { stoppedAt: now } }),
  ]);

  tell(ride.rideCreatorId, 'requests:updated', { rideId: ride.id }, {
    kind: 'member_left',
    text: `${req.user.name ?? 'A rider'} left your group to ${ride.destinationName}${ride.bookedAt ? '' : '. Their seat is open again'}`,
  });
  rideChanged(ride.id);
  res.json({ success: true, data: { left: true } });
};

module.exports = { MAX_MEMBERS, TOO_FAR, tooFar, point, readPlace, activeRideOf, matchRides, createRide, myRides, getRide, markBooked, cancelRide, leaveRide };
