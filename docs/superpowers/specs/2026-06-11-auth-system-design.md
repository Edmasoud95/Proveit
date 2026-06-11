# Authentication System & API Key Protection — Design

**Date:** 2026-06-11
**Status:** Approved by user (brainstorming session)

## Context

Proveit currently has no authentication: every API endpoint is reachable by any
HTTP client, and LLM provider API keys are stored as plaintext in SQLite
(`LlmConnection.apiKey`). Keys are never returned in API responses
(`LlmService.toProvider()` strips them), but they are accepted in plaintext
request bodies and readable by anyone with the DB file.

**Deployment target:** a single team instance — several teammates log in with
separate accounts on a shared server.

**Data scope decision:** POCs are per-user (owners only); global LLM providers
and their API keys are shared team-wide (admin-managed).

**Account model:** no open signup. The first user is created via a first-run
setup flow and becomes admin. Admins create accounts for teammates, reset
passwords, deactivate users, and manage shared global providers.

**Approach chosen:** DB-backed cookie sessions built on Node's built-in
`crypto` — zero new runtime dependencies (per the project's minimal-deps
constitution). JWT/Passport was rejected (adds deps; revocation is awkward;
`EventSource` SSE cannot send Authorization headers so a cookie is required
anyway). Reverse-proxy auth was rejected (cannot express per-user ownership or
in-app admin role; does nothing for keys at rest).

## 1. Data model (Prisma)

```prisma
model User {
  id           String      @id @default(uuid())
  username     String      @unique
  passwordHash String      // format: scrypt$N$r$p$<saltB64>$<hashB64>
  role         String      @default("member") // "admin" | "member"
  isActive     Boolean     @default(true)
  createdAt    DateTime    @default(now())
  sessions     Session[]
  pocConfigs   PocConfig[]
}

model Session {
  id        String   @id @default(uuid())
  tokenHash String   @unique // sha256 hex of the raw cookie token
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

Changes to existing models:

- `PocConfig.ownerId String?` + relation to `User`. Nullable so the migration
  applies to existing rows; backfilled to the first admin during first-run
  setup. All POC queries scope by `ownerId`.
- `LlmConnection.apiKeyHint String?` — last 4 characters of the key, set at
  write time, used only for display (`••••1234`).

## 2. Auth mechanics (backend, zero new dependencies)

### Passwords
- `crypto.scrypt`, N=2^17, r=8, p=1, 16-byte random salt, 32-byte derived key.
- Stored as `scrypt$131072$8$1$<saltB64>$<hashB64>` — parameters live in the
  string so they can be raised later; verification reads them from the hash.
- Comparison via `crypto.timingSafeEqual`.

### Sessions
- 32-byte random token (`crypto.randomBytes`), sent as cookie
  `proveit_session`, attributes `HttpOnly; SameSite=Lax; Path=/` and `Secure`
  when `COOKIE_SECURE=true` (deploys behind HTTPS).
- DB stores only the SHA-256 of the token — a leaked DB cannot forge sessions.
- 7-day expiry, sliding: `expiresAt` is pushed forward when a request arrives
  with less than 6 days remaining (avoids a write per request).
- Cookie header parsed manually (tiny helper); no `cookie-parser` dependency.
- Logout deletes the session row and clears the cookie. Expired sessions are
  pruned opportunistically on login.

### Guard
- Global `APP_GUARD` (`AuthGuard`): every route requires a valid session by
  default. Attaches `request.user = { id, username, role }`.
- `@Public()` decorator exempts exactly: `POST /api/auth/login`,
  `POST /api/auth/setup`, `GET /api/auth/setup-status`.
- `@AdminOnly()` decorator (checked by the same guard) gates user management
  and global-provider write endpoints.
- SSE endpoints need nothing special: `EventSource` sends cookies on
  same-origin requests, so the guard applies uniformly.
- Deactivated users (`isActive: false`) fail the guard with 403 even with a
  live session; deactivation and password reset also delete the user's
  sessions immediately.

### Login throttling
- In-memory map: 5 failed attempts per username per 15 minutes → 429.
- Login failures return a uniform "Invalid credentials" message (no username
  enumeration). In-memory is acceptable for a single-process team instance.

### CSRF
- `SameSite=Lax` cookie + existing CORS lock (localhost origin regex; extend
  with `ALLOWED_ORIGIN` env var for the deployed origin) + JSON content type.
  No separate CSRF token.

## 3. Endpoints

```
GET    /api/auth/setup-status        public  → { needsSetup: boolean }
POST   /api/auth/setup               public  → create first admin; 403 once any user exists
POST   /api/auth/login               public  → { username, password }; sets cookie
POST   /api/auth/logout              session → deletes session, clears cookie
GET    /api/auth/me                  session → { id, username, role }
GET    /api/auth/users               admin   → list users (no hashes)
POST   /api/auth/users               admin   → { username, password, role }
PATCH  /api/auth/users/:id           admin   → role / isActive / password reset
DELETE /api/auth/users/:id           admin   → delete user; 409 if the user still
                                               owns POCs (deactivate instead, or
                                               delete the POCs first)
```

Validation via existing `class-validator` DTOs (username: 3–32 chars,
`[a-zA-Z0-9_-]`; password: min 10 chars). Admin cannot deactivate or demote
themselves if they are the last active admin.

## 4. API key protection

### Encryption at rest
- New `CryptoService` (backend `crypto/` module): AES-256-GCM.
- Master key: `PROVEIT_SECRET` env var, 64 hex chars (32 bytes). Backend
  **fails fast at boot** if missing/malformed, with a message showing how to
  generate one (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
- Stored format: `enc:v1:<ivB64>:<tagB64>:<ciphertextB64>`; fresh random
  12-byte IV per encryption. The `v1` tag allows future rotation/format
  changes.

### Usage
- Encrypt in `LlmService` wherever `apiKey` is written (create/update provider,
  global provider, legacy upsert, scaffold flow); set `apiKeyHint` at the same
  time.
- Decrypt only inside a single `LlmService` helper used at the moment an
  OpenAI client is constructed (`getClient` call sites: resolveForTask, test,
  models, scaffold). Decrypted keys never leave the service layer.
- API responses: continue stripping `apiKey`; add `hasApiKey: boolean` and
  `apiKeyHint` to `LlmProvider`. Updating a provider with no `apiKey` field
  keeps the stored key (existing behavior, preserved).

### Migration of existing plaintext keys
- Startup pass (idempotent, in `OnModuleInit`): any `LlmConnection.apiKey` not
  starting with `enc:v1:` is encrypted in place and its hint backfilled.

## 5. Ownership scoping

- `PocService` queries gain `where: { ownerId: user.id }`; create sets
  `ownerId` from the session user.
- Every `:pocId`-scoped route (evals, chat, LLM providers, config versions,
  export) verifies POC ownership first and returns **404** (not 403) when the
  POC is missing or owned by someone else — no existence leak. Implemented
  once as a small `assertPocOwnership(pocId, userId)` helper in `PocService`,
  called by the services that take `pocId`.
- Scaffold jobs (in-memory job map + SSE stream) carry the creating user's id;
  the stream and completion endpoints check it.
- Global providers (`pocConfigId: null`): readable by any authenticated user,
  writable (create/update/delete/test/set-default) by admins only.
- Admins do **not** see other users' POCs; the admin role only governs users
  and global providers.

## 6. Frontend

- `services/api.ts`: on 401, redirect to `/login` (except when already there).
  Cookies are same-origin, so no token handling in JS at all.
- New `AuthProvider` (React Query around `GET /api/auth/me`) wrapping the
  router. Unauthenticated → render `/login`; `needsSetup` → render `/setup`.
- New pages: `Login` (username/password), `Setup` (first-run admin creation,
  shown only when `setup-status.needsSetup`), `Users` admin panel (under
  Global Settings; visible to admins only).
- Header: current username + logout button.
- `LlmConnect` / `GlobalSettings`: saved keys display as `••••{hint}` with
  "leave blank to keep current key"; global-provider mutations hidden for
  non-admins.
- Follows existing conventions: hand-crafted Tailwind components, React Query
  for server state, no new packages.

## 7. Error handling

| Code | Meaning |
|------|---------|
| 401  | No/invalid/expired session → frontend redirects to login |
| 403  | Authenticated but forbidden (non-admin on admin route, deactivated user, setup after users exist) |
| 404  | Resource missing **or owned by someone else** |
| 429  | Login throttle tripped |

Login failure messages are uniform; boot fails loudly on missing
`PROVEIT_SECRET`.

## 8. Testing

Backend (existing Jest setup):

- `CryptoService`: encrypt/decrypt round-trip, tamper detection (GCM tag),
  wrong-key failure, format validation.
- Password hashing: hash/verify, reject wrong password, parameters parsed from
  hash string.
- `AuthGuard`: public routes pass, protected routes 401 without session,
  admin routes 403 for members, deactivated user 403.
- Auth service: login sets session, logout revokes, throttling after 5
  failures, setup only when zero users.
- Ownership: user A cannot read/update/delete/run-evals-on user B's POC (404).
- Migration pass: plaintext keys become `enc:v1:` and hints are set;
  already-encrypted keys untouched.

Frontend: component tests for login form and auth redirect behavior (existing
Vitest setup).

## Out of scope (explicit)

- Email anything (resets are admin-performed), MFA, OAuth/SSO, audit logging,
  per-user rate limiting on LLM calls, external KMS. If `PROVEIT_SECRET` and
  the DB leak together, keys are decryptable — accepted trade-off for a
  self-hosted tool without a KMS.

## Operational notes

- New required env: `PROVEIT_SECRET` (generate per instance). Optional:
  `COOKIE_SECURE=true` behind HTTPS, `ALLOWED_ORIGIN` for the deployed
  frontend origin.
- `.env.example` gains both, with a placeholder forcing generation.
- First deploy: run migrations → boot → visit app → `/setup` creates the
  admin → existing POCs are backfilled to that admin → admin creates
  teammate accounts.
