import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemossError } from '../errors.js';

function existsDir(path: string): boolean {
  return existsSync(path);
}

/** Locate bundled or workspace schema-packs for init/rebuild. */
export function resolveSchemaPacksRoot(override?: string): string {
  if (override && existsDir(override)) {
    return override;
  }

  const envRoot = process.env.MEMOSS_SCHEMA_PACKS_ROOT;
  if (envRoot && existsDir(envRoot)) {
    return envRoot;
  }

  const moduleDir = dirname(fileURLToPath(import.meta.url));

  const candidates = [
    join(moduleDir, '..', 'schema-packs'),
    join(moduleDir, '..', '..', '..', '..', 'schema-packs'),
  ];

  for (const candidate of candidates) {
    if (existsDir(candidate)) {
      return candidate;
    }
  }

  let dir = process.cwd();
  while (true) {
    const candidate = join(dir, 'schema-packs');
    if (existsDir(candidate)) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  throw new MemossError(
    'VAULT_NOT_FOUND',
    'Could not locate schema-packs directory. Set MEMOSS_SCHEMA_PACKS_ROOT or reinstall @memoss/core.',
  );
}

export type SchemaPackName = 'research' | 'personal' | 'data-catalog';
