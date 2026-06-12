# Authentication System & API Key Encryption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Team-instance authentication (cookie sessions, admin-managed accounts), per-user POC ownership, and AES-256-GCM encryption of stored LLM API keys — zero new runtime dependencies.

**Architecture:** A global NestJS `AuthGuard` (registered as `APP_GUARD`) validates an `HttpOnly` session cookie against a DB `Session` table on every request; `@Public()` exempts login/setup. Passwords use Node `crypto.scrypt`; API keys are encrypted at rest by a new `CryptoService` keyed from `PROVEIT_SECRET`. POC queries scope by `ownerId`. Frontend adds login/setup pages, an `AuthProvider`, and a 401 redirect in the API wrapper.

**Tech Stack:** NestJS 10, Prisma 5 (SQLite), Node built-in `crypto`, React 18 + TanStack Query 5 + Tailwind. Backend tests: vitest (already configured, `pnpm --filter backend test`).

**Spec:** `docs/superpowers/specs/2026-06-11-auth-system-design.md`

---

## File Structure

**Backend — create:**
- `src/crypto/crypto.service.ts` — AES-256-GCM encrypt/decrypt, secret validation
- `src/crypto/crypto.module.ts` — global module
- `src/crypto/crypto.service.spec.ts`
- `src/auth/password.ts` — scrypt hash/verify (pure functions)
- `src/auth/password.spec.ts`
- `src/auth/cookies.ts` — cookie header parse/build helpers (pure functions)
- `src/auth/decorators.ts` — `@Public()`, `@AdminOnly()`, `@CurrentUser()`
- `src/auth/auth.service.ts` — setup/login/logout/sessions/user CRUD/throttle
- `src/auth/auth.service.spec.ts`
- `src/auth/auth.guard.ts` — global guard
- `src/auth/auth.guard.spec.ts`
- `src/auth/auth.controller.ts` + `src/auth/dto/auth.dto.ts`
- `src/auth/auth.module.ts`
- `src/llm/key-migration.service.ts` — startup encrypt-in-place of plaintext keys
- `src/llm/key-migration.service.spec.ts`

**Backend — modify:**
- `prisma/schema.prisma` — `User`, `Session`, `PocConfig.ownerId`, `LlmConnection.apiKeyHint`
- `src/app.module.ts` — import `CryptoModule`, `AuthModule`
- `src/llm/llm.service.ts` — encrypt on write, decrypt on use, hint, `hasApiKey`
- `src/poc/poc.service.ts` — ownership scoping + `assertOwnership` + scaffold job user
- `src/poc/poc.controller.ts` — thread `@CurrentUser()`, decrypt scaffold provider key
- `src/eval/eval.controller.ts`, `src/chat/chat.controller.ts`, `src/llm/llm.controller.ts` — ownership assert on `:pocId` routes; `@AdminOnly()` on global-provider writes
- `.env.example` — `PROVEIT_SECRET`, `COOKIE_SECURE`, `ALLOWED_ORIGIN`
- `src/main.ts` — CORS origin from `ALLOWED_ORIGIN`

**Shared — modify:**
- `src/types.ts` — `AuthUser`, `LlmProvider.hasApiKey/apiKeyHint`

**Frontend — create:**
- `src/auth/AuthContext.tsx` — provider + `useAuth()`
- `src/pages/Login.tsx`, `src/pages/Setup.tsx`, `src/pages/Users.tsx`

**Frontend — modify:**
- `src/services/api.ts` — 401 redirect
- `src/App.tsx` — auth gate + new routes
- `src/components/ui/Header.tsx` — username/logout/admin link
- `src/pages/GlobalSettings.tsx`, `src/pages/LlmConnect.tsx` — key hint, admin gating

---

### Task 1: Prisma schema — User, Session, ownerId, apiKeyHint

**Files:** Modify `packages/backend/prisma/schema.prisma`

- [ ] **Step 1: Add models and columns**

Append to schema.prisma:

```prisma
model User {
  id           String      @id @default(uuid())
  username     String      @unique
  passwordHash String
  role         String      @default("member")
  isActive     Boolean     @default(true)
  createdAt    DateTime    @default(now())
  sessions     Session[]
  pocConfigs   PocConfig[]
}

model Session {
  id        String   @id @default(uuid())
  tokenHash String   @unique
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

In `PocConfig` add:
```prisma
  ownerId String?
  owner   User?   @relation(fields: [ownerId], references: [id])
```

In `LlmConnection` add:
```prisma
  apiKeyHint String?
```

- [ ] **Step 2: Migrate** — Run `cd packages/backend && pnpm exec prisma migrate dev --name auth`. Expected: new migration applied, client regenerated.
- [ ] **Step 3: Commit** — `git add -A prisma && git commit -m "feat(auth): add User/Session models, POC ownership, apiKeyHint"`

### Task 2: CryptoService (AES-256-GCM)

**Files:** Create `src/crypto/crypto.service.ts`, `src/crypto/crypto.module.ts`, `src/crypto/crypto.service.spec.ts`

- [ ] **Step 1: Failing tests** (`crypto.service.spec.ts`)

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { CryptoService } from './crypto.service';

const SECRET = 'a'.repeat(64);

describe('CryptoService', () => {
  let svc: CryptoService;
  beforeEach(() => { process.env.PROVEIT_SECRET = SECRET; svc = new CryptoService(); });

  it('round-trips plaintext', () => {
    const enc = svc.encrypt('sk-test-123');
    expect(enc.startsWith('enc:v1:')).toBe(true);
    expect(svc.decrypt(enc)).toBe('sk-test-123');
  });
  it('produces unique ciphertexts (random IV)', () => {
    expect(svc.encrypt('x')).not.toBe(svc.encrypt('x'));
  });
  it('detects tampering', () => {
    const enc = svc.encrypt('secret');
    const parts = enc.split(':');
    parts[4] = Buffer.from('tampered!').toString('base64');
    expect(() => svc.decrypt(parts.join(':'))).toThrow();
  });
  it('fails with wrong key', () => {
    const enc = svc.encrypt('secret');
    process.env.PROVEIT_SECRET = 'b'.repeat(64);
    expect(() => new CryptoService().decrypt(enc)).toThrow();
  });
  it('passes through non-encrypted values on decrypt', () => {
    expect(svc.decrypt('plain-key')).toBe('plain-key');
  });
  it('isEncrypted detects format', () => {
    expect(svc.isEncrypted(svc.encrypt('x'))).toBe(true);
    expect(svc.isEncrypted('plain')).toBe(false);
    expect(svc.isEncrypted(null)).toBe(false);
  });
  it('rejects missing/malformed secret at construction', () => {
    delete process.env.PROVEIT_SECRET;
    expect(() => new CryptoService()).toThrow(/PROVEIT_SECRET/);
    process.env.PROVEIT_SECRET = 'tooshort';
    expect(() => new CryptoService()).toThrow(/PROVEIT_SECRET/);
  });
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter backend exec vitest run src/crypto` → module-not-found.
- [ ] **Step 3: Implement**

`crypto.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const PREFIX = 'enc:v1:';

@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor() {
    const secret = process.env.PROVEIT_SECRET;
    if (!secret || !/^[0-9a-fA-F]{64}$/.test(secret)) {
      throw new Error(
        'PROVEIT_SECRET must be set to 64 hex characters (32 bytes). Generate one with:\n' +
        '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
      );
    }
    this.key = Buffer.from(secret, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
  }

  /** Decrypts enc:v1 values; passes through anything else (legacy plaintext). */
  decrypt(stored: string): string {
    if (!this.isEncrypted(stored)) return stored;
    const [ivB64, tagB64, ctB64] = stored.slice(PREFIX.length).split(':');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(ctB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  isEncrypted(value: string | null | undefined): boolean {
    return !!value && value.startsWith(PREFIX);
  }
}
```

`crypto.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';

@Global()
@Module({ providers: [CryptoService], exports: [CryptoService] })
export class CryptoModule {}
```

- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit** — `feat(auth): CryptoService with AES-256-GCM for secrets at rest`

### Task 3: Password hashing (scrypt)

**Files:** Create `src/auth/password.ts`, `src/auth/password.spec.ts`

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('hashes and verifies', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash.startsWith('scrypt$131072$8$1$')).toBe(true);
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
  });
  it('rejects wrong password', async () => {
    const hash = await hashPassword('right');
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
  it('produces unique hashes (random salt)', async () => {
    expect(await hashPassword('x')).not.toBe(await hashPassword('x'));
  });
  it('verifies using params embedded in the hash string', async () => {
    // hand-built hash with lighter params still verifies
    const { scryptSync, randomBytes } = await import('crypto');
    const salt = randomBytes(16);
    const dk = scryptSync('pw', salt, 32, { N: 16384, r: 8, p: 1 });
    const stored = `scrypt$16384$8$1$${salt.toString('base64')}$${dk.toString('base64')}`;
    expect(await verifyPassword('pw', stored)).toBe(true);
  });
  it('returns false on malformed stored hash', async () => {
    expect(await verifyPassword('pw', 'garbage')).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** (`password.ts`)

```ts
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: object) => Promise<Buffer>;

const N = 131072; // 2^17 per OWASP
const R = 8;
const P = 1;
const KEYLEN = 32;
const MAXMEM = 256 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nStr, rStr, pStr, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  if (salt.length < 8 || expected.length < 16) return false;
  try {
    const actual = await scrypt(password, salt, expected.length, {
      N: Number(nStr), r: Number(rStr), p: Number(pStr), maxmem: MAXMEM,
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run, verify pass.** (scrypt N=2^17 takes ~100ms per call — test runtime of a few seconds is expected.)
- [ ] **Step 5: Commit** — `feat(auth): scrypt password hashing with self-describing hash format`

### Task 4: Cookie helpers + decorators

**Files:** Create `src/auth/cookies.ts`, `src/auth/decorators.ts` (pure plumbing; covered via guard/service tests)

- [ ] **Step 1: Implement `cookies.ts`**

```ts
export const SESSION_COOKIE = 'proveit_session';

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export function buildSessionCookie(token: string, maxAgeSeconds: number): string {
  const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${secure}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}
```

- [ ] **Step 2: Implement `decorators.ts`**

```ts
import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ADMIN_ONLY_KEY = 'adminOnly';
export const AdminOnly = () => SetMetadata(ADMIN_ONLY_KEY, true);

export interface RequestUser { id: string; username: string; role: string }

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser =>
    ctx.switchToHttp().getRequest().user,
);
```

- [ ] **Step 3: Commit** — `feat(auth): cookie helpers and auth decorators`

### Task 5: AuthService

**Files:** Create `src/auth/auth.service.ts`, `src/auth/auth.service.spec.ts`

Service API (all sessions identified by sha256-hex of raw token):
- `needsSetup()` → `{ needsSetup: boolean }` (true when user count is 0)
- `setup(username, password)` → creates admin (403 `ForbiddenException` if any user exists), backfills `pocConfig.updateMany({ where: { ownerId: null } })` to the new admin, returns `{ user, token }`
- `login(username, password)` → throttle check (5 fails/15min per username → `HttpException` 429); uniform `UnauthorizedException('Invalid credentials')` for unknown user / wrong password / deactivated; prunes expired sessions; creates session (7-day expiry); returns `{ user, token }`
- `logout(token)` → deletes session row
- `validateSession(token)` → null when missing/expired/user-inactive; slides expiry forward to now+7d when <6d remain; returns `{ id, username, role }`
- `listUsers()`, `createUser(dto)` (admin), `updateUser(id, dto)` (role/isActive/password; deletes sessions on password change or deactivate; guards last-active-admin from demote/deactivate), `deleteUser(id)` (409 `ConflictException` when user owns POCs; guards last admin)

- [ ] **Step 1: Failing tests** (`auth.service.spec.ts`) — mock Prisma with plain objects:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './auth.service';
import { hashPassword } from './password';

function mockPrisma() {
  return {
    user: { count: vi.fn(), create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
    session: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn(), deleteMany: vi.fn(), update: vi.fn() },
    pocConfig: { updateMany: vi.fn(), count: vi.fn() },
  };
}

describe('AuthService', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let svc: AuthService;
  beforeEach(() => { prisma = mockPrisma(); svc = new AuthService(prisma as never); });

  it('setup creates first admin and backfills orphan POCs', async () => {
    prisma.user.count.mockResolvedValue(0);
    prisma.user.create.mockResolvedValue({ id: 'u1', username: 'admin', role: 'admin', isActive: true });
    const res = await svc.setup('admin', 'longpassword1');
    expect(prisma.user.create).toHaveBeenCalled();
    expect(prisma.pocConfig.updateMany).toHaveBeenCalledWith({ where: { ownerId: null }, data: { ownerId: 'u1' } });
    expect(res.token).toBeTruthy();
  });
  it('setup refuses when a user already exists', async () => {
    prisma.user.count.mockResolvedValue(1);
    await expect(svc.setup('x', 'longpassword1')).rejects.toThrow(/already/i);
  });
  it('login succeeds with correct password and creates a session', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', username: 'a', role: 'member', isActive: true, passwordHash: await hashPassword('pw-very-secret') });
    const res = await svc.login('a', 'pw-very-secret');
    expect(prisma.session.create).toHaveBeenCalled();
    expect(res.token).toBeTruthy();
    // raw token never stored
    const arg = prisma.session.create.mock.calls[0][0];
    expect(arg.data.tokenHash).not.toBe(res.token);
  });
  it('login fails uniformly for unknown user and wrong password', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(svc.login('ghost', 'pw')).rejects.toThrow('Invalid credentials');
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', username: 'a', role: 'member', isActive: true, passwordHash: await hashPassword('right') });
    await expect(svc.login('a', 'wrong')).rejects.toThrow('Invalid credentials');
  });
  it('login rejects deactivated users', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', username: 'a', role: 'member', isActive: false, passwordHash: await hashPassword('pw-very-secret') });
    await expect(svc.login('a', 'pw-very-secret')).rejects.toThrow('Invalid credentials');
  });
  it('throttles after 5 failed attempts', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    for (let i = 0; i < 5; i++) await expect(svc.login('victim', 'x')).rejects.toThrow('Invalid credentials');
    await expect(svc.login('victim', 'x')).rejects.toThrow(/too many/i);
  });
  it('validateSession returns user and slides expiry', async () => {
    const soon = new Date(Date.now() + 24 * 3600 * 1000); // 1 day left
    prisma.session.findUnique.mockResolvedValue({ id: 's1', expiresAt: soon, user: { id: 'u1', username: 'a', role: 'member', isActive: true } });
    const user = await svc.validateSession('rawtoken');
    expect(user).toEqual({ id: 'u1', username: 'a', role: 'member' });
    expect(prisma.session.update).toHaveBeenCalled();
  });
  it('validateSession rejects expired or inactive', async () => {
    prisma.session.findUnique.mockResolvedValue({ id: 's1', expiresAt: new Date(Date.now() - 1000), user: { id: 'u1', username: 'a', role: 'member', isActive: true } });
    expect(await svc.validateSession('t')).toBeNull();
    prisma.session.findUnique.mockResolvedValue({ id: 's1', expiresAt: new Date(Date.now() + 1e7), user: { id: 'u1', username: 'a', role: 'member', isActive: false } });
    expect(await svc.validateSession('t')).toBeNull();
  });
  it('deleteUser returns 409 when user owns POCs', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u2', role: 'member', isActive: true });
    prisma.pocConfig.count.mockResolvedValue(3);
    await expect(svc.deleteUser('u2')).rejects.toThrow(/POC/i);
  });
});
```

- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** (`auth.service.ts`)

```ts
import { ConflictException, ForbiddenException, HttpException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, verifyPassword } from './password';

const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;
const SLIDE_THRESHOLD_MS = 6 * 24 * 3600 * 1000;
const MAX_FAILS = 5;
const FAIL_WINDOW_MS = 15 * 60 * 1000;

export interface SessionUser { id: string; username: string; role: string }

function sha256(s: string): string { return createHash('sha256').update(s).digest('hex'); }

@Injectable()
export class AuthService {
  private failedLogins = new Map<string, { count: number; resetAt: number }>();

  constructor(private prisma: PrismaService) {}

  async needsSetup() {
    return { needsSetup: (await this.prisma.user.count()) === 0 };
  }

  async setup(username: string, password: string) {
    if ((await this.prisma.user.count()) > 0) {
      throw new ForbiddenException('Setup already completed');
    }
    const user = await this.prisma.user.create({
      data: { username, passwordHash: await hashPassword(password), role: 'admin' },
    });
    await this.prisma.pocConfig.updateMany({ where: { ownerId: null }, data: { ownerId: user.id } });
    const token = await this.createSession(user.id);
    return { user: this.toSessionUser(user), token };
  }

  async login(username: string, password: string) {
    const entry = this.failedLogins.get(username);
    if (entry && entry.resetAt > Date.now() && entry.count >= MAX_FAILS) {
      throw new HttpException('Too many failed attempts. Try again later.', 429);
    }
    const user = await this.prisma.user.findUnique({ where: { username } });
    const ok = user?.isActive && (await verifyPassword(password, user.passwordHash));
    if (!ok || !user) {
      this.recordFailure(username);
      throw new UnauthorizedException('Invalid credentials');
    }
    this.failedLogins.delete(username);
    await this.prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    const token = await this.createSession(user.id);
    return { user: this.toSessionUser(user), token };
  }

  async logout(token: string) {
    await this.prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  }

  async validateSession(token: string): Promise<SessionUser | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;
    if (session.expiresAt.getTime() - Date.now() < SLIDE_THRESHOLD_MS) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
      });
    }
    return this.toSessionUser(session.user);
  }

  // ─── User management (admin) ──────────────────────────────────────────────

  async listUsers() {
    return this.prisma.user.findMany({
      select: { id: true, username: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createUser(username: string, password: string, role: 'admin' | 'member') {
    const user = await this.prisma.user.create({
      data: { username, passwordHash: await hashPassword(password), role },
    });
    return this.toPublicUser(user);
  }

  async updateUser(id: string, dto: { role?: 'admin' | 'member'; isActive?: boolean; password?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if ((dto.role === 'member' || dto.isActive === false) && user.role === 'admin') {
      await this.assertNotLastAdmin(id);
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.password !== undefined && { passwordHash: await hashPassword(dto.password) }),
      },
    });
    if (dto.password !== undefined || dto.isActive === false) {
      await this.prisma.session.deleteMany({ where: { userId: id } });
    }
    return this.toPublicUser(updated);
  }

  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'admin') await this.assertNotLastAdmin(id);
    const pocCount = await this.prisma.pocConfig.count({ where: { ownerId: id } });
    if (pocCount > 0) {
      throw new ConflictException(`User still owns ${pocCount} POC(s). Deactivate the user instead, or delete their POCs first.`);
    }
    await this.prisma.user.delete({ where: { id } });
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  private async assertNotLastAdmin(exceptId: string) {
    const otherAdmins = await this.prisma.user.count({
      where: { role: 'admin', isActive: true, id: { not: exceptId } },
    });
    if (otherAdmins === 0) throw new ConflictException('Cannot remove the last active admin');
  }

  private async createSession(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.session.create({
      data: { tokenHash: sha256(token), userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
    });
    return token;
  }

  private recordFailure(username: string) {
    const now = Date.now();
    const entry = this.failedLogins.get(username);
    if (!entry || entry.resetAt <= now) {
      this.failedLogins.set(username, { count: 1, resetAt: now + FAIL_WINDOW_MS });
    } else {
      entry.count += 1;
    }
  }

  private toSessionUser(u: { id: string; username: string; role: string }): SessionUser {
    return { id: u.id, username: u.username, role: u.role };
  }

  private toPublicUser(u: { id: string; username: string; role: string; isActive: boolean; createdAt: Date }) {
    return { id: u.id, username: u.username, role: u.role, isActive: u.isActive, createdAt: u.createdAt };
  }
}
```

- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit** — `feat(auth): AuthService with sessions, throttling, user management`

### Task 6: AuthGuard (global)

**Files:** Create `src/auth/auth.guard.ts`, `src/auth/auth.guard.spec.ts`

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { SESSION_COOKIE } from './cookies';

function ctxWith(cookie: string | undefined, meta: { isPublic?: boolean; adminOnly?: boolean }) {
  const req: Record<string, unknown> = { headers: { cookie } };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => 'handler',
    getClass: () => 'class',
  } as unknown as ExecutionContext;
  const reflector = {
    getAllAndOverride: vi.fn((key: string) =>
      key === 'isPublic' ? meta.isPublic : key === 'adminOnly' ? meta.adminOnly : undefined),
  } as unknown as Reflector;
  return { ctx, reflector, req };
}

describe('AuthGuard', () => {
  const auth = { validateSession: vi.fn() };
  beforeEach(() => vi.clearAllMocks());

  it('allows @Public routes without a session', async () => {
    const { ctx, reflector } = ctxWith(undefined, { isPublic: true });
    expect(await new AuthGuard(auth as never, reflector).canActivate(ctx)).toBe(true);
  });
  it('rejects protected routes without a cookie', async () => {
    const { ctx, reflector } = ctxWith(undefined, {});
    await expect(new AuthGuard(auth as never, reflector).canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
  it('rejects invalid sessions', async () => {
    auth.validateSession.mockResolvedValue(null);
    const { ctx, reflector } = ctxWith(`${SESSION_COOKIE}=bad`, {});
    await expect(new AuthGuard(auth as never, reflector).canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
  it('attaches user on valid session', async () => {
    auth.validateSession.mockResolvedValue({ id: 'u1', username: 'a', role: 'member' });
    const { ctx, reflector, req } = ctxWith(`${SESSION_COOKIE}=good`, {});
    expect(await new AuthGuard(auth as never, reflector).canActivate(ctx)).toBe(true);
    expect(req.user).toEqual({ id: 'u1', username: 'a', role: 'member' });
  });
  it('rejects members on @AdminOnly routes with 403', async () => {
    auth.validateSession.mockResolvedValue({ id: 'u1', username: 'a', role: 'member' });
    const { ctx, reflector } = ctxWith(`${SESSION_COOKIE}=good`, { adminOnly: true });
    await expect(new AuthGuard(auth as never, reflector).canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
  it('allows admins on @AdminOnly routes', async () => {
    auth.validateSession.mockResolvedValue({ id: 'u1', username: 'a', role: 'admin' });
    const { ctx, reflector } = ctxWith(`${SESSION_COOKIE}=good`, { adminOnly: true });
    expect(await new AuthGuard(auth as never, reflector).canActivate(ctx)).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** (`auth.guard.ts`)

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { parseCookies, SESSION_COOKIE } from './cookies';
import { ADMIN_ONLY_KEY, IS_PUBLIC_KEY } from './decorators';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest();
    const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
    if (!token) throw new UnauthorizedException('Not authenticated');

    const user = await this.authService.validateSession(token);
    if (!user) throw new UnauthorizedException('Session expired or invalid');

    if (this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY_KEY, targets) && user.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

    request.user = user;
    return true;
  }
}
```

- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit** — `feat(auth): global AuthGuard with @Public/@AdminOnly support`

### Task 7: Auth controller, DTOs, module, app wiring

**Files:** Create `src/auth/dto/auth.dto.ts`, `src/auth/auth.controller.ts`, `src/auth/auth.module.ts`. Modify `src/app.module.ts`, `src/main.ts`, `.env.example`, root `README.md` (env note optional).

- [ ] **Step 1: DTOs** (`dto/auth.dto.ts`)

```ts
import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const USERNAME_RE = /^[a-zA-Z0-9_-]+$/;

export class CredentialsDto {
  @IsString() @MinLength(3) @MaxLength(32) @Matches(USERNAME_RE)
  username!: string;

  @IsString() @MinLength(10) @MaxLength(128)
  password!: string;
}

export class CreateUserDto extends CredentialsDto {
  @IsIn(['admin', 'member'])
  role!: 'admin' | 'member';
}

export class UpdateUserDto {
  @IsOptional() @IsIn(['admin', 'member'])
  role?: 'admin' | 'member';

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsString() @MinLength(10) @MaxLength(128)
  password?: string;
}

export class LoginDto {
  @IsString() @MaxLength(64)
  username!: string;

  @IsString() @MaxLength(128)
  password!: string;
}
```

- [ ] **Step 2: Controller** (`auth.controller.ts`)

```ts
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { buildSessionCookie, clearSessionCookie, parseCookies, SESSION_COOKIE } from './cookies';
import { AdminOnly, CurrentUser, Public, RequestUser } from './decorators';
import { CreateUserDto, CredentialsDto, LoginDto, UpdateUserDto } from './dto/auth.dto';

const SESSION_TTL_SECONDS = 7 * 24 * 3600;

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get('setup-status')
  setupStatus() {
    return this.authService.needsSetup();
  }

  @Public()
  @Post('setup')
  async setup(@Body() dto: CredentialsDto, @Res({ passthrough: true }) res: Response) {
    const { user, token } = await this.authService.setup(dto.username, dto.password);
    res.setHeader('Set-Cookie', buildSessionCookie(token, SESSION_TTL_SECONDS));
    return user;
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, token } = await this.authService.login(dto.username, dto.password);
    res.setHeader('Set-Cookie', buildSessionCookie(token, SESSION_TTL_SECONDS));
    return user;
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (token) await this.authService.logout(token);
    res.setHeader('Set-Cookie', clearSessionCookie());
  }

  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return user;
  }

  // ─── User management (admin) ──────────────────────────────────────────────

  @AdminOnly()
  @Get('users')
  listUsers() {
    return this.authService.listUsers();
  }

  @AdminOnly()
  @Post('users')
  createUser(@Body() dto: CreateUserDto) {
    return this.authService.createUser(dto.username, dto.password, dto.role);
  }

  @AdminOnly()
  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.authService.updateUser(id, dto);
  }

  @AdminOnly()
  @Delete('users/:id')
  @HttpCode(204)
  deleteUser(@Param('id') id: string) {
    return this.authService.deleteUser(id);
  }
}
```

- [ ] **Step 3: Module** (`auth.module.ts`)

```ts
import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 4: Wire app.module.ts** — add `CryptoModule` and `AuthModule` to imports:

```ts
import { CryptoModule } from './crypto/crypto.module';
import { AuthModule } from './auth/auth.module';
// ...
imports: [PrismaModule, CryptoModule, AuthModule, ScaffoldModule, PocModule, LlmModule, EvalModule, ChatModule],
```

- [ ] **Step 5: main.ts CORS** — replace the `enableCors` line:

```ts
const allowedOrigin = process.env.ALLOWED_ORIGIN;
app.enableCors({
  origin: allowedOrigin ? [allowedOrigin] : /^http:\/\/localhost:\d+$/,
  credentials: true,
});
```

- [ ] **Step 6: `.env.example`** — append:

```
# Required: 64 hex chars used to encrypt stored LLM API keys.
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
PROVEIT_SECRET=
# Set true when serving over HTTPS
COOKIE_SECURE=false
# Set to the deployed frontend origin (default allows any localhost port)
# ALLOWED_ORIGIN=https://proveit.example.com
```

Also add a generated `PROVEIT_SECRET` to the local `packages/backend/.env`.

- [ ] **Step 7: Build + full test run** — `pnpm --filter backend build && pnpm --filter backend test`. Expected: compiles, all green.
- [ ] **Step 8: Commit** — `feat(auth): auth endpoints, global guard wiring, env config`

### Task 8: API key encryption in LlmService + startup migration

**Files:** Modify `src/llm/llm.service.ts`, `src/llm/llm.module.ts`, `src/poc/poc.controller.ts` (scaffold decrypt). Create `src/llm/key-migration.service.ts`, `src/llm/key-migration.service.spec.ts`. Modify `packages/shared/src/types.ts` (`LlmProvider` + `hasApiKey`, `apiKeyHint`).

- [ ] **Step 1: Failing tests for migration service**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KeyMigrationService } from './key-migration.service';
import { CryptoService } from '../crypto/crypto.service';

describe('KeyMigrationService', () => {
  let crypto: CryptoService;
  const prisma = { llmConnection: { findMany: vi.fn(), update: vi.fn() } };
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PROVEIT_SECRET = 'a'.repeat(64);
    crypto = new CryptoService();
  });

  it('encrypts plaintext keys in place and sets hints', async () => {
    prisma.llmConnection.findMany.mockResolvedValue([
      { id: 'c1', apiKey: 'sk-plain-1234' },
    ]);
    await new KeyMigrationService(prisma as never, crypto).onModuleInit();
    const call = prisma.llmConnection.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'c1' });
    expect(crypto.decrypt(call.data.apiKey)).toBe('sk-plain-1234');
    expect(call.data.apiKeyHint).toBe('1234');
  });
  it('skips already-encrypted keys', async () => {
    prisma.llmConnection.findMany.mockResolvedValue([
      { id: 'c2', apiKey: crypto.encrypt('sk-x') },
    ]);
    await new KeyMigrationService(prisma as never, crypto).onModuleInit();
    expect(prisma.llmConnection.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement migration service**

```ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';

@Injectable()
export class KeyMigrationService implements OnModuleInit {
  private readonly logger = new Logger(KeyMigrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async onModuleInit(): Promise<void> {
    const conns = await this.prisma.llmConnection.findMany({
      where: { apiKey: { not: null } },
      select: { id: true, apiKey: true },
    });
    const plaintext = conns.filter((c) => c.apiKey && !this.crypto.isEncrypted(c.apiKey));
    for (const conn of plaintext) {
      await this.prisma.llmConnection.update({
        where: { id: conn.id },
        data: { apiKey: this.crypto.encrypt(conn.apiKey!), apiKeyHint: conn.apiKey!.slice(-4) },
      });
    }
    if (plaintext.length > 0) this.logger.log(`Encrypted ${plaintext.length} plaintext API key(s)`);
  }
}
```

Register in `llm.module.ts` providers.

- [ ] **Step 4: LlmService changes**

1. Inject `CryptoService` in constructor.
2. Add private helpers:
```ts
private encryptKey(apiKey: string | undefined | null) {
  return apiKey ? { apiKey: this.crypto.encrypt(apiKey), apiKeyHint: apiKey.slice(-4) } : { apiKey, apiKeyHint: null };
}
private decryptKey(apiKey: string | null): string | undefined {
  return apiKey ? this.crypto.decrypt(apiKey) : undefined;
}
```
3. Writes: in `createProvider`, `createGlobalProvider` replace `apiKey: dto.apiKey` with `...this.encryptKey(dto.apiKey)`. In `updateProvider`, `updateGlobalProvider` replace `{ apiKey: dto.apiKey, isActive: false }` with `{ ...this.encryptKey(dto.apiKey), isActive: false }`. In legacy `upsert`, encrypt the same way (keep "undefined keeps existing key" semantics).
4. Reads: every `conn.apiKey ?? undefined` passed to `getClient`/`fetchModelsFromUrl` becomes `this.decryptKey(conn.apiKey)` (sites: `testProvider`, `resolveForTask`, `getModels`, `fetchModels` global-provider branch, `testGlobalProvider`).
5. `toProvider`: accept `apiKey`/`apiKeyHint` fields and add to the returned object:
```ts
hasApiKey: !!conn.apiKey,
apiKeyHint: conn.apiKeyHint ?? undefined,
```
6. Shared `LlmProvider` type gains `hasApiKey: boolean; apiKeyHint?: string`.

- [ ] **Step 5: Scaffold path** — in `poc.controller.ts` the global-provider branch passes `provider.apiKey` to the job; inject `CryptoService` and use `apiKey = provider.apiKey ? crypto.decrypt(provider.apiKey) : undefined`. Direct user-supplied `body.apiKey` stays as-is (it's already plaintext in flight and is not persisted by the scaffold path).
- [ ] **Step 6: Build + tests** — `pnpm --filter @proveit/shared build && pnpm --filter backend build && pnpm --filter backend test`.
- [ ] **Step 7: Commit** — `feat(auth): encrypt LLM API keys at rest, startup migration, key hints`

### Task 9: Ownership scoping (backend)

**Files:** Modify `src/poc/poc.service.ts`, `src/poc/poc.controller.ts`, `src/eval/eval.controller.ts`, `src/chat/chat.controller.ts`, `src/llm/llm.controller.ts`. Create `src/poc/ownership.spec.ts`.

- [ ] **Step 1: Failing tests** (`ownership.spec.ts`) — mock Prisma:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { PocService } from './poc.service';

const prisma = {
  pocConfig: { findFirst: vi.fn(), findMany: vi.fn() },
};

describe('POC ownership', () => {
  let svc: PocService;
  beforeEach(() => {
    vi.clearAllMocks();
    svc = new PocService(prisma as never, {} as never);
  });

  it('assertOwnership passes for the owner', async () => {
    prisma.pocConfig.findFirst.mockResolvedValue({ id: 'p1' });
    await expect(svc.assertOwnership('p1', 'u1')).resolves.toBeUndefined();
    expect(prisma.pocConfig.findFirst).toHaveBeenCalledWith({
      where: { id: 'p1', ownerId: 'u1' }, select: { id: true },
    });
  });
  it('assertOwnership 404s for non-owners', async () => {
    prisma.pocConfig.findFirst.mockResolvedValue(null);
    await expect(svc.assertOwnership('p1', 'intruder')).rejects.toThrow(NotFoundException);
  });
  it('findAll scopes by owner', async () => {
    prisma.pocConfig.findMany.mockResolvedValue([]);
    await svc.findAll('u1');
    expect(prisma.pocConfig.findMany.mock.calls[0][0].where).toEqual({ ownerId: 'u1' });
  });
});
```

- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: PocService changes**

```ts
async assertOwnership(pocId: string, userId: string): Promise<void> {
  const poc = await this.prisma.pocConfig.findFirst({
    where: { id: pocId, ownerId: userId },
    select: { id: true },
  });
  if (!poc) throw new NotFoundException('POC not found');
}
```

- `findAll(userId: string)` — add `where: { ownerId: userId }`.
- `findOne(id: string, userId: string)` — `findUnique({ where: { id } })` becomes `findFirst({ where: { id, ownerId: userId }, include: ... })`.
- `update(id, dto, userId)`, `remove(id, userId)`, `export(id, userId)` — they call `findOne`, pass `userId` through.
- `listConfigVersions/getConfigVersion/restoreConfigVersion(pocId, ..., userId)` — call `assertOwnership(pocId, userId)` first; `restoreConfigVersion` passes `userId` to its internal `update`/`findOne` calls.
- Scaffold jobs: `private jobs = new Map<string, { subject: ReplaySubject<MessageEvent>; userId: string }>()`; `startScaffoldJob(params, userId)` stores it; `getJobStream(jobId, userId)` and `getCompletedPocId(jobId, userId)` throw `NotFoundException` when `job.userId !== userId`; `completedJobs` stores `{ pocId, userId }`. `runScaffoldJob` sets `ownerId: userId` in `pocConfig.create`.

- [ ] **Step 4: Controller threading**

`poc.controller.ts`: every handler gains `@CurrentUser() user: RequestUser` and passes `user.id` (scaffold start/stream/completed, findAll, findOne, update, remove, config-versions, export). Import from `../auth/decorators`.

`eval.controller.ts`, `chat.controller.ts`, `llm.controller.ts` (POC-scoped `LlmController` only): inject `PocService` (import `PocModule`'s exported service into `EvalModule`/`ChatModule`/`LlmModule` — add `exports: [PocService]` to `PocModule` and `imports: [PocModule]` to the other three; use `forwardRef` if a cycle appears), make each `:pocId` handler `async`, first line:
```ts
await this.pocService.assertOwnership(pocId, user.id);
```

`llm.controller.ts` global-provider controller (`LlmGlobalController`): decorate `POST/PATCH/DELETE /global-providers*`, `POST .../test`, `POST .../default` with `@AdminOnly()`. `GET global-providers` stays member-accessible. `LlmRootController.fetchModels` needs no ownership (takes explicit endpoint/global provider id, no POC data).

- [ ] **Step 5: Build + tests.** `pnpm --filter backend build && pnpm --filter backend test`
- [ ] **Step 6: Commit** — `feat(auth): per-user POC ownership scoping across all routes`

### Task 10: Shared types

**Files:** Modify `packages/shared/src/types.ts`

- [ ] **Step 1: Add types**

```ts
export interface AuthUser {
  id: string;
  username: string;
  role: 'admin' | 'member';
}

export interface ManagedUser extends AuthUser {
  isActive: boolean;
  createdAt: string;
}
```

(plus the `LlmProvider.hasApiKey/apiKeyHint` fields from Task 8 if not already added). Run `pnpm --filter @proveit/shared build`.

- [ ] **Step 2: Commit** — `feat(auth): shared auth types`

### Task 11: Frontend auth plumbing

**Files:** Modify `src/services/api.ts`, `src/App.tsx`, `src/components/ui/Header.tsx`. Create `src/auth/AuthContext.tsx`, `src/pages/Login.tsx`, `src/pages/Setup.tsx`.

- [ ] **Step 1: api.ts 401 handling** — inside `request()` before the generic error throw:

```ts
if (res.status === 401 && !['/login', '/setup'].includes(window.location.pathname)) {
  window.location.href = '/login';
}
```

- [ ] **Step 2: AuthContext.tsx**

```tsx
import { createContext, useContext, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthUser } from '@proveit/shared';
import { api } from '../services/api';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  needsSetup: boolean;
  refresh: () => void;
}

const AuthContext = createContext<AuthState>({ user: null, isLoading: true, needsSetup: false, refresh: () => {} });

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const setupQuery = useQuery({
    queryKey: ['auth', 'setup-status'],
    queryFn: () => api.get<{ needsSetup: boolean }>('/auth/setup-status'),
    staleTime: Infinity,
  });
  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get<AuthUser>('/auth/me').catch(() => null),
    enabled: setupQuery.data?.needsSetup === false,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return (
    <AuthContext.Provider
      value={{
        user: meQuery.data ?? null,
        isLoading: setupQuery.isLoading || (setupQuery.data?.needsSetup === false && meQuery.isLoading),
        needsSetup: setupQuery.data?.needsSetup ?? false,
        refresh: () => queryClient.invalidateQueries({ queryKey: ['auth'] }),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
```

Note: the `/auth/me` 401 is caught (`catch(() => null)`) so the API wrapper's redirect must skip when `window.location.pathname` is `/login` or `/setup`; the gate component below handles navigation instead.

- [ ] **Step 3: Login.tsx** — Tailwind form matching existing UI components (`Button`, `Input` from `components/ui` if present — check and reuse): username + password fields, error message on failure, on success `refresh()` + `navigate('/')`. POST `/auth/login`.
- [ ] **Step 4: Setup.tsx** — same shape, headline "Create the admin account", password confirmation field, POST `/auth/setup`, on success `refresh()` + `navigate('/')`.
- [ ] **Step 5: App.tsx gate**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Login } from './pages/Login';
import { Setup } from './pages/Setup';
import { Users } from './pages/Users';
// ...existing page imports

function Gate() {
  const { user, isLoading, needsSetup } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;
  if (needsSetup) return <Setup />;
  if (!user) return <Login />;
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-5xl">
        <Routes>
          {/* existing routes unchanged */}
          <Route path="/settings/users" element={<Users />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  );
}
```

- [ ] **Step 6: Header** — read current `Header.tsx`, add right-side block: username, admin-only "Users" link to `/settings/users`, "Sign out" button calling `api.post('/auth/logout', {})` then `refresh()`.
- [ ] **Step 7: Manual check** — backend running, `curl -i http://localhost:3000/api/pocs` → 401; frontend shows Setup on fresh DB.
- [ ] **Step 8: Commit** — `feat(auth): frontend login/setup flow, auth context, 401 handling`

### Task 12: Users admin page

**Files:** Create `src/pages/Users.tsx`

- [ ] **Step 1: Implement** — table of users (`GET /auth/users` via React Query), create-user form (username/password/role), per-row actions: activate/deactivate toggle, reset password (prompt-style inline form), delete (confirm; surface 409 message). Mutations invalidate `['auth','users']`. Non-admins: page renders "Admins only" notice (server enforces anyway). Follow existing Tailwind component patterns from `GlobalSettings.tsx`.
- [ ] **Step 2: Manual check in browser.**
- [ ] **Step 3: Commit** — `feat(auth): admin users management page`

### Task 13: Key hint display + admin gating in provider UIs

**Files:** Modify `src/pages/GlobalSettings.tsx`, `src/pages/LlmConnect.tsx`

- [ ] **Step 1:** Saved providers show `••••{apiKeyHint}` when `hasApiKey` (read the new fields from `LlmProvider`); the API-key input placeholder becomes "Leave blank to keep current key" when editing a provider with `hasApiKey`.
- [ ] **Step 2:** In `GlobalSettings.tsx`, hide create/edit/delete/test/set-default controls when `useAuth().user?.role !== 'admin'`; show a note that global providers are admin-managed.
- [ ] **Step 3: Commit** — `feat(auth): key hints and admin-gated global provider management`

### Task 14: Full verification

- [ ] **Step 1:** `pnpm build` (all packages compile)
- [ ] **Step 2:** `pnpm --filter backend test` (all green)
- [ ] **Step 3:** Live smoke with curl against running dev servers:
  - `curl -i http://localhost:3000/api/pocs` → 401
  - `curl -s http://localhost:3000/api/auth/setup-status` → `{"needsSetup":true}` on fresh DB
  - `curl -i -X POST http://localhost:3000/api/auth/setup -H 'Content-Type: application/json' -d '{"username":"admin","password":"password12345"}'` → 201 + `Set-Cookie`
  - Re-run setup → 403
  - `curl -i -X POST http://localhost:3000/api/auth/login -d '{"username":"admin","password":"wrong"}' -H 'Content-Type: application/json'` ×6 → 401 ×5 then 429
  - Login correctly, save cookie, `curl -b cookiejar http://localhost:3000/api/pocs` → 200
  - Create member via `/api/auth/users` with admin cookie; member POST to `/api/llm/global-providers` → 403
  - Create a provider with an API key; check DB: `sqlite3 prisma/dev.db "SELECT apiKey, apiKeyHint FROM LlmConnection"` → `enc:v1:`-prefixed value + 4-char hint
  - Two users each create a POC (or one via scaffold); user A `GET /api/pocs/:idOfB` → 404
- [ ] **Step 4:** Browser walkthrough: setup → logout → login → create POC list visible → Users page → global settings gating.
- [ ] **Step 5: Commit any fixes**, final commit.

---

## Self-Review Notes

- Spec coverage: data model (T1), crypto (T2, T8), passwords (T3), sessions/guard (T5–T7), endpoints (T7), key protection + migration + hints (T8), ownership + scaffold jobs + global-provider admin gating (T9), frontend (T11–T13), error codes exercised in T14. Frontend component tests from the spec are dropped: the frontend has no test infra and adding one violates the minimal-deps constitution — covered instead by T14's browser walkthrough.
- `restoreConfigVersion` calls `update` internally — signature change must thread `userId` (noted in T9 Step 3).
- `PocService` constructor gains no new deps; `PocController` gains `CryptoService` (T8 Step 5).
