# HopShare - Project Guidelines & Claude Context

## 🚀 Overview
**HopShare** is a zero-cost, cross-platform mobile application designed to match anyone commuting on identical routes — students, office-goers, and everyday travelers — to share rides and split transit costs by up to 75%. 

- **Primary Goal:** Group up to 4 passengers within a 1km radius using real-time geospatial matching.
- **Latency Target:** Real-time location streaming with sub-150ms latency.

---

## 🛠 Tech Stack

- **Mobile Frontend:** React Native (Expo)
- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL with PostGIS extension (hosted on Neon serverless Postgres)
- **Caching & Pub/Sub:** Upstash Redis (Serverless)
- **Real-Time Communication:** WebSockets (`socket.io` / `socket.io-client`)
- **Maps & Geocoding:** OpenStreetMap (Nominatim API)
- **Authentication & Security:** Clerk (phone OTP / Google) + DigiLocker ID verification
- **Deployment & Hosting:** Render / Koyeb

---

## 🏗 Architecture & Key Modules

1. **Authentication Engine:**
   - Open to all users; Clerk handles sign-in (phone OTP / Google).
   - Express and the Socket.io handshake verify Clerk session tokens.
   - DigiLocker (via an aggregator) marks users ID-verified; enforced server-side.

2. **Geospatial & Proximity Engine:**
   - Uses PostgreSQL + PostGIS (`ST_DWithin`, `ST_MakePoint`) for spatial query matching within a 1km radius.
   - Integrates OpenStreetMap (Nominatim) for route geocoding and address resolution.

3. **Real-Time Streaming Engine:**
   - Uses Socket.io for bidirectional communication (passenger/driver location updates, ride requests).
   - Utilizes Upstash Redis for state management, pub/sub, and ephemeral background location tracking.

4. **Fare-Splitting Engine:**
   - Client/Server calculations to dynamically split 100% of mobile trip costs evenly among up to 4 riders.

---

## 💻 Coding & Code Style Standards

### JavaScript / Node.js (Backend)
- Use **ES6+ syntax** (`async/await`, destructuring, arrow functions).
- Structure Express apps modularly: `controllers/`, `routes/`, `services/`, `models/`, `middleware/`, `config/`.
- Handle all async routes with proper `try-catch` blocks or a central error-handling middleware.
- Keep socket event logic separated from standard HTTP REST controller logic.

### React Native / Expo (Frontend)
- Use **Functional Components** with React Hooks exclusively.
- Follow modular organization: `screens/`, `components/`, `navigation/`, `services/`, `hooks/`, `context/`.
- Optimize render cycles (use `useMemo`, `useCallback` where necessary for location streams).
- Handle location background permissions gracefully using Expo Location APIs.

### Database & Geospatial
- Express coordinate pairs cleanly: **Longitude first, Latitude second** `[lon, lat]` when dealing with PostGIS `ST_MakePoint(lon, lat)` and GeoJSON formats.
- Ensure proper indexing (GIST indexes on PostGIS geography columns).

---

## 🚦 Common Commands

> *Update these commands based on your package setup (npm/yarn/pnpm)*

### Frontend (Expo)
- `npm run start` — Start Expo dev server
- `npm run android` — Run on Android emulator
- `npm run ios` — Run on iOS simulator

### Backend (Express)
- `npm run dev` — Start Node backend in watch mode (`node --watch`)
- `npm start` — Run production server

---

## 📌 Development Rules & Instructions for Claude

- **Security First:** Never hardcode secrets, database URLs (Neon `DATABASE_URL`), or Clerk secret keys. Use `.env` references.
- **Clean Architecture:** Keep business logic outside of socket handler definitions; delegate to service files.
- **Error Handling:** Always return consistent JSON error formats from Express: `{ "success": false, "message": "..." }`.
- **Mobile Performance:** Minimize unnecessary re-renders when receiving high-frequency WebSocket location coordinates.
