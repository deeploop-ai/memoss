import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const TRUST_FILE = 'skill-trust.json';

export interface ProjectSkillTrust {
  trusted: boolean;
  trusted_at: string;
}

export function getProjectSkillTrustPath(vaultRoot: string): string {
  return join(vaultRoot, '.memoss', TRUST_FILE);
}

export function isProjectSkillsTrusted(
  vaultRoot: string,
  trustProjectSkills: boolean,
): boolean {
  if (trustProjectSkills) {
    return true;
  }
  const path = getProjectSkillTrustPath(vaultRoot);
  if (!existsSync(path)) {
    return false;
  }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as ProjectSkillTrust;
    return raw.trusted === true;
  } catch {
    return false;
  }
}

export function writeProjectSkillTrust(vaultRoot: string): ProjectSkillTrust {
  const memossDir = join(vaultRoot, '.memoss');
  mkdirSync(memossDir, { recursive: true });
  const record: ProjectSkillTrust = {
    trusted: true,
    trusted_at: new Date().toISOString(),
  };
  writeFileSync(
    getProjectSkillTrustPath(vaultRoot),
    `${JSON.stringify(record, null, 2)}\n`,
    'utf8',
  );
  return record;
}

export function readProjectSkillTrust(
  vaultRoot: string,
): ProjectSkillTrust | undefined {
  const path = getProjectSkillTrustPath(vaultRoot);
  if (!existsSync(path)) {
    return undefined;
  }
  return JSON.parse(readFileSync(path, 'utf8')) as ProjectSkillTrust;
}
