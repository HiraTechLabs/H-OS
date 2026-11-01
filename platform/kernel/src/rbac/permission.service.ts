import { Injectable } from '@nestjs/common';
import type { ScopeLevel } from '@h-os/contracts';
import type { Actor } from '../auth/actor.js';
import { scopeFor } from '../auth/actor.js';
import { ForbiddenError } from '../errors.js';

/**
 * Deny-by-default authorization checked in the backend at use-case level, per permission and per
 * data scope (SEC-002, HHR-SEC-001). Hiding UI controls is never considered protection.
 */
@Injectable()
export class PermissionService {
  scopeOf(actor: Actor, permission: string): ScopeLevel | null {
    return scopeFor(actor, permission);
  }

  can(actor: Actor, permission: string): boolean {
    return scopeFor(actor, permission) !== null;
  }

  /** Returns the granted scope or throws a forbidden error carrying no data about the record. */
  require(actor: Actor, permission: string): ScopeLevel {
    const scope = scopeFor(actor, permission);
    if (scope === null) {
      throw new ForbiddenError('You do not have permission to perform this action.');
    }
    return scope;
  }

  requireAny(actor: Actor, permissions: readonly string[]): ScopeLevel {
    let widest: ScopeLevel | null = null;
    const order: readonly ScopeLevel[] = ['own', 'unit', 'subtree', 'all'];
    for (const permission of permissions) {
      const scope = scopeFor(actor, permission);
      if (scope === null) continue;
      if (widest === null || order.indexOf(scope) > order.indexOf(widest)) widest = scope;
    }
    if (widest === null) {
      throw new ForbiddenError('You do not have permission to perform this action.');
    }
    return widest;
  }
}
