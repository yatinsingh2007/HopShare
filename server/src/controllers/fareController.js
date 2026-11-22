const prisma = require('../config/db');
const { rideChanged, tell } = require('../socket');

const inr = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const { stageOf } = require('../rideState');

const MAX_FARE_RUPEES = 20_000;

const notFound = (res) => res.status(404).json({ success: false, message: 'Ride not found.' });
const refuse = (res, status, message) => res.status(status).json({ success: false, message });

// the ride, if the caller is in it
const rideFor = (rideId, userId) =>
  prisma.ride.findFirst({
    where: { id: rideId, users: { some: { id: userId } } },
    select: {
      id: true,
      time: true,
      bookedAt: true,
      pickedUpAt: true,
      endedAt: true, cancelledAt: true,
      rideCreatorId: true,
      destinationName: true,
      rideCreator: { select: { name: true, upiId: true } },
      users: { select: { id: true } },
    },
  });

// POST /api/rides/:id/picked-up — the booker says everyone is in the cab; location sharing stops
const pickedUp = async (req, res) => {
  const ride = await rideFor(req.params.id, req.user.id);
  if (!ride) return notFound(res);
  if (ride.rideCreatorId !== req.user.id) return refuse(res, 403, 'Only the booker marks the pickup.');
  if (stageOf(ride) !== 'booked') return refuse(res, 409, 'Book the cab first, or this ride has already moved on.');

  const pickedUpAt = new Date();
  await prisma.ride.update({ where: { id: ride.id }, data: { pickedUpAt } });
  rideChanged(ride.id);
  res.json({ success: true, data: { pickedUpAt } });
};

// POST /api/rides/:id/fare { fare, riderIds? } — "We've arrived". fare is in rupees; riderIds are the members
// who rode (default: everyone), so no-shows are left out. Split evenly in paise; leftover paise stay with the booker.
const setFare = async (req, res) => {
  const fare = Number(req.body?.fare);
  if (!Number.isFinite(fare) || fare <= 0 || fare > MAX_FARE_RUPEES) {
    return refuse(res, 400, `Enter the fare you paid, up to ₹${MAX_FARE_RUPEES.toLocaleString('en-IN')}.`);
  }
  const riderIds = req.body?.riderIds;
  if (riderIds !== undefined && (!Array.isArray(riderIds) || riderIds.some((id) => typeof id !== 'string'))) {
    return refuse(res, 400, 'Pick who rode with you.');
  }

  const ride = await rideFor(req.params.id, req.user.id);
  if (!ride) return notFound(res);
  if (ride.rideCreatorId !== req.user.id) return refuse(res, 403, 'Only the booker enters the fare.');
  const stage = stageOf(ride);
  if (stage === 'open') return refuse(res, 409, 'Book the cab first.');
  if (stage === 'ended') return refuse(res, 409, 'The fare is already in.');
  if (stage === 'past') return refuse(res, 409, 'This ride is over.');
  if (!ride.rideCreator.upiId) return refuse(res, 409, 'Add your UPI ID on your profile first, so the others can pay you.');

  const others = ride.users.map((u) => u.id).filter((id) => id !== req.user.id);
  const payers = riderIds ? others.filter((id) => riderIds.includes(id)) : others;
  const farePaise = Math.round(fare * 100);
  const sharePaise = Math.floor(farePaise / (payers.length + 1));
  const now = new Date();

  await prisma.$transaction([
    prisma.ride.update({
      where: { id: ride.id },
      data: {
        endedAt: now,
        pickedUpAt: ride.pickedUpAt ?? now,
        farePaise,
        // nobody to pay back: already settled
        paymentStatus: payers.length ? 'PENDING' : 'PAID',
      },
    }),
    prisma.payment.createMany({
      data: payers.map((fromId) => ({ fromId, toId: req.user.id, rideId: ride.id, amountPaise: sharePaise })),
    }),
  ]);

  for (const userId of payers) {
    tell(userId, 'payment:due', { rideId: ride.id, amountPaise: sharePaise, bookerName: ride.rideCreator.name }, {
      kind: 'payment_due',
      text: `Pay ${ride.rideCreator.name ?? 'your booker'} ${inr(sharePaise)} for the ride to ${ride.destinationName}`,
    });
  }
  rideChanged(ride.id);
  res.json({ success: true, data: { farePaise, sharePaise, riders: payers.length + 1 } });
};

// POST /api/rides/:id/payments/:paymentId/claim — the rider says they've paid over UPI
const claimPayment = async (req, res) => {
  const { count } = await prisma.payment.updateMany({
    where: { id: req.params.paymentId, rideId: req.params.id, fromId: req.user.id, status: 'PENDING', claimedAt: null },
    data: { claimedAt: new Date() },
  });
  const payment = await prisma.payment.findFirst({
    where: { id: req.params.paymentId, rideId: req.params.id, fromId: req.user.id },
    select: { toId: true, amountPaise: true, ride: { select: { destinationName: true } } },
  });
  if (!payment) return refuse(res, 404, 'Payment not found.');
  if (!count) return refuse(res, 409, 'This payment is already marked.');

  tell(payment.toId, 'payment:claimed', { rideId: req.params.id, firstName: req.user.name, amountPaise: payment.amountPaise }, {
    kind: 'payment_claimed',
    text: `${req.user.name ?? 'A rider'} marked ${inr(payment.amountPaise)} as paid. Check your UPI app`,
  });
  rideChanged(req.params.id);
  res.json({ success: true, data: { id: req.params.paymentId, claimed: true } });
};

// POST /api/rides/:id/payments/:paymentId/confirm — the booker got the money; when all are in, the ride is settled
const confirmPayment = async (req, res) => {
  const rideId = req.params.id;
  const result = await prisma.$transaction(async (tx) => {
    const { count } = await tx.payment.updateMany({
      where: { id: req.params.paymentId, rideId, toId: req.user.id, status: 'PENDING' },
      data: { status: 'PAID' },
    });
    if (!count) return null;
    const left = await tx.payment.count({ where: { rideId, status: 'PENDING' } });
    if (!left) await tx.ride.update({ where: { id: rideId }, data: { paymentStatus: 'PAID' } });
    const { fromId, amountPaise } = await tx.payment.findUnique({ where: { id: req.params.paymentId }, select: { fromId: true, amountPaise: true } });
    return { settled: !left, fromId, amountPaise };
  });
  if (result === null) {
    const exists = await prisma.payment.count({ where: { id: req.params.paymentId, rideId, toId: req.user.id } });
    return exists ? refuse(res, 409, 'This payment is already confirmed.') : refuse(res, 404, 'Payment not found.');
  }

  tell(result.fromId, 'payment:confirmed', { rideId, firstName: req.user.name }, {
    kind: 'payment_confirmed',
    text: `${req.user.name ?? 'Your booker'} got your ${inr(result.amountPaise)}. You're all square`,
  });
  rideChanged(rideId);
  res.json({ success: true, data: { id: req.params.paymentId, status: 'PAID', settled: result.settled } });
};

// GET /api/me/payments — every payment I'm part of: what I owe bookers and what riders owe me
const myPayments = async (req, res) => {
  const select = {
    id: true,
    rideId: true,
    amountPaise: true,
    status: true,
    claimedAt: true,
    createdAt: true,
    ride: { select: { destinationName: true, endedAt: true, cancelledAt: true } },
  };
  const [owe, owed] = await Promise.all([
    prisma.payment.findMany({
      where: { fromId: req.user.id },
      select: { ...select, to: { select: { name: true, upiId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.payment.findMany({
      where: { toId: req.user.id },
      select: { ...select, from: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  const view = (p) => ({
    id: p.id,
    rideId: p.rideId,
    destinationName: p.ride.destinationName,
    endedAt: p.ride.endedAt,
    amountPaise: p.amountPaise,
    status: p.status,
    claimedAt: p.claimedAt,
  });
  res.json({
    success: true,
    data: {
      owe: owe.map((p) => ({ ...view(p), toName: p.to.name, toUpiId: p.to.upiId })),
      owed: owed.map((p) => ({ ...view(p), fromName: p.from.name })),
    },
  });
};

module.exports = { pickedUp, setFare, claimPayment, confirmPayment, myPayments };
