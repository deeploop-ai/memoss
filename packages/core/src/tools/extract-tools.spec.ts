import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { MemossError } from '../errors.js';
import { createDefaultVaultConfig } from '../config/vault-config.js';
import type { ExtractToolContext } from './extract-context.js';
import {
  createExtractCopyFileTool,
  createExtractWriteFileTool,
} from './extract-tools.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createExtractContext(): ExtractToolContext {
  const vaultRoot = mkdtempSync(join(tmpdir(), 'memoss-extract-tools-'));
  tempDirs.push(vaultRoot);
  mkdirSync(join(vaultRoot, 'sources', 'extracted'), { recursive: true });

  const config = createDefaultVaultConfig();
  return {
    vaultRoot,
    config,
    skills: new Map(),
    outputDir: config.extraction.output_dir,
    sourceUri: 'https://example.com/article',
  };
}

describe('createExtractWriteFileTool', () => {
  it('writes vault-relative paths under sources/extracted', async () => {
    const ctx = createExtractContext();
    const writeFile = createExtractWriteFileTool(ctx);
    const relativePath = `${ctx.outputDir}/example-com-article.md`;

    const result = await writeFile.execute!(
      { path: relativePath, content: '# Article' },
      { toolCallId: 'test', messages: [] },
    );

    const expected = resolve(ctx.vaultRoot, relativePath);
    expect(result.path).toBe(expected);
    expect(readFileSync(expected, 'utf8')).toBe('# Article');
  });

  it('writes basename-only paths into sources/extracted', async () => {
    const ctx = createExtractContext();
    const writeFile = createExtractWriteFileTool(ctx);

    await writeFile.execute!(
      { path: 'example-com-article.md', content: '# Article' },
      { toolCallId: 'test', messages: [] },
    );

    const expected = resolve(ctx.vaultRoot, ctx.outputDir, 'example-com-article.md');
    expect(readFileSync(expected, 'utf8')).toBe('# Article');
  });

  it('rejects script files under sources/extracted', async () => {
    const ctx = createExtractContext();
    const writeFile = createExtractWriteFileTool(ctx);

    await expect(
      writeFile.execute!(
        { path: 'extract_pdf.py', content: 'print(1)' },
        { toolCallId: 'test', messages: [] },
      ),
    ).rejects.toThrow(MemossError);
  });

  it('tracks written markdown paths on success', async () => {
    const ctx = createExtractContext();
    const writeFile = createExtractWriteFileTool(ctx);

    await writeFile.execute!(
      { path: 'example-com-article.md', content: '# Article' },
      { toolCallId: 'test', messages: [] },
    );

    expect(ctx.writtenMarkdownPaths).toEqual([
      'sources/extracted/example-com-article.md',
    ]);
  });
});

describe('createExtractCopyFileTool', () => {
  it('copies from skill directory into sources/extracted', async () => {
    const ctx = createExtractContext();
    const skillDir = mkdtempSync(join(tmpdir(), 'memoss-skill-'));
    tempDirs.push(skillDir);
    const scraped = join(skillDir, '.firecrawl', 'page.md');
    mkdirSync(join(skillDir, '.firecrawl'), { recursive: true });
    writeFileSync(scraped, '# Scraped page');
    ctx.activeSkillBaseDir = skillDir;

    const copyFile = createExtractCopyFileTool(ctx);
    const relativePath = `${ctx.outputDir}/example-com-article.md`;
    const result = await copyFile.execute!(
      { source: '.firecrawl/page.md', destination: relativePath },
      { toolCallId: 'test', messages: [] },
    );

    const expected = resolve(ctx.vaultRoot, relativePath);
    expect(result.destination).toBe(expected);
    expect(readFileSync(expected, 'utf8')).toBe('# Scraped page');
    expect(ctx.writtenMarkdownPaths).toEqual([relativePath.replace(/\\/g, '/')]);
  });
});
