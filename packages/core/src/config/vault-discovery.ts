import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { MemossError } from '../errors.js';
import { getDefaultVaultPath, getUserConfigDir } from './user-paths.js';

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

  const cwd = resolve(options.cwd ?? process.cwd());
  const ancestorVault = findVaultInAncestors(cwd);
  if (ancestorVault) {
    return ancestorVault;
  }

  const defaultVault = resolve(getDefaultVaultPath());
  if (isVaultRoot(defaultVault)) {
    return defaultVault;
  }

  throw new MemossError(
    'VAULT_NOT_FOUND',
    'No vault found. Run `memoss init` to create a default vault at ~/.memoss-vault, or pass --vault / -C.',
  );
}

/** Walk from `startDir` up to the filesystem root looking for a vault. */
export function findVaultInAncestors(startDir: string): string | undefined {
  let dir = resolve(startDir);
  while (true) {
    if (isVaultRoot(dir)) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
}

export function isVaultRoot(path: string): boolean {
  const resolved = resolve(path);
  const memossDir = resolve(resolved, '.memoss');
  // ~/.memoss holds user-level shared config, not a vault root.
  if (memossDir === resolve(getUserConfigDir())) {
    return false;
  }
  return existsSync(resolve(memossDir, 'config.yaml'));
}

function assertVault(path: string): void {
  if (!isVaultRoot(path)) {
    throw new MemossError(
      'VAULT_NOT_FOUND',
      `No vault config at ${resolve(path, '.memoss', 'config.yaml')}`,
    );
  }
}
