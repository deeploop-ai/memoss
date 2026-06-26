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

/** User-level Memoss skills (`~/.memoss/skills/`). */
export function getUserMemossSkillsDir(): string {
  return join(getUserConfigDir(), 'skills');
}

/** User-level canonical agent skills (`~/.agents/skills/`). */
export function getUserAgentsSkillsDir(): string {
  return join(homedir(), '.agents', 'skills');
}
