import { describe, expect, it } from 'vitest';
import { MemossError } from '../errors.js';
import { AugmentPolicy } from './augment.js';

describe('AugmentPolicy', () => {
  it('requires read_page before write_page', () => {
    const policy = new AugmentPolicy();
    expect(() => policy.assertReadFirst('topics/foo.md')).toThrow(MemossError);
    policy.markRead('topics/foo.md');
    expect(() => policy.assertReadFirst('topics/foo.md')).not.toThrow();
  });

  it('warns when body shrinks below 30%', () => {
    const policy = new AugmentPolicy();
    const warning = policy.checkBodyNotShrunk('x'.repeat(100), 'x'.repeat(10));
    expect(warning?.code).toBe('BODY_SHRUNK');
  });
});
