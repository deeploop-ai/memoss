import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TOOL_NAMES,
  getToolInputSchema,
  pathSchema,
  runIngestSchema,
  runExtractSchema,
  runQuerySchema,
} from '@memoss/core';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  createMemossMcpContext,
  createMemossMcpServer,
  MCP_TOOL_NAMES,
  registerMemossTools,
} from './mcp-tools.js';
import { resolveMcpToolNames } from './capabilities.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createVault(): string {
  const root = mkdtempSync(join(tmpdir(), 'memoss-mcp-'));
  tempDirs.push(root);
  mkdirSync(join(root, '.memoss'), { recursive: true });
  mkdirSync(join(root, 'topics'), { recursive: true });
  writeFileSync(
    join(root, '.memoss', 'config.yaml'),
    [
      'name: mcp-vault',
      'okf_version: "0.1"',
      'schema_pack: research',
      'agent:',
      '  default_model:',
      '    provider: anthropic',
      '    model: claude-sonnet-4-6',
      '  lightweight_model:',
      '    provider: anthropic',
      '    model: claude-haiku-4-5',
      '  max_steps: 10',
      '  temperature: 0.2',
      'git:',
      '  enabled: false',
      '  auto_commit: false',
      '  draft_branch: false',
      'search:',
      '  strategy: auto',
      '  hybrid_threshold_pages: 200',
      'provenance:',
      '  enabled: false',
      '  track_source_hash: false',
    ].join('\n'),
    'utf8',
  );
  writeFileSync(
    join(root, 'topics', 'alpha.md'),
    '---\ntype: Topic\ntitle: Alpha\ndescription: Test topic\n---\n\n# Alpha\n',
    'utf8',
  );
  return root;
}

describe('MCP tool inventory', () => {
  it('exposes all core tools plus runners', () => {
    expect(MCP_TOOL_NAMES).toHaveLength(TOOL_NAMES.length + 4);
    expect(MCP_TOOL_NAMES).toContain('run_extract');
    expect(MCP_TOOL_NAMES).toContain('read_page');
  });

  it('attaches Zod schemas to core tools', () => {
    const vaultRoot = createVault();
    const { registry } = createMemossMcpContext(vaultRoot);
    const schema = getToolInputSchema(registry.read_page);
    expect(() => schema.parse({ path: 'topics/alpha.md' })).not.toThrow();
    expect(() => schema.parse({})).toThrow();
  });

  it('validates runner schemas', () => {
    expect(() =>
      runIngestSchema.parse({ source: 'https://example.com', kind: 'web' }),
    ).not.toThrow();
    expect(() => runQuerySchema.parse({ question: 'What is Alpha?' })).not.toThrow();
    expect(() =>
      runExtractSchema.parse({ source: 'https://example.com/article' }),
    ).not.toThrow();
    expect(() => pathSchema.parse({})).toThrow();
  });
});

describe('registerMemossTools', () => {
  it('registers only agent tools by default', async () => {
    const vaultRoot = createVault();
    const ctx = createMemossMcpContext(vaultRoot);
    const handlers = new Map<string, (args: Record<string, unknown>) => Promise<unknown>>();

    const mockServer = {
      registerTool: vi.fn(
        (
          name: string,
          _config: unknown,
          handler: (args: Record<string, unknown>) => Promise<unknown>,
        ) => {
          handlers.set(name, handler);
        },
      ),
    } as unknown as McpServer;

    registerMemossTools(mockServer, ctx, {
      runIngest: async () => ({ ok: true }),
      runExtract: async () => ({ ok: true }),
      runQuery: async () => ({ answer: 'test' }),
      runLint: async () => ({ issues: [] }),
    });

    expect(mockServer.registerTool).toHaveBeenCalledTimes(4);
    expect(handlers.has('run_query')).toBe(true);
    expect(handlers.has('read_page')).toBe(false);
  });

  it('registers read tools when read capability is enabled', async () => {
    const vaultRoot = createVault();
    const ctx = createMemossMcpContext(vaultRoot);
    const handlers = new Map<string, (args: Record<string, unknown>) => Promise<unknown>>();

    const mockServer = {
      registerTool: vi.fn(
        (
          name: string,
          _config: unknown,
          handler: (args: Record<string, unknown>) => Promise<unknown>,
        ) => {
          handlers.set(name, handler);
        },
      ),
    } as unknown as McpServer;

    registerMemossTools(
      mockServer,
      ctx,
      {
        runIngest: async () => ({ ok: true }),
        runExtract: async () => ({ ok: true }),
        runQuery: async () => ({ answer: 'test' }),
        runLint: async () => ({ issues: [] }),
      },
      ['agent', 'read'],
    );

    expect(mockServer.registerTool).toHaveBeenCalledTimes(
      resolveMcpToolNames(['agent', 'read']).length,
    );

    const readPage = handlers.get('read_page');
    expect(readPage).toBeDefined();
    const result = await readPage!({ path: 'topics/alpha.md' });
    const text = result.content[0]?.text;
    expect(text).toContain('"title": "Alpha"');
  });
});

describe('createMemossMcpServer', () => {
  it('constructs an MCP server for a vault', () => {
    const vaultRoot = createVault();
    const server = createMemossMcpServer(vaultRoot);
    expect(server).toBeInstanceOf(McpServer);
  });
});
