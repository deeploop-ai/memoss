import { describe, expect, it } from 'vitest';
import { createDefaultVaultConfig } from '../config/vault-config.js';
import {
  filterExtractRelevantSkills,
  hasExtractRelevantSkills,
  isExtractRelevantSkill,
} from './extract-relevant.js';
import type { SkillRecord } from './types.js';

function skill(name: string, baseDir: string): SkillRecord {
  return {
    name,
    description: 'test',
    location: `${baseDir}/SKILL.md`,
    baseDir,
    scope: 'user-agents',
  };
}

describe('extract-relevant', () => {
  const config = createDefaultVaultConfig({
    extraction: {
      enabled: true,
      auto_select: true,
      cache: true,
      output_dir: 'sources/extracted',
      skills: { web: 'defuddle' },
      skill_overrides: {},
      max_steps: 15,
      bash_timeout_ms: 120_000,
      trust_project_skills: false,
      fast_path: true,
    },
  });

  it('treats config-mapped skills as extract-relevant', () => {
    const record = skill('defuddle', '/tmp/defuddle');
    expect(isExtractRelevantSkill('defuddle', record, config)).toBe(true);
  });

  it('ignores unrelated IDE skills without extract scripts', () => {
    const record = skill('nx-workspace', '/tmp/nx-workspace');
    expect(isExtractRelevantSkill('nx-workspace', record, config)).toBe(false);
    expect(
      hasExtractRelevantSkills(
        new Map([['nx-workspace', record]]),
        config,
      ),
    ).toBe(false);
  });

  it('filters catalog to extract-relevant skills only', () => {
    const skills = new Map([
      ['defuddle', skill('defuddle', '/tmp/defuddle')],
      ['nx-workspace', skill('nx-workspace', '/tmp/nx-workspace')],
    ]);
    const filtered = filterExtractRelevantSkills(skills, config);
    expect([...filtered.keys()]).toEqual(['defuddle']);
  });
});
