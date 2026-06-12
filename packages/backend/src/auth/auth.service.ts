import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, verifyPassword } from './password';

const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;
const SLIDE_THRESHOLD_MS = 6 * 24 * 3600 * 1000;
const MAX_FAILS = 5;
const FAIL_WINDOW_MS = 15 * 60 * 1000;

export interface SessionUser {
  id: string;
  username: string;
  role: string;
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

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
      throw new ConflictException(
        `User still owns ${pocCount} POC(s). Deactivate the user instead, or delete their POCs first.`,
      );
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
