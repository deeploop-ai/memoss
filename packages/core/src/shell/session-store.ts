import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ShellSessionState } from './session.js';

export function vaultSessionHash(vaultRoot: string): string {
  return createHash('sha256').update(resolve(vaultRoot)).digest('hex').slice(0, 16);
}

export function sessionFilePath(userConfigDir: string, vaultRoot: string): string {
  const sessionsDir = join(userConfigDir, 'sessions');
  mkdirSync(sessionsDir, { recursive: true });
  return join(sessionsDir, `${vaultSessionHash(vaultRoot)}.json`);
}

export function loadShellSession(
  userConfigDir: string,
  vaultRoot: string,
): ShellSessionState | undefined {
  const path = sessionFilePath(userConfigDir, vaultRoot);
  if (!existsSync(path)) {
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as ShellSessionState;
  } catch {
    return undefined;
  }
}

export function saveShellSession(
  userConfigDir: string,
  vaultRoot: string,
  state: ShellSessionState,
): void {
  const path = sessionFilePath(userConfigDir, vaultRoot);
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export function clearShellSession(
  userConfigDir: string,
  vaultRoot: string,
): void {
  const path = sessionFilePath(userConfigDir, vaultRoot);
  if (existsSync(path)) {
    writeFileSync(path, '', 'utf8');
  }
}
