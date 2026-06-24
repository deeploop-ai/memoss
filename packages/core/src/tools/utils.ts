import type { OKFFrontmatter } from '../okf/types.js';
import type { PolicyWarning } from '../policies/types.js';

export function normalizeToolPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\/+/, '');
}

export function mergeFrontmatter(
  existing: OKFFrontmatter,
  incoming: OKFFrontmatter,
): OKFFrontmatter {
  return { ...existing, ...incoming };
}

export function toolResult(
  data: Record<string, unknown>,
  warnings: PolicyWarning[] = [],
): Record<string, unknown> {
  if (warnings.length === 0) {
    return data;
  }
  return { ...data, warnings };
}
