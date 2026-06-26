import type { VaultConfig } from '../config/vault-config.js';
import { findFastPathScript } from './fast-path.js';
import type { SkillRecord } from './types.js';

/** Skills that can plausibly extract content (fast-path script or explicit config mapping). */
export function isExtractRelevantSkill(
  name: string,
  record: SkillRecord,
  config: VaultConfig,
): boolean {
  if (findFastPathScript(record.baseDir)) {
    return true;
  }
  if (Object.values(config.extraction.skills).includes(name)) {
    return true;
  }
  if (Object.values(config.extraction.skill_overrides).includes(name)) {
    return true;
  }
  return false;
}

export function filterExtractRelevantSkills(
  skills: Map<string, SkillRecord>,
  config: VaultConfig,
): Map<string, SkillRecord> {
  const filtered = new Map<string, SkillRecord>();
  for (const [name, record] of skills) {
    if (isExtractRelevantSkill(name, record, config)) {
      filtered.set(name, record);
    }
  }
  return filtered;
}

export function hasExtractRelevantSkills(
  skills: Map<string, SkillRecord>,
  config: VaultConfig,
): boolean {
  return filterExtractRelevantSkills(skills, config).size > 0;
}
