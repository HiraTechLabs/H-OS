import { assertRule } from './domain-error.js';

/**
 * `ltree` labels accept letters, digits and underscores. Org unit codes are user-facing and use
 * dashes, so the path label is derived deterministically from the code.
 */
const CODE_PATTERN = /^[A-Z0-9-]+$/;

export function isOrgUnitCode(value: string): boolean {
  return CODE_PATTERN.test(value) && value.length >= 2 && value.length <= 32;
}

export function labelFor(code: string): string {
  assertRule(isOrgUnitCode(code), 'HR-ORG-001', 'Org unit code is not valid.');
  return code.toLowerCase().replace(/-/g, '_');
}

/** Child path is `parentPath.label`, or just `label` for a root unit. */
export function childPath(parentPath: string | null, code: string): string {
  const label = labelFor(code);
  return parentPath === null ? label : `${parentPath}.${label}`;
}

export function isDescendantPath(candidate: string, ancestor: string): boolean {
  return candidate === ancestor || candidate.startsWith(`${ancestor}.`);
}
