/**
 * Public API of the H-OS platform kernel. Modules import only from this entry point; kernel
 * internals are not part of any contract (ARCH-002).
 */
export { loadConfig, ConfigurationError, CONFIG } from './config.js';
export type { AppConfig } from './config.js';
export { createLogger } from './logger.js';
export type { Logger } from './logger.js';
export { CLOCK, ID_GENERATOR, SystemClock, FixedClock, CryptoIdGenerator } from './clock.js';
export type { Clock, IdGenerator } from './clock.js';
export {
  AppError,
  RateLimitedError,
  ValidationError,
  UnauthenticatedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  PreconditionFailedError,
  IntegrationPendingError,
} from './errors.js';
export { createDatabase, DATABASE } from './db/index.js';
export type { Database, DbExecutor, Transaction, DatabaseHandle } from './db/index.js';
export {
  AUTH_PROVIDER,
  LocalAuthProvider,
} from './auth/auth-provider.js';
export type { AuthProvider } from './auth/auth-provider.js';
export { SessionService, SESSION_COOKIE } from './auth/session.service.js';
export type { IssuedSession } from './auth/session.service.js';
export { AuthGuard, Public, CurrentActor, readSessionCookie } from './auth/auth.guard.js';
export type { AuthenticatedRequest } from './auth/auth.guard.js';
export { SCOPE_ORDER, scopeFor, can } from './auth/actor.js';
export type { Actor } from './auth/actor.js';
export { AccountDirectoryService } from './auth/account-directory.service.js';
export type { AccountSummary } from './auth/account-directory.service.js';
export { AccountManagementService } from './auth/account-management.service.js';
export type { CreateAccountInput, ManagedAccount } from './auth/account-management.service.js';
export { FixedWindowRateLimiter } from './auth/rate-limiter.js';
export type { RateLimiterClock } from './auth/rate-limiter.js';
export { PermissionService } from './rbac/permission.service.js';
export { AuditService, redactSnapshot } from './audit/audit.service.js';
export type { AuditInput, AuditSubject } from './audit/audit.service.js';
export { OutboxService, OutboxDispatcher, MAX_DELIVERY_ATTEMPTS } from './outbox/outbox.service.js';
export type {
  DomainEventDraft,
  EventHandler,
  EventSubject,
  OutboxEnvelope,
} from './outbox/outbox.service.js';
export { EntityLinkService } from './links/entity-link.service.js';
export { ProblemFilter } from './http/problem.filter.js';
export { ZodValidationPipe } from './http/zod-validation.pipe.js';
export { requestContextMiddleware } from './http/request-context.middleware.js';
export {
  createCsrfOriginGuard,
  csrfAllowedOrigins,
  securityHeadersMiddleware,
} from './http/security.middleware.js';
export { runWithRequestContext, currentRequestContext } from './http/request-context.js';
export type { RequestContext } from './http/request-context.js';
export { KernelModule } from './kernel.module.js';
