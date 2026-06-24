import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { FsKnowledgeStore } from '../adapters/fs-store.js';
import { SimpleGitAdapter } from '../adapters/simple-git.js';
import { createDefaultVaultConfig } from '../config/vault-config.js';
import { MemossError } from '../errors.js';
import { PolicyRunner } from '../policies/runner.js';
import type { ToolContext } from './context.js';
import { createToolRegistry, TOOL_NAMES } from './registry.js';
import { searchKb } from './search-kb.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createContext(): ToolContext {
  const vaultRoot = mkdtempSync(join(tmpdir(), 'memoss-tools-'));
  tempDirs.push(vaultRoot);
  mkdirSync(join(vaultRoot, 'topics'), { recursive: true });

  return {
    store: new FsKnowledgeStore(vaultRoot),
    git: new SimpleGitAdapter(vaultRoot),
    config: createDefaultVaultConfig(),
    policies: new PolicyRunner(),
    draftMode: true,
  };
}

describe('createToolRegistry', () => {
  it('exposes all planned tools', () => {
    const registry = createToolRegistry(createContext());
    expect(Object.keys(registry).sort()).toEqual([...TOOL_NAMES].sort());
  });
});

describe('write_page policy chain', () => {
  it('enforces read-before-write and preserves frontmatter keys', async () => {
    const ctx = createContext();
    const registry = createToolRegistry(ctx);
    const path = 'topics/alpha.md';

    await ctx.store.writePage(path, {
      frontmatter: {
        type: 'Topic',
        title: 'Alpha',
        description: 'Original',
        custom_field: 'keep-me',
      },
      body: '# Alpha\n\nOriginal body content that is long enough.\n\n# Citations\n\n- https://example.com\n',
    });
    ctx.policies.reset();

    await expect(
      registry.write_page.execute?.({
        path,
        frontmatter: {
          type: 'Topic',
          title: 'Alpha',
          description: 'Updated',
        },
        body: 'tiny',
      }),
    ).rejects.toThrow(MemossError);

    await registry.read_page.execute?.({ path });

    const result = (await registry.write_page.execute?.({
      path,
      frontmatter: {
        type: 'Topic',
        title: 'Alpha',
        description: 'Updated',
      },
      body: 'tiny',
    })) as { warnings?: Array<{ code: string }>; written?: boolean };

    expect(result.written).toBe(true);
    expect(result.warnings?.some((w) => w.code === 'BODY_SHRUNK')).toBe(true);

    const saved = await ctx.store.readPage(path);
    expect(saved.frontmatter.custom_field).toBe('keep-me');
    expect(saved.frontmatter.description).toBe('Updated');
  });
});

describe('searchKb', () => {
  it('returns grep matches with line context', async () => {
    const ctx = createContext();
    writeFileSync(
      join(ctx.store.vaultRoot, 'topics', 'alpha.md'),
      '---\ntype: Topic\ntitle: Alpha\ndescription: Test\n---\n\nBitcoin blockchain data.\n',
      'utf8',
    );

    const results = await searchKb(ctx.store, 'bitcoin');
    expect(results).toHaveLength(1);
    expect(results[0]?.path).toBe('topics/alpha.md');
    expect(results[0]?.snippets[0]?.text).toContain('Bitcoin');
  });
});
