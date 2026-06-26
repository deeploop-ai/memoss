import { homedir } from 'node:os';
import { join } from 'node:path';

/** Default vault location when none is specified (`~/.memoss-vault`). */
export function getDefaultVaultPath(): string {
  return join(homedir(), '.memoss-vault');
}

/** User-level shared Memoss config directory (`~/.memoss`). */
export function getUserConfigDir(): string {
  return join(homedir(), '.memoss');
}

/** User-level shared config file (`~/.memoss/config.yaml`). */
export function getUserConfigPath(): string {
  return join(getUserConfigDir(), 'config.yaml');
}
