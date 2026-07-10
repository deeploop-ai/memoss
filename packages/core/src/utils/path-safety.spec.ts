import { describe, expect, it } from 'vitest';
import { resolveContainedPath } from './path-safety.js';

describe('path-safety', () => {
  const root = '/vault';

  it('resolves contained paths', () => {
    expect(resolveContainedPath(root, 'topics/foo.md')).toContain('topics');
  });

  it('rejects traversal', () => {
    expect(() => resolveContainedPath(root, '../etc/passwd')).toThrow(
      /traversal/i,
    );
  });
});
