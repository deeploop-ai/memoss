import { describe, expect, it } from 'vitest';
import { createDefaultVaultConfig } from '../config/vault-config.js';
import {
  filterExtractRelevantSkills,
  hasExtractRelevantSkills,
  isExtractRelevantSkill,
} from './extract-relevant.js';
import type { SkillRecord } from './types.js';

function skill(
  name: string,
  baseDir: string,
  overrides: Partial<SkillRecord> = {},
): SkillRecord {
  return {
    name,
    description: 'test',
    location: `${baseDir}/SKILL.md`,
    baseDir,
    scope: 'user-agents',
    ...overrides,
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

  it('treats agent skills with extraction descriptions as extract-relevant without scripts', () => {
    const record = skill('firecrawl', '/tmp/firecrawl', {
      description:
        'Search, scrape, and interact with the web via the Firecrawl CLI.',
    });
    expect(isExtractRelevantSkill('firecrawl', record, config)).toBe(true);
    expect(
      hasExtractRelevantSkills(new Map([['firecrawl', record]]), config),
    ).toBe(true);
  });

  it('ignores unrelated IDE skills without extraction signals', () => {
    const record = skill('nx-workspace', '/tmp/nx-workspace', {
      description: 'Explore and understand Nx workspaces.',
    });
    expect(isExtractRelevantSkill('nx-workspace', record, config)).toBe(false);
    expect(
      hasExtractRelevantSkills(
        new Map([['nx-workspace', record]]),
        config,
      ),
    ).toBe(false);
  });

  it('treats memoss-scoped skills as extract-relevant', () => {
    const record = skill('custom', '/tmp/custom', {
      scope: 'user-memoss',
      description: 'Generic helper.',
    });
    expect(isExtractRelevantSkill('custom', record, config)).toBe(true);
  });

  it('filters catalog to extract-relevant skills only', () => {
    const skills = new Map([
      ['defuddle', skill('defuddle', '/tmp/defuddle')],
      [
        'firecrawl',
        skill('firecrawl', '/tmp/firecrawl', {
          description: 'Scrape webpages to markdown.',
        }),
      ],
      [
        'nx-workspace',
        skill('nx-workspace', '/tmp/nx-workspace', {
          description: 'Explore and understand Nx workspaces.',
        }),
      ],
    ]);
    const filtered = filterExtractRelevantSkills(skills, config);
    expect([...filtered.keys()]).toEqual(['defuddle', 'firecrawl']);
  });
});
