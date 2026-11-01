import { Inject, Injectable, Optional, SetMetadata, createParamDecorator } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Actor } from './actor.js';
import { SESSION_COOKIE, SessionService } from './session.service.js';
import { UnauthenticatedError } from '../errors.js';

export const IS_PUBLIC_KEY = 'h_os:public';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

export interface AuthenticatedRequest extends Request {
  actor?: Actor;
  requestId?: string;
  traceId?: string;
}

export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Actor => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.actor) {
      throw new UnauthenticatedError();
    }
    return request.actor;
  },
);

export function readSessionCookie(header: string | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === SESSION_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/**
 * Authentication is required by default on every endpoint (SEC-001). Public endpoints are
 * explicitly annotated and listed in `public-routes.spec.ts`.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Optional() @Inject(SessionService) private readonly sessions?: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readSessionCookie(request.headers.cookie);
    if (!token || !this.sessions) {
      throw new UnauthenticatedError();
    }

    const actor = await this.sessions.resolve(token);
    if (!actor) {
      throw new UnauthenticatedError('Your session has expired. Sign in again.');
    }

    request.actor = actor;
    return true;
  }
}
