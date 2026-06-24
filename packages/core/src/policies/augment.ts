import { MemossError } from '../errors.js';
import type { PolicyWarning } from './types.js';

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\/+/, '');
}

export class AugmentPolicy {
  private readonly readPaths = new Set<string>();

  reset(): void {
    this.readPaths.clear();
  }

  markRead(path: string): void {
    this.readPaths.add(normalizePath(path));
  }

  assertReadFirst(path: string): void {
    const normalized = normalizePath(path);
    if (!this.readPaths.has(normalized)) {
      throw new MemossError(
        'POLICY_VIOLATION',
        `read_page must be called before write_page for ${normalized}`,
      );
    }
  }

  checkBodyNotShrunk(oldBody: string, newBody: string): PolicyWarning | undefined {
    const oldLength = oldBody.trim().length;
    const newLength = newBody.trim().length;
    if (oldLength === 0) {
      return undefined;
    }
    if (newLength < oldLength * 0.3) {
      const ratio = Math.round((newLength / oldLength) * 100);
      return {
        code: 'BODY_SHRUNK',
        message: `Page body shrank to ${ratio}% of the previous length`,
      };
    }
    return undefined;
  }
}
