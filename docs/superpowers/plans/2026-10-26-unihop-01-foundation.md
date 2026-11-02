# UniHop Plan 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A user can install the Android APK, see the onboarding, sign up or log in with Clerk (phone OTP or Google), set their first name and UPI ID, and land on a placeholder Home screen in light or dark theme, backed by an Express API that is connected to Neon with PostGIS enabled.

**Architecture:** The Express server (`server/`, ESM JavaScript) exposes a `createApp({ getAuth, db })` factory so tests can inject a fake Clerk auth and a test database. Users are lazily upserted from their Clerk user id on the first authenticated request. The Expo client (`client/`, TypeScript, expo-router under `src/app`) wraps the app in `ClerkProvider` and a `ThemeProvider` built on named colour tokens, and splits routes into `(auth)` (signed out) and `(app)` (signed in) groups.

**Tech Stack:** Express 5, `pg`, `@clerk/express`, Node's built-in `node:test` + `supertest`. Expo SDK 58, expo-router, `@clerk/clerk-expo`, `expo-secure-store`, `jest-expo` + `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-10-26-unihop-app-design.md`

## Roadmap (one plan per part, each ends in a working app)

1. **Foundation** (this plan): server skeleton, Neon + PostGIS, Clerk auth, user profile basics, theme, onboarding, sign-in, profile setup.
2. **Verification:** DigiLocker aggregator sandbox, optional selfie, badges, server-enforced "verified to join/create" gate (spec §4.6–4.7).
3. **Matching & groups:** Home "Where to?" with Nominatim and the departure time, PostGIS matching, creating and joining groups, the matched groups list (spec §4.3–4.5).
4. **Real-time ride:** Socket.io + Redis, the group screen, live pickup map, ride stages and no-shows (spec §4.8, §4.8a).
5. **Safety:** Share trip web page, trusted contacts, background location, SOS (spec §4.9).
6. **Fare & reputation:** fare entry, even split, UPI pay plus fallback, booker confirmation, reminders, "would ride again" feedback, the public profile (spec §4.10–4.12, §4.14).
7. **Moderation & settings:** `moderation_cases`, suspend endpoint, the full own-profile/settings screen (spec §4.13, §4.15).

Each later plan is written when the previous one is merged.

## Global Constraints

- Express errors are always JSON: `{ "success": false, "message": "..." }`. Successes are `{ "success": true, "data": ... }`.
- No secrets in code; everything is read from `.env`. Server env: `DATABASE_URL`, `DATABASE_URL_TEST`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `PORT`. Client env: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `EXPO_PUBLIC_API_URL`.
- PostGIS points are always `[lon, lat]` / `ST_MakePoint(lon, lat)`, with a GIST index on geography columns.
- Clerk runs as a development instance; v1 is an Android APK only.
- Client colours come only from theme tokens; no hex values in screens or components.
- WCAG AA contrast; body text ≥ 14px, 12px only for secondary meta.
- Git: work on branch `feat/foundation`, open a PR to `main`. **Commit messages and PR bodies must not mention Claude or include Co-Authored-By/"Generated with" lines** (owner's standing rule).

## Review Focus

1. **Missing, expired or garbage `Authorization` header** → `401` JSON `{ success:false, message:"Unauthorized" }`, never an HTML page or a crash. *(Task 3 test)*
2. **Two first requests from a new user at the same time** → exactly one `users` row (upsert on `clerk_user_id`), with no unique-violation 500. *(Task 3 test)*
3. **UPI ID with surrounding spaces, no `@`, or empty** → trimmed, then `400` with a clear message if still invalid; an empty first name is rejected. *(Task 4 test)*
4. **Unknown route or malformed JSON body** → `404` / `400` in the standard JSON error shape. *(Task 1 test)*
5. **Phone switches dark/light while the user's preference is "System"** → the app re-themes live without a restart; an explicit Light/Dark override ignores the system setting. *(Task 5 test)*

---

## File Structure

```
server/
  package.json                (modify: "type":"module", scripts, deps)
  .gitignore                  (modify: add .env)
  .env.example                (create)
  app.js                      (replace: createApp factory)
  index.js                    (create: loads env, starts listening)
  config/env.js               (create: reads & validates env vars)
  config/db.js                (create: pg Pool factory)
  middleware/errorHandler.js  (create: 404 + error → JSON)
  middleware/requireUser.js   (create: Clerk auth → req.user)
  routes/health.js            (create)
  routes/me.js                (create)
  controllers/meController.js (create)
  services/userService.js     (create: upsert/get/update user)
  utils/validators.js         (create: isValidUpiId, normalizeName)
  db/migrate.js               (create: runs db/migrations/*.sql in order)
  db/migrations/001_init.sql  (create: postgis, pgcrypto, users)
  test/helpers.js             (create: test db + fake auth)
  test/*.test.js              (create)

client/
  package.json                (modify: deps, "test" script, jest config)
  .gitignore                  (modify: add .env)
  .env.example                (create)
  app.json                    (modify: name "UniHop", scheme "unihop", android package)
  src/theme/tokens.ts         (create)
  src/theme/ThemeProvider.tsx (create)
  src/services/tokenCache.ts  (create: expo-secure-store cache for Clerk)
  src/services/api.ts         (create: authed fetch wrapper)
  src/hooks/useMe.ts          (create)
  src/components/Button.tsx   (create)
  src/components/TextField.tsx(create)
  src/components/Screen.tsx   (create: themed safe-area container)
  src/app/_layout.tsx         (replace: providers + auth redirect)
  src/app/(auth)/_layout.tsx  (create)
  src/app/(auth)/welcome.tsx  (create: onboarding slides)
  src/app/(auth)/sign-in.tsx  (create: phone OTP + Google)
  src/app/(app)/_layout.tsx   (create: redirects to profile setup if no name/UPI)
  src/app/(app)/profile-setup.tsx (create)
  src/app/(app)/index.tsx     (create: placeholder Home)
  src/app/index.tsx           (delete)
  src/**/__tests__/*.test.tsx (create)

CLAUDE.md                     (modify: Clerk replaces hand-rolled JWT)
```

---

### Task 1: Server skeleton with JSON errors

**Files:**
- Modify: `server/package.json`, `server/.gitignore`, `CLAUDE.md`
- Create: `server/.env.example`, `server/app.js` (replace), `server/index.js`, `server/config/env.js`, `server/middleware/errorHandler.js`, `server/routes/health.js`
- Test: `server/test/app.test.js`

**Interfaces:**
- Produces: `createApp({ getAuth, db }) => express.Application` (default export of `server/app.js`; both deps optional in this task); `notFound(req,res)` and `errorHandler(err,req,res,next)` from `middleware/errorHandler.js`; `class HttpError extends Error { constructor(status: number, message: string) }`, also exported from `middleware/errorHandler.js`; `loadEnv() => { DATABASE_URL, CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY, PORT }`, which throws listing any missing names.

- [ ] **Step 1: Branch and tooling.** `git checkout -b feat/foundation`. In `server/package.json` set `"type": "module"`, `"main": "index.js"`, scripts `"dev": "node --env-file=.env --watch index.js"`, `"start": "node --env-file=.env index.js"`, `"test": "node --env-file-if-exists=.env --test"`, `"migrate": "node --env-file=.env db/migrate.js"`. `npm i pg @clerk/express` and `npm i -D supertest`. Remove `nodemon` (Node's `--watch` replaces it). Add `.env` to `server/.gitignore`. Create `.env.example` listing the server env names from Global Constraints with empty values.

- [ ] **Step 2: Write failing tests** in `server/test/app.test.js`:

```js
test('GET /api/health → 200 {success:true,data:{status:"ok"}}')
test('GET /api/nope → 404 {success:false,message:"Not found"}')
test('POST /api/health with body "{bad" and content-type json → 400, success:false, message:"Malformed JSON body"')
test('a route throwing HttpError(418,"teapot") → 418 {success:false,message:"teapot"}')  // mount a throwaway route on the app in the test
test('a route throwing a plain Error → 500 {success:false,message:"Internal server error"} and the error message is not leaked')
```

- [ ] **Step 3: Run** `cd server && npm test`. Expected: FAIL (createApp is not exported).

- [ ] **Step 4: Implement** `createApp`, which uses `express.json()`, mounts `/api/health`, then `notFound`, then `errorHandler`. `errorHandler` maps `err.type === 'entity.parse.failed'` → 400 "Malformed JSON body", `HttpError` → its status and message, anything else → 500 "Internal server error" (logs the error). `index.js` calls `loadEnv()` then `createApp(...).listen(PORT)`.

- [ ] **Step 5: Run** `npm test`. Expected: 5 passing.

- [ ] **Step 6: Update CLAUDE.md.** Replace "JWT (Email / Phone Verification)" with "Clerk (phone OTP / Google) + DigiLocker ID verification". Replace the Authentication Engine bullets with: Clerk handles sign-in; Express and the Socket.io handshake verify Clerk session tokens; DigiLocker (via aggregator) marks users ID-verified, enforced server-side. Change the backend commands to `npm run dev` (node --watch).

- [ ] **Step 7: Commit** `git add server CLAUDE.md && git commit -m "feat(server): app factory, health route, JSON error handling"`

---

### Task 2: Neon database, PostGIS and users table

**Files:**
- Create: `server/config/db.js`, `server/db/migrate.js`, `server/db/migrations/001_init.sql`, `server/test/helpers.js`
- Test: `server/test/db.test.js`

**Interfaces:**
- Consumes: Task 1 env loading.
- Produces: `createPool(connectionString: string) => pg.Pool`; `migrate(pool) => Promise<string[]>` (applies unapplied `NNN_*.sql` files in filename order inside a transaction each, tracked in a `schema_migrations(name text primary key, applied_at timestamptz default now())` table, and returns the names applied); test helpers `getTestDb() => Promise<pg.Pool>` (connects to `DATABASE_URL_TEST`, runs `migrate`, cached) and `resetTestDb(pool)` (`TRUNCATE users RESTART IDENTITY CASCADE`).
- `users` table (later plans add columns via new migrations):

| column | type |
|---|---|
| id | uuid pk default gen_random_uuid() |
| clerk_user_id | text not null unique |
| first_name | text |
| upi_id | text |
| photo_url | text |
| id_verified_at | timestamptz |
| photo_verified_at | timestamptz |
| suspended_at | timestamptz |
| created_at / updated_at | timestamptz not null default now() |

`001_init.sql` starts with `CREATE EXTENSION IF NOT EXISTS postgis;` and `CREATE EXTENSION IF NOT EXISTS pgcrypto;`.

- [ ] **Step 1: Manual prerequisite.** Create a Neon project with two branches, `main` and `test`. Put their connection strings in `server/.env` as `DATABASE_URL` and `DATABASE_URL_TEST`. (Only the human can do this; the implementer should stop and ask if `DATABASE_URL_TEST` is missing.)

- [ ] **Step 2: Write failing tests** in `server/test/db.test.js`:

```js
test('migrate applies 001_init once; a second run returns []')
test('PostGIS works: SELECT ST_AsText(ST_MakePoint(77.2090, 28.6139)) → "POINT(77.209 28.6139)"')
test('users.clerk_user_id is unique (second insert of "user_abc" rejects with code 23505)')
```

- [ ] **Step 3: Run** `npm test`. Expected: FAIL (helpers/migrate missing).

- [ ] **Step 4: Implement** `config/db.js`, `db/migrate.js` (also runnable as a CLI: `npm run migrate` migrates `DATABASE_URL` and prints the applied names), `001_init.sql` and `test/helpers.js`. Pass the pool into `createApp({ db })` from `index.js`.

- [ ] **Step 5: Run** `npm test` then `npm run migrate`. Expected: all tests pass; the CLI prints `001_init.sql` the first time and nothing the second time.

- [ ] **Step 6: Commit** `git add server && git commit -m "feat(server): Neon pool, SQL migrations, users table with PostGIS"`

---

### Task 3: Clerk auth and `GET /api/me`

**Files:**
- Create: `server/middleware/requireUser.js`, `server/services/userService.js`, `server/controllers/meController.js`, `server/routes/me.js`
- Modify: `server/app.js`, `server/index.js`
- Test: `server/test/me.test.js`

**Interfaces:**
- Consumes: `createApp`, `HttpError`, `getTestDb`, `resetTestDb`.
- Produces:
  - `createApp({ getAuth, db })`, where `getAuth(req) => { userId: string | null }`. In `index.js` it is wired to `@clerk/express`: the app uses `clerkMiddleware()` and passes `getAuth` from `@clerk/express`. In tests it is a fake that reads `req.headers['x-test-user']`.
  - `requireUser({ getAuth, db })` → middleware that sets `req.user` (a users row) or responds 401 "Unauthorized"; it responds 403 "Account suspended" if `suspended_at` is set.
  - `userService.upsertByClerkId(db, clerkUserId) => Promise<User>`, implemented as `INSERT … ON CONFLICT (clerk_user_id) DO UPDATE SET updated_at = users.updated_at RETURNING *`, so concurrent first calls are safe.
  - `toPublicMe(user) => { id, firstName, upiId, photoUrl, idVerified: boolean, photoVerified: boolean, profileComplete: boolean }`, where `profileComplete = !!firstName && !!upiId`.
  - `GET /api/me` → `{ success:true, data: toPublicMe(req.user) }`.
- Fake auth helper in `test/helpers.js`: `fakeGetAuth = req => ({ userId: req.headers['x-test-user'] ?? null })`.

- [ ] **Step 1: Write failing tests** in `server/test/me.test.js`:

```js
test('GET /api/me with no user → 401 {success:false,message:"Unauthorized"}')
test('GET /api/me as "user_1" for the first time → 200, creates a row, data.profileComplete === false, data.idVerified === false')
test('5 concurrent GET /api/me as "user_2" → all 200, exactly 1 users row for user_2')
test('GET /api/me for a suspended user → 403 {success:false,message:"Account suspended"}')
test('response never includes clerk_user_id')
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.

- [ ] **Step 3: Implement** the files above. Mount `/api/me` behind `requireUser`.

- [ ] **Step 4: Run** `npm test`. Expected: all pass.

- [ ] **Step 5: Manual smoke check.** Run `npm run dev`. `curl localhost:$PORT/api/me` should return a 401 JSON body.

- [ ] **Step 6: Commit** `"feat(server): Clerk-authenticated users with GET /api/me"`

---

### Task 4: `PATCH /api/me` (first name, UPI ID)

**Files:**
- Create: `server/utils/validators.js`
- Modify: `server/services/userService.js`, `server/controllers/meController.js`, `server/routes/me.js`
- Test: `server/test/validators.test.js`, `server/test/me.test.js`

**Interfaces:**
- Produces:
  - `isValidUpiId(s: string) => boolean`, using the regex `/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/`.
  - `normalizeName(s: string) => string | null`: trims, collapses internal whitespace, returns `null` if the result is empty or longer than 40 characters.
  - `userService.updateProfile(db, userId, { firstName?, upiId? }) => Promise<User>`.
  - `PATCH /api/me` body `{ firstName?: string, upiId?: string }` → `200 { success:true, data: toPublicMe }`. A missing field is left unchanged; a present but invalid field returns 400. Only `firstName` and `upiId` are accepted; unknown keys are ignored.

- [ ] **Step 1: Write failing tests:**

```js
// validators.test.js
test('isValidUpiId accepts "riya.s@okaxis", "9876543210@ybl", "aryan_01@paytm"')
test('isValidUpiId rejects "", "riya", "@ybl", "riya@", "ri ya@ybl", "riya@ybl@x"')
test('normalizeName("  Riya   Sharma ") === "Riya Sharma"; normalizeName("   ") === null; a 41-char name → null')
// me.test.js
test('PATCH {firstName:"  Riya ", upiId:" riya@okaxis "} → 200, data.firstName "Riya", data.upiId "riya@okaxis", profileComplete true')
test('PATCH {upiId:"riya"} → 400 {success:false,message:"Enter a valid UPI ID, like name@bank"}')
test('PATCH {firstName:"   "} → 400 {success:false,message:"First name can\'t be empty"}')
test('PATCH {idVerifiedAt:"2020-01-01"} does not change verification (data.idVerified stays false)')
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.

- [ ] **Step 3: Implement.** UPI IDs are trimmed before validation; the error messages are exactly those in the tests.

- [ ] **Step 4: Run** `npm test`. Expected: all pass.

- [ ] **Step 5: Commit** `"feat(server): update profile name and UPI ID with validation"`

---

### Task 5: Client theme tokens and provider

**Files:**
- Modify: `client/package.json` (add `"test": "jest"`, `"jest": { "preset": "jest-expo" }`; dev deps `jest-expo`, `jest`, `@testing-library/react-native`, installed with `npx expo install`)
- Create: `client/src/theme/tokens.ts`, `client/src/theme/ThemeProvider.tsx`
- Test: `client/src/theme/__tests__/ThemeProvider.test.tsx`

**Interfaces:**
- Produces:
  - `type ColorTokens = { bg, ink, muted, card, line, accent, accentInk, accentText, pill, field, danger, dangerInk: string }`.
  - `export const palettes: { light: ColorTokens; dark: ColorTokens }`.
  - `type ThemePreference = 'system' | 'light' | 'dark'`.
  - `<ThemeProvider>` stores the preference in `expo-secure-store` under key `unihop.themePreference` and defaults to `'system'`.
  - `useTheme() => { colors: ColorTokens; scheme: 'light'|'dark'; preference: ThemePreference; setPreference(p: ThemePreference): void }`.

Token values (from the mockups):

| token | dark | light |
|---|---|---|
| bg | `#0f1412` | `#f6f7f2` |
| ink | `#eef3ef` | `#121712` |
| muted | `#a8b4ac` | `#56625a` |
| card | `#161d19` | `#ffffff` |
| line | `#232c27` | `#e3e7de` |
| field | `#18201c` | `#ffffff` |
| accent | `#c6f36b` | `#c6f36b` |
| accentInk | `#10140f` | `#10140f` |
| accentText | `#c6f36b` | `#3d6b00` |
| pill | `#22301f` | `#eaf6d2` |
| danger | `#c4252b` | `#c4252b` |
| dangerInk | `#ffffff` | `#ffffff` |

- [ ] **Step 1: Write failing tests** (mock `useColorScheme` and `expo-secure-store`):

```tsx
test('preference "system" + system dark → colors.bg === "#0f1412"')
test('preference "system": system changes dark→light on rerender → colors.bg === "#f6f7f2" without remounting')
test('setPreference("dark") while system is light → scheme "dark", and SecureStore.setItemAsync called with ("unihop.themePreference","dark")')
test('light.accentText on light.bg has a contrast ratio ≥ 4.5 and dark.muted on dark.card ≥ 4.5')  // small contrast helper inside the test file
```

- [ ] **Step 2: Run** `cd client && npm test`. Expected: FAIL.

- [ ] **Step 3: Implement** using `useColorScheme()` from react-native, and memoise `colors`.

- [ ] **Step 4: Run** `npm test`. Expected: pass.

- [ ] **Step 5: Commit** `"feat(client): light/dark theme tokens and ThemeProvider"`

---

### Task 6: Clerk provider, API client and auth routing

**Files:**
- Modify: `client/app.json` (`name: "UniHop"`, `slug: "unihop"`, `scheme: "unihop"`, `android.package: "com.unihop.app"`), `client/.gitignore` (+ `.env`)
- Create: `client/.env.example`, `client/src/services/tokenCache.ts`, `client/src/services/api.ts`, `client/src/hooks/useMe.ts`, `client/src/app/(auth)/_layout.tsx`, `client/src/app/(app)/_layout.tsx`, `client/src/app/(app)/index.tsx`, `client/src/components/Screen.tsx`, `client/src/components/Button.tsx`, `client/src/components/TextField.tsx`
- Replace: `client/src/app/_layout.tsx`; delete `client/src/app/index.tsx`
- Test: `client/src/services/__tests__/api.test.ts`

**Interfaces:**
- Consumes: `ThemeProvider`, `useTheme`; server `GET/PATCH /api/me` (Tasks 3–4).
- Produces:
  - `tokenCache`, the Clerk token cache backed by `expo-secure-store`.
  - `class ApiError extends Error { status: number }`.
  - `apiFetch<T>(path: string, opts: { token: string | null; method?: string; body?: unknown }) => Promise<T>`. It prefixes `EXPO_PUBLIC_API_URL`, sets `Authorization: Bearer <token>`, returns `json.data` on `success:true`, and throws `ApiError(status, json.message)` otherwise. A network failure becomes `ApiError(0, "Can't reach UniHop. Check your connection.")`.
  - `useMe() => { me: PublicMe | null; loading: boolean; error: string | null; refresh(): Promise<void>; update(patch: { firstName?: string; upiId?: string }): Promise<void> }`, using Clerk's `useAuth().getToken()`.
  - `type PublicMe` mirrors the server's `toPublicMe`.
  - `<Screen>`, `<Button variant="primary"|"ghost" loading? disabled?>`, `<TextField label error?>`, all styled only from `useTheme().colors`.
- Routing: the root `_layout` wraps `ClerkProvider(publishableKey, tokenCache)` → `ThemeProvider` → `Slot`. `(auth)/_layout` redirects to `/(app)` when signed in. `(app)/_layout` redirects to `/(auth)/welcome` when signed out, and to `/(app)/profile-setup` when `me.profileComplete` is false.

- [ ] **Step 1: Install** with `npx expo install @clerk/clerk-expo expo-secure-store expo-auth-session expo-web-browser`. Use the current Clerk Expo package name per Clerk's docs if it has been renamed. Manual prerequisite: create a Clerk dev application with Phone (SMS OTP) and Google enabled, and put the key in `client/.env`.

- [ ] **Step 2: Write failing tests** in `api.test.ts` (mock `global.fetch`):

```ts
test('apiFetch returns json.data and sends "Authorization: Bearer tok"')
test('apiFetch throws ApiError(400,"Enter a valid UPI ID, like name@bank") on a {success:false} 400 response')
test('apiFetch maps a fetch rejection to ApiError(0,"Can\'t reach UniHop. Check your connection.")')
```

- [ ] **Step 3: Run** `npm test`. Expected: FAIL.

- [ ] **Step 4: Implement** the files listed. The placeholder `(app)/index.tsx` shows "Hi, {me.firstName}", a "Where to? — coming soon" card and a Sign out button.

- [ ] **Step 5: Run** `npm test`. Expected: pass. Then `npx tsc --noEmit`. Expected: no errors.

- [ ] **Step 6: Commit** `"feat(client): Clerk provider, API client, auth-gated routing"`

---

### Task 7: Onboarding and sign-in screens

**Files:**
- Create: `client/src/app/(auth)/welcome.tsx`, `client/src/app/(auth)/sign-in.tsx`
- Test: `client/src/app/(auth)/__tests__/welcome.test.tsx`, `client/src/app/(auth)/__tests__/sign-in.test.tsx`

**Interfaces:**
- Consumes: `Screen`, `Button`, `TextField`, `useTheme`; Clerk `useSignIn`, `useSignUp`, `useSSO` (Google).

**Exact copy (spec §4.1–4.2):**
- Slides, in order:
  1. "Same road. **Quarter** the fare." / "Someone near you is heading exactly where you are. Ride together, split it four ways."
  2. "Verified people. **Shared** live location." / "Everyone is ID-checked. Your trip is visible to people you trust."
  3. "You book the cab. **We** do the math." / "One person books, everyone pays them back over UPI."
  The bold word uses `colors.accentText`.
- Buttons: "Get started" and "I have an account". Both go to `sign-in`; "Get started" passes `?mode=signup`.
- Sign-in heading: "What's your number?". Helper: "We'll text a 6-digit code. Your number is never shown to other riders." Phone field prefixed "+91" (10 digits). Button "Send code". Then the OTP step: "Enter the 6-digit code", button "Verify". Secondary: "Continue with Google".

**Behaviour:** Phone flow: try `signIn` with `phone_code` first; if Clerk reports the identifier isn't found, fall back to `signUp` with the same number and `phone_code` verification, so one screen handles both. A 10-digit number is required before "Send code" is enabled. A wrong code shows "That code didn't match. Try again." under the field.

- [ ] **Step 1: Write failing tests:**

```tsx
// welcome.test.tsx
test('renders slide 1 headline and both buttons; swiping/advancing shows slide 2 and 3 copy')
// sign-in.test.tsx (mock Clerk hooks)
test('"Send code" is disabled for "98765" and enabled for "9876543210"')
test('submits "+919876543210" to signIn.create with strategy phone_code')
test('when signIn.create rejects with Clerk code "form_identifier_not_found", calls signUp.create with phoneNumber "+919876543210"')
test('a wrong OTP shows "That code didn\'t match. Try again."')
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.

- [ ] **Step 3: Implement** both screens. Slides use a horizontal paged `FlatList` with a dot indicator (active dot is wider and uses accent).

- [ ] **Step 4: Run** `npm test`. Expected: pass.

- [ ] **Step 5: Manual check on an Android device or emulator** (`npm run android`): sign up with a real +91 number (or "Continue with Google"), then land on profile setup. If Clerk won't send SMS to +91 numbers on the dev instance, stop and tell the owner. That's the spec §4.2 fallback decision (Google sign-in first, phone verified later), not something to work around silently. Check both themes by toggling the system dark mode.

- [ ] **Step 6: Commit** `"feat(client): onboarding slides and phone/Google sign-in"`

---

### Task 8: Profile setup screen

**Files:**
- Create: `client/src/app/(app)/profile-setup.tsx`
- Test: `client/src/app/(app)/__tests__/profile-setup.test.tsx`

**Interfaces:**
- Consumes: `useMe().update`, `Screen`, `Button`, `TextField`, `ApiError`.

**Copy:** heading "What should riders call you?". First-name field: label "First name", helper "Only your first name is shown to other riders." UPI field: label "Your UPI ID", placeholder "name@bank", helper "So riders can pay you back when you book the cab." Button "Continue".

- [ ] **Step 1: Write failing tests** (mock `useMe`):

```tsx
test('Continue is disabled until both fields are non-empty')
test('submits {firstName:"Riya", upiId:"riya@okaxis"} via update()')
test('server ApiError(400,"Enter a valid UPI ID, like name@bank") is shown under the UPI field')
test('on success navigates to "/(app)"')
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.

- [ ] **Step 3: Implement.** Server errors that mention UPI go under the UPI field; others show under the button.

- [ ] **Step 4: Run** `npm test` and `npx tsc --noEmit`. Expected: pass, no type errors.

- [ ] **Step 5: End-to-end manual check:** with the server running (`npm run dev`) and `EXPO_PUBLIC_API_URL` pointing at it (the machine's LAN IP for a physical device): fresh install → welcome → sign up → profile setup (an invalid UPI shows the error) → Home shows "Hi, Riya". Kill and reopen the app: it goes straight to Home. Sign out: back to welcome.

- [ ] **Step 6: Commit** `"feat(client): profile setup for first name and UPI ID"`

- [ ] **Step 7: Build the APK and open the PR.** `npx eas build -p android --profile preview` (or `npx expo run:android --variant release` locally) produces an installable APK. Push `feat/foundation` and open a PR to `main` titled "Foundation: server, auth, theme, onboarding", with a body summarising the tasks (no Claude attribution).
