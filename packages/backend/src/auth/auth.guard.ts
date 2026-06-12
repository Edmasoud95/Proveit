import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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
