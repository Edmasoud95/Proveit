import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './auth.service';
import { hashPassword } from './password';

function mockPrisma() {
  return {
    user: {
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    session: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
    },
    pocConfig: { updateMany: vi.fn(), count: vi.fn() },
  };
}

describe('AuthService', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let svc: AuthService;
  beforeEach(() => {
    prisma = mockPrisma();
    svc = new AuthService(prisma as never);
  });

  it('setup creates first admin and backfills orphan POCs', async () => {
    prisma.user.count.mockResolvedValue(0);
    prisma.user.create.mockResolvedValue({ id: 'u1', username: 'admin', role: 'admin', isActive: true });
    const res = await svc.setup('admin', 'longpassword1');
    expect(prisma.user.create).toHaveBeenCalled();
    expect(prisma.pocConfig.updateMany).toHaveBeenCalledWith({
      where: { ownerId: null },
      data: { ownerId: 'u1' },
    });
    expect(res.token).toBeTruthy();
  });

  it('setup refuses when a user already exists', async () => {
    prisma.user.count.mockResolvedValue(1);
    await expect(svc.setup('x', 'longpassword1')).rejects.toThrow(/already/i);
  });

  it('login succeeds with correct password and creates a session', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      username: 'a',
      role: 'member',
      isActive: true,
      passwordHash: await hashPassword('pw-very-secret'),
    });
    const res = await svc.login('a', 'pw-very-secret');
    expect(prisma.session.create).toHaveBeenCalled();
    expect(res.token).toBeTruthy();
    const arg = prisma.session.create.mock.calls[0][0];
    expect(arg.data.tokenHash).not.toBe(res.token);
  });

  it('login fails uniformly for unknown user and wrong password', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(svc.login('ghost', 'pw')).rejects.toThrow('Invalid credentials');
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      username: 'a',
      role: 'member',
      isActive: true,
      passwordHash: await hashPassword('right'),
    });
    await expect(svc.login('a', 'wrong')).rejects.toThrow('Invalid credentials');
  });

  it('login rejects deactivated users', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      username: 'a',
      role: 'member',
      isActive: false,
      passwordHash: await hashPassword('pw-very-secret'),
    });
    await expect(svc.login('a', 'pw-very-secret')).rejects.toThrow('Invalid credentials');
  });

  it('throttles after 5 failed attempts', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    for (let i = 0; i < 5; i++) {
      await expect(svc.login('victim', 'x')).rejects.toThrow('Invalid credentials');
    }
    await expect(svc.login('victim', 'x')).rejects.toThrow(/too many/i);
  });

  it('validateSession returns user and slides expiry', async () => {
    const soon = new Date(Date.now() + 24 * 3600 * 1000);
    prisma.session.findUnique.mockResolvedValue({
      id: 's1',
      expiresAt: soon,
      user: { id: 'u1', username: 'a', role: 'member', isActive: true },
    });
    const user = await svc.validateSession('rawtoken');
    expect(user).toEqual({ id: 'u1', username: 'a', role: 'member' });
    expect(prisma.session.update).toHaveBeenCalled();
  });

  it('validateSession rejects expired or inactive', async () => {
    prisma.session.findUnique.mockResolvedValue({
      id: 's1',
      expiresAt: new Date(Date.now() - 1000),
      user: { id: 'u1', username: 'a', role: 'member', isActive: true },
    });
    expect(await svc.validateSession('t')).toBeNull();
    prisma.session.findUnique.mockResolvedValue({
      id: 's1',
      expiresAt: new Date(Date.now() + 1e7),
      user: { id: 'u1', username: 'a', role: 'member', isActive: false },
    });
    expect(await svc.validateSession('t')).toBeNull();
  });

  it('deleteUser returns 409 when user owns POCs', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u2', role: 'member', isActive: true });
    prisma.pocConfig.count.mockResolvedValue(3);
    await expect(svc.deleteUser('u2')).rejects.toThrow(/POC/i);
  });
});
