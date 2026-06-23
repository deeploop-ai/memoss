import { describe, expect, it } from 'vitest';
import { CORE_VERSION } from '@memoss/core';

describe('@memoss/cli', () => {
  it('resolves core dependency', () => {
    expect(CORE_VERSION).toBe('0.0.1');
  });
});
