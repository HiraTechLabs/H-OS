import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { LoginRequestSchema } from '@h-os/contracts';
import type { LoginRequest, SessionResponse, SessionUser } from '@h-os/contracts';
import {
  CONFIG,
  CurrentActor,
  FixedWindowRateLimiter,
  Public,
  SESSION_COOKIE,
  SessionService,
  UnauthenticatedError,
  ZodValidationPipe,
  readSessionCookie,
} from '@h-os/kernel';
import type { Actor, AppConfig } from '@h-os/kernel';
import { toSessionUser } from './session-user.js';

/**
 * Session endpoints. The session token is an opaque random value delivered as an
 * `HttpOnly`, `SameSite=Lax` cookie: it is never exposed to JavaScript and is never logged
 * (SEC-009, LOG-003). Credential failures are deliberately indistinguishable (SEC-011).
 */
@Controller('api/v1/auth')
export class AuthController {
  /** Unauthenticated attempts are bounded per source address as well as per account (SEC-011). */
  private readonly loginLimiter: FixedWindowRateLimiter;

  constructor(
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {
    this.loginLimiter = new FixedWindowRateLimiter(config.loginRateLimit, 60_000);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Req() request: Request,
    @Body(new ZodValidationPipe(LoginRequestSchema)) input: LoginRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    this.loginLimiter.hit(request.ip ?? 'unknown');
    const issued = await this.sessions.authenticate(input.email, input.password);
    const actor = await this.sessions.resolve(issued.token);
    if (!actor) {
      throw new UnauthenticatedError('Your session could not be established. Try again.');
    }
    this.setSessionCookie(response, issued.token, issued.expiresAt);
    return { user: toSessionUser(actor), expiresAt: issued.expiresAt.toISOString() };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = readSessionCookie(request.headers.cookie);
    if (token) {
      await this.sessions.revoke(token);
    }
    response.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  @Get('me')
  me(@CurrentActor() actor: Actor): SessionUser {
    return toSessionUser(actor);
  }

  private setSessionCookie(response: Response, token: string, expiresAt: Date): void {
    response.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.nodeEnv === 'production',
      path: '/',
      expires: expiresAt,
    });
  }
}
