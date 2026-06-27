import { MemossError } from '../errors.js';
import type { PolicyViolation } from './augment.js';

export function enforcePolicyViolation(violation: PolicyViolation): void {
  if (violation.action === 'error') {
    throw new MemossError('POLICY_VIOLATION', violation.message);
  }
}

export function violationToWarning(violation: PolicyViolation): {
  code: string;
  message: string;
} {
  return { code: violation.code, message: violation.message };
}
