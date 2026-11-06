<p align="center">
  <img src="client/assets/images/icon.png" width="96" alt="HopShare logo" />
</p>

<h1 align="center">HopShare</h1>

<p align="center">Find verified people going your way, share one cab, split the fare.</p>

---

## What it is

HopShare groups 2–4 people heading to the same place at the same time. They share one regular cab (Uber, Ola, Rapido or an auto), so each person pays up to 75% less.

One rider books the cab. HopShare opens Uber or Ola with the pickup and drop already filled in. The others pay that rider back their share over UPI.

It's built for India and is open to anyone who commutes: students, office-goers, people heading to the airport.

## How it's different

Carpool apps like Hopr (Rapido), Quick Ride and sRide match **car owners** with passengers on their route. HopShare matches **riders without a car** with each other, so it works anywhere cabs run and needs no car owners.

That changes the hard problems:

- **Trust between strangers.** There's no driver in charge, so every rider is ID-verified (DigiLocker), and everyone shares their live location while meeting up.
- **Getting the booker paid back.** One person pays the whole fare. The app splits it evenly, sends each rider a UPI payment link, and shows the booker who has paid.

## Status

| Area | State |
|---|---|
| Sign-in: email code and Google (Clerk) | Done |
| API that checks the Clerk session and creates users on first sign-in | Done |
| Database schema and migrations (Prisma, PostGIS) | Done |
| One-tap Uber / Ola booking with the route filled in | Done (not yet on a screen) |
| Place search and map | Next |
| 1 km matching and groups | Planned |
| Live location, group updates (Socket.io, Redis) | Planned |
| DigiLocker verification, fare split and UPI payback | Planned |

## Tech stack

| Part | Built with |
|---|---|
| Mobile app | React Native (Expo), TypeScript, Expo Router |
| API | Node.js, Express |
| Database | PostgreSQL + PostGIS on Neon, Prisma |
| Sign-in | Clerk (email code, Google) |
| Maps and places | OpenStreetMap |
| Real-time (planned) | Socket.io, Upstash Redis |
| Hosting (planned) | Render |

Version 1 ships as an Android APK.

## Project layout

```
client/   Expo app: screens in src/app (Stack + Tabs), components, hooks, services
server/   Express API: src/{config,controllers,middleware,routes,services}, prisma/ schema and migrations
docs/     Design spec and plans
```

## Running it locally

You need Node.js 22+, a PostgreSQL database with PostGIS (a free Neon project works), and a Clerk application.

**Server**

```bash
cd server
cp .env.example .env      # fill in DATABASE_URL, CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY
npm install
npm run migrate           # applies the Prisma migrations
npm run dev               # http://localhost:4000
```

**App**

```bash
cd client
cp .env.example .env      # fill in EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY and EXPO_PUBLIC_API_URL
npm install
npm run android           # or: npm run ios
```

On a phone, `EXPO_PUBLIC_API_URL` must be your computer's address on the local network, for example `http://192.168.1.20:4000`, not `localhost`.

The app uses native modules, so it runs as a development build (`npm run android` / `npm run ios`). It doesn't run in Expo Go.
