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
