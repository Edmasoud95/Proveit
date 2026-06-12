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
      key === 'isPublic' ? meta.isPublic : key === 'adminOnly' ? meta.adminOnly : undefined,
    ),
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
    await expect(new AuthGuard(auth as never, reflector).canActivate(ctx)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects invalid sessions', async () => {
    auth.validateSession.mockResolvedValue(null);
    const { ctx, reflector } = ctxWith(`${SESSION_COOKIE}=bad`, {});
    await expect(new AuthGuard(auth as never, reflector).canActivate(ctx)).rejects.toThrow(
      UnauthorizedException,
    );
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
    await expect(new AuthGuard(auth as never, reflector).canActivate(ctx)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows admins on @AdminOnly routes', async () => {
    auth.validateSession.mockResolvedValue({ id: 'u1', username: 'a', role: 'admin' });
    const { ctx, reflector } = ctxWith(`${SESSION_COOKIE}=good`, { adminOnly: true });
    expect(await new AuthGuard(auth as never, reflector).canActivate(ctx)).toBe(true);
  });
});
