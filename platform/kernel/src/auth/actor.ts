import type { PermissionGrant, ScopeLevel } from '@h-os/contracts';

/**
 * The authenticated caller of a request. Built from the stored session on every request so
 * permission changes take effect immediately (SEC-014).
 *
 * The kernel knows only platform facts. The employee identity and org position of the caller are
 * H-HR facts and are resolved by H-HR inside its own use cases (BIZ-006, ARCH-003).
 */
export interface Actor {
  readonly accountId: string;
  readonly organizationId: string;
  readonly displayName: string;
  readonly email: string;
  readonly locale: 'en' | 'ar';
  readonly roles: readonly string[];
  readonly grants: readonly PermissionGrant[];
  readonly sessionId: string;
}

export const SCOPE_ORDER: readonly ScopeLevel[] = ['own', 'unit', 'subtree', 'all'];

export function scopeFor(actor: Actor, permission: string): ScopeLevel | null {
  let widest: ScopeLevel | null = null;
  for (const grant of actor.grants) {
    if (grant.permission !== permission) continue;
    if (widest === null || SCOPE_ORDER.indexOf(grant.scope) > SCOPE_ORDER.indexOf(widest)) {
      widest = grant.scope;
    }
  }
  return widest;
}

export function can(actor: Actor, permission: string): boolean {
  return scopeFor(actor, permission) !== null;
}
