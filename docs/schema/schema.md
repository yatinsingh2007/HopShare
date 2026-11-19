# HopShare database schema

Updated 2026-11-19. Source of truth: `server/prisma/schema.prisma`.
`2026-11-02-schema-draft-v3.png` is the first draft and is kept for history; it predates `clerkId`, place names,
`JoinRequest` and `Session`.

Postgres + PostGIS on Neon. Points are `geography(Point, 4326)`, always written `ST_MakePoint(lon, lat)`.

## Tables and relations

```mermaid
erDiagram
    User ||--o{ Session : "signs in on"
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
    }

    Session {
        uuid id PK "also the first half of the refresh token"
        uuid userId FK
        string tokenHash "SHA-256 of the refresh secret"
        datetime expiresAt "30 days, reset on each refresh"
        datetime revokedAt "set on logout or token reuse"
        datetime createdAt
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

## Join request lifecycle

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

`respondedAt` is set when the request leaves `PENDING`. Once accepted, the row keeps where that member gets on and off.

## Session lifecycle

```mermaid
stateDiagram-v2
    [*] --> Active: POST /api/auth/login
    Active --> Active: POST /api/auth/refresh (new secret)
    Active --> Revoked: logout / logout-all
    Active --> Revoked: old refresh token reused
    Active --> Expired: 30 days without a refresh
    Revoked --> [*]
    Expired --> [*]
```

One row per signed-in device. `requireUser` checks the session on every request, so revoking it signs the device out at once.

## Delete behaviour

| Parent deleted | Children |
|---|---|
| `User` | `Session` rows deleted (cascade) |
| `Ride` | `Chat`, `Payment`, `JoinRequest` deleted (cascade) |
| `Chat` | `Message`, `Payment` deleted (cascade) |

## Migrations

| Migration | What it did |
|---|---|
| `20261102180616_init` | First tables from the draft |
| `20261103074653_default_table_names_text_ids` | Prisma default table names, text ids |
| `20261104090000_clerk_id_camel_case_columns` | `User.clerkId`, dropped password, camelCase columns |
| `20261106090000_ride_place_names` | `Ride.sourceName`, `destinationName` |
| `20261106120000_join_requests` | `JoinRequest` table and status enum |
| `20261107090000_sessions` | `Session` table for our own auth |

## Not yet in the schema

- GIST indexes on `Ride.source` / `Ride.destination` (left out on purpose; add when 1 km matching needs speed).
- ID verification fields (DigiLocker), feedback, trusted contacts, moderation cases (spec 4.7, 4.11, 4.15).
