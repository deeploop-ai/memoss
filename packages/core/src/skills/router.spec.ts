import { describe, expect, it } from 'vitest';
import { createDefaultVaultConfig } from '../config/vault-config.js';
import { resolveExtractRoute } from './router.js';

describe('resolveExtractRoute', () => {
  const baseConfig = createDefaultVaultConfig({
    extraction: {
      enabled: true,
      auto_select: true,
      cache: true,
      output_dir: 'sources/extracted',
      skills: { web: 'defuddle', pdf: 'pdf' },
      skill_overrides: {},
      max_steps: 15,
      bash_timeout_ms: 120_000,
      trust_project_skills: false,
    },
  });

  it('prefers CLI skill override', () => {
    const { route } = resolveExtractRoute({
      source: 'https://example.com',
      config: baseConfig,
      skillCli: 'firecrawl-scrape',
    });
    expect(route).toEqual({
      mode: 'skill',
      skillName: 'firecrawl-scrape',
      source: 'cli',
    });
  });

  it('uses config mapping by extract kind', () => {
    const { route, extractKind } = resolveExtractRoute({
      source: 'https://example.com/article',
      config: baseConfig,
    });
    expect(extractKind).toBe('web');
    expect(route).toEqual({
      mode: 'skill',
      skillName: 'defuddle',
      source: 'config',
    });
  });

  it('skips markdown without explicit skill', () => {
    const { route } = resolveExtractRoute({
      source: './notes/readme.md',
      config: baseConfig,
    });
    expect(route).toEqual({ mode: 'skip', source: 'skip' });
  });

  it('falls back when auto_select is disabled and no mapping', () => {
    const config = createDefaultVaultConfig({
      extraction: {
        ...baseConfig.extraction,
        auto_select: false,
        skills: {},
      },
    });
    const { route } = resolveExtractRoute({
      source: 'https://example.com',
      config,
    });
    expect(route).toEqual({ mode: 'fallback', source: 'fallback' });
  });

  it('uses auto mode when no mapping and auto_select enabled', () => {
    const config = createDefaultVaultConfig({
      extraction: {
        ...baseConfig.extraction,
        skills: {},
      },
    });
    const { route } = resolveExtractRoute({
      source: 'https://example.com',
      config,
    });
    expect(route).toEqual({ mode: 'auto', source: 'auto' });
  });

  it('uses skill override when configured', () => {
    const config = createDefaultVaultConfig({
      extraction: {
        ...baseConfig.extraction,
        skills: {},
        skill_overrides: {
          'https://docs.example.com/*': 'docs-scraper',
        },
      },
    });
    const { route } = resolveExtractRoute({
      source: 'https://docs.example.com/guide',
      config,
    });
    expect(route).toEqual({
      mode: 'skill',
      skillName: 'docs-scraper',
      source: 'override',
    });
  });
});
