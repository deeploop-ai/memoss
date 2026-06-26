import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CORE_VERSION } from './version.js';

describe('CORE_VERSION', () => {
  it('reads the core package version from package.json', () => {
    const pkg = JSON.parse(
      readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'),
    ) as { version: string };
    expect(CORE_VERSION).toBe(pkg.version);
  });
});
