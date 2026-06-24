import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { MemossError } from '../errors.js';

export interface DiscoverVaultOptions {
  cwd?: string;
  vaultPath?: string;
}

export function discoverVaultPath(options: DiscoverVaultOptions = {}): string {
  if (options.vaultPath) {
    const resolved = resolve(options.vaultPath);
    assertVault(resolved);
    return resolved;
  }

  const envPath = process.env.MEMOSS_VAULT_PATH;
  if (envPath) {
    const resolved = resolve(envPath);
    assertVault(resolved);
    return resolved;
  }

  let dir = resolve(options.cwd ?? process.cwd());
  while (true) {
    if (isVaultRoot(dir)) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  throw new MemossError(
    'VAULT_NOT_FOUND',
    'No vault found. Run from a vault directory or pass --vault / -C.',
  );
}

export function isVaultRoot(path: string): boolean {
  return existsSync(resolve(path, '.memoss', 'config.yaml'));
}

function assertVault(path: string): void {
  if (!isVaultRoot(path)) {
    throw new MemossError(
      'VAULT_NOT_FOUND',
      `No vault config at ${resolve(path, '.memoss', 'config.yaml')}`,
    );
  }
}
