<p align="center">
  <img src="client/assets/images/icon.png" width="96" alt="HopShare logo" />
</p>

<h1 align="center">HopShare</h1>

<p align="center">Find verified people going your way, share one cab, split the fare.</p>

---

**Contents:** [What it is](#what-it-is) · [Status](#status) · [Tech stack](#tech-stack) · [System design](#system-design) · [1. Big picture](#1-big-picture) · [2. One ride end to end](#2-one-ride-end-to-end) · [3. App screens](#3-app-screens) · [4. Sign-in](#4-sign-in-and-tokens) · [5. Places](#5-places-and-maps) · [6. Matching](#6-matching) · [7. Joining](#7-joining-a-group) · [8. Real time and Redis](#8-real-time-socketio-and-redis) · [9. Booking](#9-booking-the-cab) · [10. Safety](#10-safety) · [11. Fare split](#11-fare-split-and-payback) · [12. Database](#12-database) · [13. Deployment](#13-deployment-cost-and-scale) · [14. Trade-offs](#14-trade-offs) · [Project layout](#project-layout) · [Running it locally](#running-it-locally)

## What it is

HopShare groups 2–4 people heading to the same place at the same time. They share one regular cab (Uber, Ola, Rapido or an auto), so each person pays up to 75% less.

One rider books the cab. HopShare opens Uber or Ola with the pickup and drop already filled in. The others pay that rider back their share over UPI. HopShare **never books the cab and never holds money**, which keeps it free to run and legally simple.

It's built for India and is open to anyone who commutes: students, office-goers, people heading to the airport. Version 1 is a portfolio project shipped as an Android APK, with outside services in sandbox mode.

### How it's different

Carpool apps like Hopr (Rapido), Quick Ride and sRide match **car owners** with passengers on their route. HopShare matches **riders without a car** with each other, so it works anywhere cabs run and needs no car owners.

That changes the hard problems:

- **Trust between strangers.** There's no driver in charge, so every rider is ID-verified (DigiLocker), and everyone shares their live location while meeting up.
- **Getting the booker paid back.** One person pays the whole fare. The app splits it evenly, sends each rider a UPI payment link, and shows the booker who has paid.

### Rules the product keeps

- **Value before verification:** anyone can browse groups; ID verification is asked for only when joining or starting one.
- **Privacy by default:** other riders see only first name, photo and badges. Never phone number, last name, address or regular routes.
- **No fake profiles:** every rider is ID-verified before their first shared ride, and the server (not the app) enforces it.
- **Not in v1:** in-app cab booking, a payment gateway, drivers, uneven (distance-based) splits, in-app chat.

## Status

Each part of the design below is marked **Built**, **Planned** (decided, not coded yet) or **Proposed** (a suggested design, not decided yet).

| Area | State |
|---|---|
| Sign-up and login with email + password (Clerk proves the email with a code) | Done |
| Own auth on the server: JWT access + refresh tokens | Done |
| Database schema and migrations (Prisma, PostGIS) | Done |
| Home screen: map, place search, live pickup location | Done |
| One-tap Uber / Ola booking with the route filled in | Done (not yet on a screen) |
| Matched groups screen, join requests, 1 km matching | Next |
| Google sign-in | Later |
| Live location, group updates (Socket.io, Redis) | Planned |
| DigiLocker verification, fare split and UPI payback | Planned |

## Tech stack

| Part | Built with |
|---|---|
| Mobile app | React Native (Expo), TypeScript, Expo Router |
| API | Node.js, Express |
| Database | PostgreSQL + PostGIS on Neon, Prisma |
| Sign-in | Email + password (bcrypt, our DB); Clerk proves the email with a code; our own JWT access + refresh tokens |
| Maps and places | MapLibre + OpenFreeMap tiles, Photon (OpenStreetMap) search |
| Real-time (planned) | Socket.io, Upstash Redis |
| ID verification (planned) | DigiLocker through an aggregator |
| Hosting (planned) | Render / Koyeb |

---

# System design

## 1. Big picture

```mermaid
flowchart TB
    subgraph Phone["Android app: Expo / React Native"]
        Screens[Screens<br/>Stack + Tabs]
        Auth[AuthContext<br/>tokens + refresh]
        Store[(AsyncStorage: access token,<br/>theme, recents<br/>Cookie store: refresh token)]
    end

    subgraph Ext["Outside services (free tiers)"]
        Clerk[Clerk<br/>email proof]
        Photon[Photon<br/>place search]
        Tiles[OpenFreeMap<br/>map tiles]
        CabApps[Uber / Ola apps<br/>deep links]
        UPI[UPI apps<br/>payment intent]
        DL[DigiLocker aggregator<br/>planned]
    end

    subgraph API["Server: Node + Express"]
        MW[requireUser<br/>checks our JWT]
        Routes[Routes → Controllers]
        Services[Services<br/>auth, user, ride, match, fare]
        Sock[Socket.io gateway<br/>planned]
    end

    PG[(Neon Postgres + PostGIS<br/>lasting data)]
    Redis[(Upstash Redis<br/>live locations, pub/sub<br/>planned)]

    Screens --> Auth
    Auth --- Store
    Screens --> Photon
    Screens --> Tiles
    Screens --> CabApps
    Screens --> UPI
    Screens --> Clerk
    Auth -- HTTPS + Bearer --> MW --> Routes --> Services
    Screens -. WebSocket .-> Sock -.-> Services
    Services --> PG
    Services -.-> Redis
    Services -- verify once at login --> Clerk
    Services -.-> DL
```

Solid lines are built; dotted lines are planned.

| Part | Job | State |
|---|---|---|
| Expo app | All screens, GPS, maps, opening cab and UPI apps | Built: sign-in, profile setup, home map + search |
| Express API | Auth, profile, rides, matching, join requests, fares | Built: auth + `/api/me` |
| Socket.io | Group updates and live location in real time | Planned |
| Postgres + PostGIS (Neon) | Users, rides, join requests, payments; 1 km geo queries | Built (schema) |
| Redis (Upstash) | Short-lived live locations, pub/sub between server instances | Planned |
| Clerk | Proves an email (code) or Google account at sign-up and reset. Nothing else | Built |
| Photon / OpenFreeMap | Place search, reverse geocoding, map tiles | Built (called from the app) |
| DigiLocker aggregator | ID verification before joining a group | Planned |

**Server layering:** `routes → controllers → services → Prisma`. Controllers only read the request and shape the response; all rules live in services, so socket handlers can reuse them. Every error is `{ "success": false, "message": "..." }`.

## 2. One ride end to end

```mermaid
sequenceDiagram
    autonumber
    actor A as Aryan (creator, booker)
    actor R as Riya (rider)
    participant App as HopShare app
    participant API as Server
    participant DB as Postgres
    participant RS as Redis

    A->>App: log in (email + password)
    App->>API: POST /api/auth/login
    A->>App: Where to? pickup, destination, leaving time
    App->>API: search groups near me
    API->>DB: ST_DWithin 1 km at both ends, ±15 min
    API-->>App: no match
    A->>App: Start my own group
    App->>API: create Ride (needs ID verified)

    R->>App: same route, 5 min later
    App->>API: search groups near me
    API-->>App: Aryan's group, ₹ per person, walk distance
    R->>App: Join (with her own pickup and drop)
    App->>API: create JoinRequest (PENDING)
    API-->>A: socket: new request
    A->>App: sees Riya's drop on the map, Accept
    API->>DB: JoinRequest ACCEPTED, Riya added to Ride
    API-->>R: socket: you're in

    A->>App: Book on Uber (route pre-filled)
    A->>App: Cab booked
    Note over A,RS: Meet-up window: live location
    App->>API: socket: my location (every few s)
    API->>RS: SET with TTL + publish to the group
    RS-->>API: fan out
    API-->>App: members' locations on the map
    A->>App: Picked up (sharing stops)
    A->>App: We've arrived, fare ₹248
    API->>DB: 2 Payments of ₹124 to Aryan
    R->>App: Pay via UPI
    A->>App: confirms Riya paid
```

The same journey as ride states:

```mermaid
stateDiagram-v2
    [*] --> open: creator starts a group
    open --> full_booked: 4 members, or booker taps Cab booked
    open --> [*]: no one joined by departure (proposed)
    full_booked --> picked_up: booker taps Picked up
    picked_up --> ended: We've arrived
    ended --> settled: booker confirms every payment
    settled --> [*]
```

- Each rider taps **I'm in the cab** at pickup. Anyone not checked in when the booker marks pickup (after about 5 minutes of waiting) is a **no-show**: left out of the split, given a reliability mark, and able to dispute it.
- A group that never fills can still ride with 2–3 people; the split adjusts.
- A user can be in only one active group at a time.

## 3. App screens

```mermaid
flowchart TD
    Start([Open app]) --> Signed{Signed in?}
    Signed -- no --> Welcome[Welcome<br/>3 slides: cost, safety, effort]
    Welcome --> SignIn[Log in: email + password<br/>Sign up: email → code → password]
    SignIn --> Name{Have a first name?}
    Signed -- yes --> Name
    Name -- no --> Setup[Profile setup<br/>What should riders call you?]
    Name -- yes --> Home
    Setup --> Home[Home: Where to?<br/>map, pickup, destination, leaving time]
    Home --> Groups[Matched groups<br/>planned]
    Groups --> Gate{ID verified?}
    Gate -- no --> Verify[DigiLocker verification<br/>planned]
    Verify --> Group
    Gate -- yes --> Group[Group screen<br/>live map, members, Book on Uber/Ola]
    Group --> Ride[In ride<br/>Share trip, SOS]
    Ride --> Fare[Fare split + UPI payback]
    Fare --> Feedback[Would you ride with them again?]
    Home --> Profile[Profile tab<br/>name, UPI ID, theme, sign out]
```

Navigation is kept simple: a root `Stack`, a `Tabs` bar (Home, Profile), and a `Stack` inside each tab. Built so far: Welcome, Sign in, Profile setup, Home.

## 4. Sign-in and tokens

**Built.** Passwords are ours: the server stores a bcrypt hash and checks it at login. Clerk is used like a small service for one job: proving someone owns an email (a 6-digit code) or a Google account. After any way in, HopShare issues its own two signed JWTs. Nothing about a sign-in is stored in the database.

Three ways in, one ending:

```mermaid
flowchart TD
    subgraph Signup["Sign up / Forgot password"]
        E1[Email] --> C1[Clerk emails a code] --> V1[Code entered,<br/>Clerk confirms it]
        V1 --> P1[Choose a password]
        P1 --> SP["POST /api/auth/set-password<br/>{ clerkToken, password }"]
    end
    subgraph Login["Log in"]
        E2[Email + password] --> L["POST /api/auth/login<br/>{ email, password }"]
    end
    subgraph Google["Google"]
        G[Google account,<br/>via Clerk] --> CL["POST /api/auth/clerk<br/>{ clerkToken }"]
    end
    SP --> H[Server: check Clerk token,<br/>find or create User,<br/>save bcrypt hash]
    L --> B[Server: find User by email,<br/>bcrypt.compare]
    CL --> F[Server: check Clerk token,<br/>find or create User]
    H --> T[Access token in the body<br/>+ refresh token cookie]
    B --> T
    F --> T
```

The same flow over time, from sign-up to a refresh:

```mermaid
sequenceDiagram
    autonumber
    participant App
    participant Clerk
    participant API as Server
    participant DB as Postgres

    App->>API: GET /api/auth/warmup (wake Neon while the user types)
    App->>Clerk: email, then 6-digit code
    Clerk-->>App: Clerk token (email proved)
    App->>API: POST /api/auth/set-password { clerkToken, password }
    API->>API: verify Clerk token with CLERK_JWT_KEY (no network call)
    API->>DB: find or create User, save bcrypt(password)
    API-->>App: accessToken (15 min) in the body<br/>refreshToken (30 days) as an httpOnly cookie
    App->>Clerk: sign out of Clerk

    Note over App,DB: Later logins don't touch Clerk
    App->>API: POST /api/auth/login { email, password }
    API->>DB: User by email
    API->>API: bcrypt.compare(password, passwordHash)
    API-->>App: accessToken + refresh cookie

    App->>API: requests with Bearer accessToken
    API->>API: check signature + type = access
    API->>DB: load User, refuse if suspended
    API-->>App: data

    App->>API: POST /api/auth/refresh (after a 401, cookie sent)
    API->>API: check signature + type = refresh
    API->>DB: user still ACTIVE?
    API-->>App: new accessToken + new refresh cookie
```

How a refresh token is checked:

```mermaid
flowchart LR
    R[Refresh cookie sent] --> S{Signed by us,<br/>not expired,<br/>type = refresh?}
    S -- no --> X[401 + clear cookie:<br/>sign in again]
    S -- yes --> U{User exists<br/>and ACTIVE?}
    U -- no --> X
    U -- yes --> N[New access token +<br/>new 30-day refresh cookie]
```

- **Access token:** JWT `{ sub: userId, type: "access" }`, 15 minutes, signed with `JWT_SECRET`. `requireUser` checks the signature, then loads the user and refuses suspended accounts.
- **Refresh token:** JWT `{ sub: userId, type: "refresh" }`, 30 days, same secret. The `type` claim stops one kind of token being used as the other. Each refresh gives a new one, so an active user's 30 days keep moving forward.
- **Where the tokens live:** the access token is kept in AsyncStorage and sent as `Authorization: Bearer <token>` on every request. The refresh token is never seen by app code: the server sets it as an `httpOnly` cookie (`Path=/api/auth`, `SameSite=Strict`, `Secure` in production, expiring with the token), and the phone's cookie store sends it back to `/api/auth/refresh` and `/api/auth/logout` by itself.
- **Logout:** clears the cookie, and the app forgets its access token. Because nothing is stored, the server can't cancel a token that was copied off the phone: it stays valid until it expires. Suspension still works, because every request and refresh checks the user's status.
- **Many devices:** each sign-in gets its own tokens, so several phones can be signed in at once. Listing or signing out other devices needs stored sessions, which are left for later.
- **App side:** on a 401 the app refreshes **once** (parallel requests share the same refresh), then retries.
- **Passwords:** at least 8 characters, at most 72 bytes (bcrypt only reads 72, so longer ones are refused rather than silently cut). Stored only as a bcrypt hash (10 rounds, salted) in `User.passwordHash`; never returned by the API.
- **Wrong email or wrong password** get the same answer, "Email or password is incorrect.", and take the same time (an unknown email is still checked against a dummy hash), so no one can learn which emails have accounts.
- **Forgot password** is the sign-up path again: a fresh email code proves the inbox, then the new password replaces the old hash. Accounts made before passwords existed set theirs this way once.
- **Google accounts** have no password (`passwordHash` stays empty) and sign in through Clerk each time.
- **After sign-up** the app asks only for a first name; the UPI ID is asked for only when someone becomes the booker.
- **Not yet:** a limit on login attempts. Worth adding before real users, since passwords can be guessed.

| Route | Does |
|---|---|
| `GET /api/auth/warmup` | Wakes the database when the sign-in screen opens |
| `POST /api/auth/login` | Email + password → our tokens |
| `POST /api/auth/set-password` | Clerk token (email proved by code) + new password → saves the hash, gives our tokens. Used for sign-up and forgot password |
| `POST /api/auth/clerk` | Clerk token from Google sign-in → our tokens |
| `POST /api/auth/refresh` | Gives a new token pair |
| `POST /api/auth/logout` | Clears the refresh cookie |
| `GET` / `PATCH /api/me` | Reads / updates your profile (first name) |

## 5. Places and maps

**Built.**

- Pickup defaults to GPS (`expo-location`), named with Photon reverse geocoding. The destination comes from Photon type-ahead, biased to the user's position.
- Map: MapLibre with OpenFreeMap tiles (free, no key), light and dark styles, pickup dot, drop pin, dashed route line.
- "Leaving": Now, or a time within the next 2 hours.
- The last 5 destinations are kept on the phone (AsyncStorage), since commutes repeat.
- **Planned:** move Photon behind `/api/places` so the app doesn't depend on a third-party URL and results can be cached.

## 6. Matching

**Planned.** A group matches when **both** ends are close and the time fits:

- the group's pickup is within **1 km** of my pickup,
- the group's destination is within **1 km** of my destination,
- it leaves within **±15 minutes** of my leaving time, is still `joinable`, and has fewer than 4 members.

```mermaid
flowchart LR
    In[My pickup, destination,<br/>leaving time] --> T{Leaves within<br/>±15 min?}
    T -- yes --> P{Pickup within<br/>1 km?}
    P -- yes --> D{Destination<br/>within 1 km?}
    D -- yes --> J{Joinable and<br/>under 4 members?}
    J -- yes --> Out[Show it:<br/>soonest first, then shortest walk]
    T -- no --> Skip[Skip]
    P -- no --> Skip
    D -- no --> Skip
    J -- no --> Skip
```

```sql
SELECT r.id, r."sourceName", r."destinationName", r.time,
       ST_Distance(r.source, ST_MakePoint($pickLon, $pickLat)::geography) AS walk_m
FROM "Ride" r
WHERE r.joinable
  AND r.time BETWEEN $leaving - interval '15 min' AND $leaving + interval '15 min'
  AND ST_DWithin(r.source,      ST_MakePoint($pickLon, $pickLat)::geography, 1000)
  AND ST_DWithin(r.destination, ST_MakePoint($dropLon, $dropLat)::geography, 1000)
ORDER BY r.time, walk_m
LIMIT 20;
```

- Points are `geography(Point, 4326)`, always `[lon, lat]`, so distances come out in metres.
- `ST_DWithin` can use a **GIST index** on `source` and `destination`. The indexes are left out for now (tiny data); they're the first thing to add when matching gets slow.
- Each card shows destination, estimated cost per person, walk distance, departure time, members ("2 of 4") and badges. If nothing fits: **Start my own group**.

## 7. Joining a group

**Planned (table built).**

```mermaid
stateDiagram-v2
    [*] --> PENDING: rider taps Join
    PENDING --> ACCEPTED: creator accepts
    PENDING --> REJECTED: creator rejects
    PENDING --> CANCELLED: withdrawn, or another request won
    ACCEPTED --> [*]: rider added to Ride.users
    REJECTED --> [*]
    CANCELLED --> [*]
```

- The request stores the rider's **own** pickup and drop, so the creator can see on a map whether the detour makes sense before accepting.
- Accept runs in one transaction: check the ride is still joinable and has room, mark the request `ACCEPTED`, add the member, set `joinable = false` at 4.
- **Proposed:** a rider may have several pending requests; the first accept wins and the others become `CANCELLED`.

## 8. Real time: Socket.io and Redis

**Planned.** The socket handshake sends the same access token as HTTP and goes through the same check as `requireUser`. Each member joins a room per ride, `ride:<rideId>`.

**Proposed events:**

| Event | From → to | When |
|---|---|---|
| `join-request:new` | server → creator | a rider asks to join |
| `join-request:answered` | server → rider | accepted / rejected |
| `ride:updated` | server → room | member joins/leaves, cab booked, picked up, ended |
| `location:update` | phone → server → room | every few seconds, meet-up window only |
| `payment:updated` | server → room | someone paid / booker confirmed |

### Why Redis

Postgres holds everything that must last: users, rides, join requests, payments. Live location while a group meets up is different:

- **It changes every few seconds and is useless a minute later.** Writing it into Postgres would mean constant writes to rows nobody reads again, and serverless Neon would never get to sleep.
- **It should disappear on its own.** Location isn't kept beyond the active ride. In Redis each position is stored with a TTL (e.g. `loc:<rideId>:<userId>`, 60 s), so it expires by itself.
- **Updates have to reach every server.** With more than one server instance, two members of the same group can be connected to different ones. Redis pub/sub (the Socket.io Redis adapter) passes each update to all instances.

```mermaid
flowchart LR
    A[Rider A's phone] -- location every few s --> S1[Server instance 1]
    B[Rider B's phone] --- S2[Server instance 2]
    S1 -- SET loc:ride:A EX 60 --> R[(Redis)]
    S1 -- publish ride room --> R
    R -- deliver to subscribers --> S2
    S2 -- socket emit --> B
    S1 -. ride state, payments .-> PG[(Postgres)]
```

Rule of thumb: if losing it on a restart doesn't matter and it expires within minutes, it goes in Redis. Everything else goes in Postgres.

**When location is shared:** from "group full / cab booked" until "picked up", for everyone in the group. After that, only a rider who taps **Share trip** or **SOS** keeps streaming. On the phone, incoming locations update the map markers without re-rendering the whole screen, because they arrive several times a second across a group.

## 9. Booking the cab

**Built, not yet on a screen.** Uber's and Ola's ride APIs are for partners only, so HopShare hands off instead:

```mermaid
flowchart LR
    B[Booker taps<br/>Book on Uber / Ola] --> L{App installed?}
    L -- yes --> App[uber://riderequest?...<br/>olacabs://app/launch?...]
    L -- no --> Web[m.uber.com / book.olacabs.com]
    App --> Book[Books in the cab app]
    Web --> Book
    Book --> Back[Back in HopShare:<br/>Cab booked + cab number,<br/>trip-share link]
```

Rapido has no public deep link; the plan is an "Open Rapido" button plus a copy button for the destination.

## 10. Safety

**Planned.**

```mermaid
flowchart LR
    J[Join or start a group] --> V{ID verified?}
    V -- no --> C[DigiLocker consent<br/>via aggregator] --> S[Selfie, optional] --> OK[✓ ID verified]
    V -- yes --> G[Group]
    OK --> G
    G --> Ride[In ride]
    Ride --> Share[Share trip:<br/>public live link, expires at ride end]
    Ride --> SOS[SOS: hold 3 s]
    SOS --> Call[Call 112]
    SOS --> SMS[SMS app opened with<br/>trusted contacts + live link]
    SOS --> Flag[Ride flagged for review]
```

- **Verification:** HopShare keeps only name, date of birth (18+ check) and a verified flag, never the Aadhaar number, address or documents. Badges: **✓ ID verified** (required) and **✓ Photo verified** (optional selfie match).
- **SOS** does **not** alert the rest of the group, since the threat may be in the cab. Automatic server-sent SMS needs a paid provider, so v1 opens the SMS app for the user to send.
- **Moderation:** SOS flags, reports, disputed no-shows and unpaid rides go to a moderation table. No admin UI in v1; a protected admin endpoint can suspend a user, and suspended users can't sign in.
- **Feedback** after a ride: "Would you ride with them again?" 👍 / 👎 plus tags (On time, Paid quickly, Friendly). No star ratings. Shown on profiles only after 5 rated rides.

## 11. Fare split and payback

**Planned.**

```mermaid
flowchart LR
    F[Booker enters fare] --> S[Split evenly among<br/>people who rode]
    S --> P[One Payment row per rider<br/>from → booker, PENDING]
    P --> U[Rider: Pay via UPI<br/>upi://pay?pa=...&am=...]
    U --> C[Booker confirms<br/>Payment PAID]
    C --> D{All paid?}
    D -- yes --> Done[Ride settled]
    D -- no --> Rem[Reminder after a few hours]
```

- Even split, no-shows left out. Amounts are worked out in paise (integers) to avoid rounding errors. **Proposed:** any leftover paise stay with the booker.
- HopShare never moves money: the UPI intent opens the rider's own UPI app with the booker's UPI ID and amount. A copyable UPI ID and QR code are the fallback, since some UPI apps block these links. If the UPI app reports success, the row shows "probably paid"; the **booker's confirmation** is the truth.
- The booker must have a UPI ID on their profile. Payments sit behind one service, so a gateway (e.g. Razorpay) could be added later without changing screens.

## 12. Database

Postgres + PostGIS on Neon, managed with Prisma (`server/prisma/schema.prisma`). Points are `geography(Point, 4326)`, written `ST_MakePoint(lon, lat)`.

```mermaid
erDiagram
    User ||--o{ Ride : "creates"
    User }o--o{ Ride : "rides in (RideUsers)"
    User ||--o{ JoinRequest : "asks to join"
    Ride ||--o{ JoinRequest : "receives"
    Ride ||--o| Chat : "has"
    User }o--o{ Chat : "member of"
    Chat ||--o{ Message : "holds"
    User ||--o{ Message : "sends"
    Ride ||--o{ Payment : "settled by"
    Chat ||--o{ Payment : "shown in"
    User ||--o{ Payment : "pays (from)"
    User ||--o{ Payment : "is paid (to)"

    User {
        uuid id PK
        string clerkId UK "links to Clerk, used only at login"
        string name "first name, optional"
        string email UK
        enum status "ACTIVE | SUSPENDED"
        string phoneNumber UK
        string upiId "asked for only when booking"
        string passwordHash "bcrypt; empty for Google-only accounts"
    }


    Ride {
        uuid id PK
        uuid rideCreatorId FK
        geography source "Point [lon, lat]"
        string sourceName
        geography destination "Point [lon, lat]"
        string destinationName
        datetime time "departure"
        boolean joinable
        enum paymentStatus "PENDING | PAID"
    }

    JoinRequest {
        uuid id PK
        uuid rideId FK
        uuid userId FK
        enum status "PENDING | ACCEPTED | REJECTED | CANCELLED"
        geography pickup "requester's own stop"
        string pickupName
        geography destination "requester's own drop"
        string destinationName
        datetime createdAt
        datetime respondedAt
    }

    Chat {
        uuid id PK
        uuid rideId FK, UK
    }

    Message {
        uuid id PK
        uuid chatId FK
        uuid senderId FK
        string content
        datetime createdAt
        datetime updatedAt
    }

    Payment {
        uuid id PK
        uuid rideId FK
        uuid chatId FK
        uuid fromId FK "rider"
        uuid toId FK "booker"
        decimal amount
        enum status "PENDING | PAID"
    }
```

| Parent deleted | Children deleted with it |
|---|---|
| `Ride` | `Chat`, `Payment`, `JoinRequest` |
| `Chat` | `Message`, `Payment` |

| Migration | What it did |
|---|---|
| `20261102180616_init` | First tables |
| `20261103074653_default_table_names_text_ids` | Prisma default table names, text ids |
| `20261104090000_clerk_id_camel_case_columns` | `User.clerkId`, dropped password, camelCase columns |
| `20261106090000_ride_place_names` | `Ride.sourceName`, `destinationName` |
| `20261106120000_join_requests` | `JoinRequest` table and status enum |
| `20261107090000_sessions` | `Session` table for our own auth |
| `20261120090000_drop_sessions` | Dropped `Session`: refresh tokens are stateless JWTs for now |
| `20261120120000_user_password_hash` | `User.passwordHash` for email + password login |

Not in the schema yet: GIST indexes on ride points, ID verification fields, feedback, trusted contacts, moderation cases. `Chat` and `Message` exist from the first draft, but in-app chat is out of scope for v1.

## 13. Deployment, cost and scale

| Piece | Where | Cost |
|---|---|---|
| App | Android APK (Expo development build) | Free |
| API + sockets | Render / Koyeb free tier | Free |
| Postgres + PostGIS | Neon serverless | Free tier |
| Redis | Upstash serverless | Free tier |
| Auth, maps, search | Clerk, OpenFreeMap, Photon | Free |

Free tiers sleep when idle, so the server and Neon may need a few seconds to wake. The warmup call on the sign-in screen hides that wait.

If it grew:

1. Add GIST indexes on ride points, so matching stays fast.
2. Run more than one server instance: possible because auth is stateless JWT and sockets share state through Redis.
3. Run our own Photon, or cache searches behind `/api/places`.

## 14. Trade-offs

| Decision | Why | Cost of it |
|---|---|---|
| Hand off to Uber/Ola instead of booking | No partner API access; no liability | Can't read trip status; booker taps "Cab booked" |
| UPI links instead of a payment gateway | Free, no KYC, never hold others' money | Payment isn't guaranteed; booker confirms |
| Own passwords and tokens; Clerk only proves the email | Login doesn't depend on Clerk; full control over accounts and suspension | We own password security: hashing, generic errors, and (still to add) attempt limits |
| Stateless JWT refresh tokens (no session table) | Nothing to store or clean up; many devices just work | Logout can't cancel a copied token; no device list or sign-out-everywhere |
| Email code instead of phone OTP | Free (SMS to +91 numbers costs money) | Phone number isn't verified |
| Redis for live location | Fast, auto-expiring, works across servers | One more service to run |
| Even split only | Simple and easy to trust | Unfair if someone gets off much earlier |
| PostGIS on both ends of the ride | One SQL query, real distances in metres | Needs `[lon, lat]` discipline and indexes later |

---

## Project layout

```
client/   Expo app: screens in src/app (Stack + Tabs), components, context, hooks, services
server/   Express API: src/{config,controllers,middleware,routes,services}, prisma/ schema and migrations
docs/     schema/ first schema draft (image)
```

## Running it locally

You need Node.js 22+, a PostgreSQL database with PostGIS (a free Neon project works), and a Clerk application.

**Server**

```bash
cd server
cp .env.example .env      # fill in DATABASE_URL, JWT_SECRET, CLERK_SECRET_KEY, CLERK_JWT_KEY
npm install
npm run migrate           # applies the Prisma migrations
npm run dev               # http://localhost:4000
```

**App**

```bash
cd client
cp .env.example .env      # fill in EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
npm install
npm run android           # or: npm run ios
```

While developing, leave `EXPO_PUBLIC_API_URL` empty: the app calls the computer running Metro on port 4000. Set it only for a deployed server.

The server won't start without `DATABASE_URL`, `JWT_SECRET` and `CLERK_SECRET_KEY`. `CLERK_JWT_KEY` (from the Clerk dashboard) lets the server check Clerk tokens without a network call.

The app uses native modules, so it runs as a development build (`npm run android` / `npm run ios`). It doesn't run in Expo Go.
