const { randomBytes } = require('node:crypto');
const prisma = require('../config/db');
const { rideChanged, positionOf } = require('../socket');
const { stageOf } = require('../rideState');

const MAX_CONTACTS = 3;
const SHARE_HOURS = 4;

const refuse = (res, status, message) => res.status(status).json({ success: false, message });
// tokens are base64url from randomBytes(18); anything else is refused before it reaches a query or the page
const TOKEN = /^[A-Za-z0-9_-]{24}$/;

// the public link lives on this server; PUBLIC_URL overrides it behind a proxy
const baseUrl = (req) => process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
const shareUrl = (req, token) => `${baseUrl(req)}/trip/${token}`;

// 10-digit Indian mobile, with or without +91 / 0 and spaces
const readPhone = (value) => {
  const digits = String(value ?? '').replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
};

// GET /api/me/contacts
const listContacts = async (req, res) => {
  const contacts = await prisma.trustedContact.findMany({
    where: { userId: req.user.id },
    select: { id: true, name: true, phone: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ success: true, data: contacts });
};

// POST /api/me/contacts { name, phone }
const addContact = async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const phone = readPhone(req.body?.phone);
  if (!name || name.length > 40) return refuse(res, 400, 'Enter their name (up to 40 characters).');
  if (!phone) return refuse(res, 400, 'Enter a 10-digit Indian mobile number.');

  const count = await prisma.trustedContact.count({ where: { userId: req.user.id } });
  if (count >= MAX_CONTACTS) return refuse(res, 409, `You can add up to ${MAX_CONTACTS} trusted contacts.`);
  const exists = await prisma.trustedContact.findUnique({ where: { userId_phone: { userId: req.user.id, phone } } });
  if (exists) return refuse(res, 409, 'That number is already one of your contacts.');

  const contact = await prisma.trustedContact.create({
    data: { userId: req.user.id, name, phone },
    select: { id: true, name: true, phone: true },
  });
  res.status(201).json({ success: true, data: contact });
};

// DELETE /api/me/contacts/:contactId
const removeContact = async (req, res) => {
  const { count } = await prisma.trustedContact.deleteMany({ where: { id: req.params.contactId, userId: req.user.id } });
  if (!count) return refuse(res, 404, 'Contact not found.');
  res.json({ success: true, data: { id: req.params.contactId } });
};

const activeShare = (rideId, userId) =>
  prisma.tripShare.findFirst({
    where: { rideId, userId, stoppedAt: null, expiresAt: { gt: new Date() } },
    select: { token: true, expiresAt: true },
  });

// a share for me on this ride, reusing a live one; null if the ride isn't under way
const ensureShare = async (ride, userId) => {
  const stage = stageOf(ride);
  if (stage !== 'open' && stage !== 'booked' && stage !== 'picked_up') return null;
  const existing = await activeShare(ride.id, userId);
  if (existing) return existing;
  const share = await prisma.tripShare.create({
    data: {
      token: randomBytes(18).toString('base64url'),
      userId,
      rideId: ride.id,
      expiresAt: new Date(Date.now() + SHARE_HOURS * 60 * 60_000),
    },
    select: { token: true, expiresAt: true },
  });
  // the socket starts accepting this rider's location after pickup
  rideChanged(ride.id);
  return share;
};

const memberRide = (rideId, userId) =>
  prisma.ride.findFirst({
    where: { id: rideId, users: { some: { id: userId } } },
    select: { id: true, time: true, bookedAt: true, pickedUpAt: true, endedAt: true },
  });

// POST /api/rides/:id/share — start a public live link for my trip
const startShare = async (req, res) => {
  const ride = await memberRide(req.params.id, req.user.id);
  if (!ride) return refuse(res, 404, 'Ride not found.');
  const share = await ensureShare(ride, req.user.id);
  if (!share) return refuse(res, 409, 'This ride is over, so there is nothing to share.');
  res.json({ success: true, data: { url: shareUrl(req, share.token), expiresAt: share.expiresAt } });
};

// DELETE /api/rides/:id/share — stop it; the link shows "ended" from now on
const stopShare = async (req, res) => {
  await prisma.tripShare.updateMany({
    where: { rideId: req.params.id, userId: req.user.id, stoppedAt: null },
    data: { stoppedAt: new Date() },
  });
  rideChanged(req.params.id);
  res.json({ success: true, data: { stopped: true } });
};

// POST /api/me/sos { rideId? } — logged for review; makes sure there's a live link to text to trusted contacts.
// Doesn't alert the rest of the group, since the threat may be in the cab.
const sos = async (req, res) => {
  const ride = typeof req.body?.rideId === 'string' ? await memberRide(req.body.rideId, req.user.id) : null;
  await prisma.safetyReport.create({ data: { userId: req.user.id, rideId: ride?.id ?? null, kind: 'SOS' } });
  const share = ride ? await ensureShare(ride, req.user.id) : null;
  console.warn(`SOS from user ${req.user.id}${ride ? ` on ride ${ride.id}` : ''}`);
  res.status(201).json({ success: true, data: { shareUrl: share ? shareUrl(req, share.token) : null } });
};

// GET /api/trip/:token — public, no sign-in: only what someone tracking the trip needs
const publicTrip = async (req, res) => {
  if (!TOKEN.test(req.params.token)) return refuse(res, 404, 'This link is not valid.');
  const share = await prisma.tripShare.findUnique({
    where: { token: req.params.token },
    select: {
      userId: true,
      rideId: true,
      expiresAt: true,
      stoppedAt: true,
      user: { select: { name: true } },
      ride: { select: { destinationName: true, cabNumber: true, endedAt: true } },
    },
  });
  if (!share) return refuse(res, 404, 'This link is not valid.');
  const active = !share.stoppedAt && !share.ride.endedAt && share.expiresAt > new Date();
  const position = active ? positionOf(share.rideId, share.userId) : null;
  res.json({
    success: true,
    data: {
      active,
      firstName: share.user.name,
      destinationName: share.ride.destinationName,
      cabNumber: share.ride.cabNumber,
      position,
    },
  });
};

// GET /trip/:token — the page the link opens in any browser; polls /api/trip/:token
const tripPage = (req, res) => {
  if (!TOKEN.test(req.params.token)) return res.status(404).type('text').send('This link is not valid.');
  const token = JSON.stringify(req.params.token);
  res.type('html').send(`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>HopShare live trip</title>
<link href="https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.css" rel="stylesheet">
<style>
  html,body{margin:0;height:100%;font-family:system-ui,sans-serif;background:#F2F2EE;color:#111}
  #map{position:absolute;inset:0}
  .card{position:absolute;left:12px;right:12px;bottom:12px;background:#fff;border:1.5px solid #DEDED8;border-radius:12px;padding:14px 16px}
  .band{background:#FFCC00;border-radius:8px;padding:8px 12px;font-weight:700;margin-bottom:8px}
  .muted{color:#5B5B55;font-size:14px}
  .plate{display:inline-block;border:2px solid #111;border-radius:6px;padding:2px 10px;font-weight:800;letter-spacing:1px;margin-top:6px}
  .pin{width:22px;height:22px;border-radius:50%;background:#FFCC00;border:3px solid #111}
</style></head>
<body><div id="map"></div>
<div class="card"><div class="band" id="title">Loading…</div><div class="muted" id="detail"></div><div id="plate"></div></div>
<script src="https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.js"></script>
<script>
  const token = ${token};
  const map = new maplibregl.Map({ container: 'map', style: 'https://tiles.openfreemap.org/styles/positron', center: [78.96, 22.59], zoom: 3.6 });
  const el = document.createElement('div'); el.className = 'pin';
  const marker = new maplibregl.Marker({ element: el });
  let placed = false;
  const set = (id, text) => { document.getElementById(id).textContent = text; };
  async function tick() {
    try {
      const r = await fetch('/api/trip/' + encodeURIComponent(token));
      const j = await r.json();
      if (!j.success) { set('title', j.message); return; }
      const t = j.data;
      set('title', t.active ? (t.firstName || 'A rider') + ' is sharing their trip' : 'This trip has ended');
      set('detail', 'To ' + t.destinationName + (t.position ? ' · updated ' + Math.max(0, Math.round((Date.now() - t.position.at) / 1000)) + ' s ago' : t.active ? ' · waiting for location' : ''));
      document.getElementById('plate').innerHTML = '';
      if (t.cabNumber) { const p = document.createElement('div'); p.className = 'plate'; p.textContent = t.cabNumber; document.getElementById('plate').appendChild(p); }
      if (t.position) {
        marker.setLngLat([t.position.longitude, t.position.latitude]).addTo(map);
        if (!placed) { map.jumpTo({ center: [t.position.longitude, t.position.latitude], zoom: 14 }); placed = true; }
      }
      if (t.active) setTimeout(tick, 5000);
    } catch { setTimeout(tick, 10000); }
  }
  tick();
</script></body></html>`);
};

module.exports = { listContacts, addContact, removeContact, startShare, stopShare, sos, publicTrip, tripPage, activeShare };
