import type { SessionUser } from '@h-os/contracts';
import type { Actor } from '@h-os/kernel';

/**
 * The wire representation of the signed-in caller. It carries permissions and data scopes so the
 * UI can hide inapplicable actions — never as a substitute for backend checks (SEC-002).
 */
export function toSessionUser(actor: Actor): SessionUser {
  return {
    accountId: actor.accountId,
    displayName: actor.displayName,
    email: actor.email,
    locale: actor.locale,
    roles: [...actor.roles],
    grants: actor.grants.map((grant) => ({ permission: grant.permission, scope: grant.scope })),
  };
}
