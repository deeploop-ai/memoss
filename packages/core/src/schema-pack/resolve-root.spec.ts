import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { resolveSchemaPacksRoot } from './resolve-root.js';

describe('resolveSchemaPacksRoot', () => {
  it('finds workspace schema-packs from cwd', () => {
    const root = resolveSchemaPacksRoot();
    expect(root.replace(/\\/g, '/')).toMatch(/schema-packs$/);
  });

  it('honors explicit override', () => {
    const root = resolveSchemaPacksRoot(join(process.cwd(), 'schema-packs'));
    expect(root.replace(/\\/g, '/')).toMatch(/schema-packs$/);
  });
});
