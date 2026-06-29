import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanupExtractArtifacts } from './cleanup-artifacts.js';
import {
  normalizeExtractOutputPath,
  resolveExtractMarkdownOutput,
  resolveSkillLocalExtractOutput,
} from './resolve-output.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createVault(): string {
  const vaultRoot = mkdtempSync(join(tmpdir(), 'memoss-extract-cleanup-'));
  tempDirs.push(vaultRoot);
  mkdirSync(join(vaultRoot, 'sources', 'extracted'), { recursive: true });
  return vaultRoot;
}

describe('cleanupExtractArtifacts', () => {
  it('removes scripts but keeps markdown and meta sidecars', () => {
    const vaultRoot = createVault();
    const outputDir = 'sources/extracted';
    writeFileSync(join(vaultRoot, outputDir, 'report.md'), '# Report');
    writeFileSync(join(vaultRoot, outputDir, 'report.meta.json'), '{}');
    writeFileSync(join(vaultRoot, outputDir, 'extract_pdf.py'), 'print(1)');

    const result = cleanupExtractArtifacts(vaultRoot, outputDir);
    expect(result.removed).toEqual(['sources/extracted/extract_pdf.py']);
    expect(readFileSync(join(vaultRoot, outputDir, 'report.md'), 'utf8')).toBe(
      '# Report',
    );
  });
});

describe('resolveExtractMarkdownOutput', () => {
  it('finds markdown nested under the output directory', () => {
    const vaultRoot = createVault();
    const outputDir = 'sources/extracted';
    const expected = resolve(vaultRoot, outputDir, 'llm-deadbeef.md');
    const nested = join(vaultRoot, outputDir, 'tmp', 'llm-deadbeef.md');
    mkdirSync(join(vaultRoot, outputDir, 'tmp'), { recursive: true });
    writeFileSync(nested, '# PDF text');

    const discovered = resolveExtractMarkdownOutput(
      vaultRoot,
      outputDir,
      expected,
    );
    expect(discovered?.replace(/\\/g, '/')).toBe(nested.replace(/\\/g, '/'));
  });

  it('normalizes discovered output to the canonical path', () => {
    const vaultRoot = createVault();
    const outputDir = 'sources/extracted';
    const expected = resolve(vaultRoot, outputDir, 'llm-deadbeef.md');
    const nested = join(vaultRoot, outputDir, 'tmp', 'llm-deadbeef.md');
    mkdirSync(join(vaultRoot, outputDir, 'tmp'), { recursive: true });
    writeFileSync(nested, '# PDF text');

    normalizeExtractOutputPath(expected, nested);
    expect(readFileSync(expected, 'utf8')).toBe('# PDF text');
  });
});

describe('resolveSkillLocalExtractOutput', () => {
  it('finds markdown misplaced under skill sources/extracted', () => {
    const vaultRoot = createVault();
    const skillDir = mkdtempSync(join(tmpdir(), 'memoss-skill-local-'));
    tempDirs.push(skillDir);
    const expected = resolve(vaultRoot, 'sources/extracted', 'example-com.md');
    const misplaced = join(
      skillDir,
      'sources',
      'extracted',
      'example-com.md',
    );
    mkdirSync(dirname(misplaced), { recursive: true });
    writeFileSync(misplaced, '# Misplaced');

    const discovered = resolveSkillLocalExtractOutput(skillDir, expected);
    expect(discovered?.replace(/\\/g, '/')).toBe(misplaced.replace(/\\/g, '/'));
  });

  it('finds a single firecrawl scrape output under .firecrawl', () => {
    const vaultRoot = createVault();
    const skillDir = mkdtempSync(join(tmpdir(), 'memoss-skill-firecrawl-'));
    tempDirs.push(skillDir);
    const expected = resolve(vaultRoot, 'sources/extracted', 'example-com.md');
    const scraped = join(skillDir, '.firecrawl', 'page.md');
    mkdirSync(join(skillDir, '.firecrawl'), { recursive: true });
    writeFileSync(scraped, '# Firecrawl');

    const discovered = resolveSkillLocalExtractOutput(skillDir, expected);
    expect(discovered?.replace(/\\/g, '/')).toBe(scraped.replace(/\\/g, '/'));
  });
});
