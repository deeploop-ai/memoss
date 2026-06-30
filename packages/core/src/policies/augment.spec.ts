import { describe, expect, it } from 'vitest';
import { MemossError } from '../errors.js';
import { AugmentPolicy, mergeAugmentSources } from './augment.js';
import { parsePoliciesConfig } from './config.js';

function createPolicy() {
  return new AugmentPolicy(parsePoliciesConfig({}).augment);
}

describe('AugmentPolicy', () => {
  it('requires read_page before write_page', () => {
    const policy = createPolicy();
    expect(() => policy.assertReadFirst('topics/foo.md')).toThrow(MemossError);
    policy.markRead('topics/foo.md');
    expect(() => policy.assertReadFirst('topics/foo.md')).not.toThrow();
  });

  it('warns when body shrinks below 30%', () => {
    const policy = createPolicy();
    const violation = policy.checkBodyNotShrunk('x'.repeat(100), 'x'.repeat(10));
    expect(violation?.code).toBe('BODY_SHRUNK');
    expect(violation?.action).toBe('warn');
  });

  it('detects dropped headings', () => {
    const policy = createPolicy();
    const oldBody = '# Summary\n\nOld text.\n\n# Details\n\nMore.';
    const newBody = '# Summary\n\nNew only.';
    const violation = policy.checkHeadingsPreserved(oldBody, newBody);
    expect(violation?.code).toBe('HEADINGS_NOT_PRESERVED');
  });

  it('detects resource field changes', () => {
    const policy = createPolicy();
    const violation = policy.checkResourceUnchanged(
      { resource: 'https://example.com/a' },
      { resource: 'https://example.com/b' },
    );
    expect(violation?.code).toBe('RESOURCE_CHANGED');
  });
});

describe('mergeAugmentSources', () => {
  it('preserves existing sources and appends new ones by source_id', () => {
    const merged = mergeAugmentSources(
      [{ source_id: 'example-com-a', section: 'intro' }],
      [{ source_id: 'example-com-b' }],
      { source_id: 'example-com-c' },
    );

    expect(merged).toEqual([
      { source_id: 'example-com-a', section: 'intro' },
      { source_id: 'example-com-b' },
      { source_id: 'example-com-c' },
    ]);
  });

  it('merges incoming fields without dropping prior source_id entries', () => {
    const merged = mergeAugmentSources(
      [{ source_id: 'example-com-a' }],
      [{ source_id: 'example-com-a', section: 'details' }],
      { source_id: 'example-com-a' },
    );

    expect(merged).toEqual([{ source_id: 'example-com-a', section: 'details' }]);
  });
});
