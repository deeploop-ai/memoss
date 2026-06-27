import type { VaultConfig } from '../config/vault-config.js';
import { findFastPathScript } from './fast-path.js';
import type { SkillRecord, SkillScope } from './types.js';

const MEMOSS_SKILL_SCOPES = new Set<SkillScope>(['user-memoss', 'vault-memoss']);

/** Heuristic for shared .agents/skills installs (e.g. firecrawl) without memoss metadata. */
const EXTRACT_SIGNAL_RE =
  /\b(extract|scrape|crawl|fetch|convert|parse|pdf|docx|pptx|xlsx|markdown|html|webpage|web page|web site|website|url|document|transcript|ocr|firecrawl|readability|defuddle)\b/i;

function isConfigMappedSkill(name: string, config: VaultConfig): boolean {
  return (
    Object.values(config.extraction.skills).includes(name) ||
    Object.values(config.extraction.skill_overrides).includes(name)
  );
}

function describesExtractionCapability(record: SkillRecord): boolean {
  const text = `${record.name} ${record.description} ${record.compatibility ?? ''}`;
  return EXTRACT_SIGNAL_RE.test(text);
}

/**
 * Skills the Extract Agent can use to turn a path/URL into markdown or JSON.
 * Fast-path scripts (`scripts/extract.*`) are optional accelerants, not requirements.
 */
export function isExtractRelevantSkill(
  name: string,
  record: SkillRecord,
  config: VaultConfig,
): boolean {
  if (isConfigMappedSkill(name, config)) {
    return true;
  }
  if (MEMOSS_SKILL_SCOPES.has(record.scope)) {
    return true;
  }
  if (findFastPathScript(record.baseDir)) {
    return true;
  }
  return describesExtractionCapability(record);
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
