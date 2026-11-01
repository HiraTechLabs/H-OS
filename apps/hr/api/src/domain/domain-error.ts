/**
 * A rule violation discovered by the domain. It carries a stable rule identifier so the API can
 * explain *why* an operation was refused (HHR-DOM-014: correctness with a clear explanation).
 */
export class DomainRuleViolation extends Error {
  constructor(
    readonly rule: string,
    message: string,
  ) {
    super(message);
    this.name = 'DomainRuleViolation';
  }
}

export function assertRule(condition: unknown, rule: string, message: string): asserts condition {
  if (!condition) {
    throw new DomainRuleViolation(rule, message);
  }
}
