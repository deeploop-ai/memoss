import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runQuery } from './query-runner.js';
import { runIngest } from './ingest-runner.js';
import { runValidate } from './validate-runner.js';
import { MemossError } from '../errors.js';

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

vi.mock('./model-registry.js', () => ({
  resolveModel: vi.fn(() => ({ modelId: 'mock-model' })),
  parseModelOverride: vi.fn(),
}));

import { generateText } from 'ai';

const mockedGenerateText = vi.mocked(generateText);
const tempDirs: string[] = [];

afterEach(() => {
  vi.clearAllMocks();
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createVault(): string {
  const root = mkdtempSync(join(tmpdir(), 'memoss-runner-'));
  tempDirs.push(root);
  mkdirSync(join(root, '.memoss'), { recursive: true });
  mkdirSync(join(root, 'topics'), { recursive: true });
  writeFileSync(
    join(root, '.memoss', 'config.yaml'),
    [
      'name: runner-vault',
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
      '  enabled: true',
      '  auto_commit: true',
      '  draft_branch: true',
      'search:',
      '  strategy: auto',
      '  hybrid_threshold_pages: 200',
      'provenance:',
      '  enabled: false',
      '  track_source_hash: false',
    ].join('\n'),
  );
  writeFileSync(join(root, '.memoss', 'instructions.md'), 'Test instructions.');
  writeFileSync(join(root, 'index.md'), '# Index\n');
  return root;
}

describe('runQuery', () => {
  it('throws when vault is missing', async () => {
    await expect(
      runQuery({ vaultRoot: '/nonexistent/vault', question: 'hello?' }),
    ).rejects.toThrow(MemossError);
  });

  it('calls generateText with query system prompt and lightweight tools', async () => {
    mockedGenerateText.mockResolvedValue({
      text: 'Answer with citation.',
      finishReason: 'stop',
      steps: [],
    } as Awaited<ReturnType<typeof generateText>>);

    const vaultRoot = createVault();
    const result = await runQuery({
      vaultRoot,
      question: 'What is in the vault?',
    });

    expect(result.status).toBe('complete');
    expect(result.text).toBe('Answer with citation.');
    expect(mockedGenerateText).toHaveBeenCalledOnce();

    const call = mockedGenerateText.mock.calls[0][0];
    expect(call.prompt).toBe('What is in the vault?');
    expect(call.system).toContain('Query Agent');
    expect(call.system).toContain('runner-vault');
    expect(call.tools).toHaveProperty('read_page');
    expect(call.tools).not.toHaveProperty('write_page');
  });

  it('includes write tools when save is enabled', async () => {
    mockedGenerateText.mockResolvedValue({
      text: 'Saved.',
      finishReason: 'stop',
      steps: [],
    } as Awaited<ReturnType<typeof generateText>>);

    const vaultRoot = createVault();
    await runQuery({
      vaultRoot,
      question: 'Summarize topics',
      save: true,
    });

    const call = mockedGenerateText.mock.calls[0][0];
    expect(call.tools).toHaveProperty('write_page');
    expect(call.system).toContain('Save mode');
  });
});

describe('runIngest', () => {
  it('creates draft branch and passes ingest tools', async () => {
    mockedGenerateText.mockResolvedValue({
      text: 'Ingest complete.',
      finishReason: 'stop',
      steps: [],
    } as Awaited<ReturnType<typeof generateText>>);

    const vaultRoot = createVault();
    const result = await runIngest({
      vaultRoot,
      source: 'https://example.com/article',
      kind: 'web',
      extract: false,
      skipValidate: true,
    });

    expect(result.status).toBe('complete');
    expect(result.draftBranch).toMatch(/^memoss\/draft\/ingest-/);

    const call = mockedGenerateText.mock.calls[0][0];
    expect(call.system).toContain('Ingest Agent');
    expect(call.tools).toHaveProperty('read_source');
    expect(call.tools).toHaveProperty('git_commit');
    expect(call.prompt).toContain('https://example.com/article');
  });

  it('aborts ingest when pre-validation rejects content', async () => {
    const vaultRoot = createVault();
    const badPath = join(vaultRoot, 'bad-source.md');
    writeFileSync(
      badPath,
      '<!DOCTYPE html><html><head><script></script></head><body>Page</body></html>',
    );

    const result = await runIngest({
      vaultRoot,
      source: badPath,
      kind: 'file',
      extract: false,
    });

    expect(result.status).toBe('rejected');
    expect(result.validation?.method).toBe('heuristic');
    expect(mockedGenerateText).not.toHaveBeenCalled();
  });
});

describe('runValidate', () => {
  it('rejects raw HTML via heuristics without calling the model', async () => {
    const vaultRoot = createVault();
    const badPath = join(vaultRoot, 'bad-source.md');
    writeFileSync(
      badPath,
      '<!DOCTYPE html><html><head><script></script></head><body>Page</body></html>',
    );

    const result = await runValidate({
      vaultRoot,
      source: badPath,
      kind: 'file',
    });

    expect(result.approved).toBe(false);
    expect(result.method).toBe('heuristic');
    expect(mockedGenerateText).not.toHaveBeenCalled();
  });

  it('uses the validation agent when heuristics pass', async () => {
    mockedGenerateText.mockImplementation(async (opts) => {
      const step = {
        text: 'Approved.',
        toolCalls: [
          {
            toolName: 'report_validation',
            input: {
              approved: true,
              summary: 'Content looks suitable.',
              issues: [],
            },
          },
        ],
      };
      opts.onStepFinish?.(step as never);
      return {
        text: 'Approved.',
        finishReason: 'stop',
        steps: [step],
      } as Awaited<ReturnType<typeof generateText>>;
    });

    const vaultRoot = createVault();
    const sourcePath = join(vaultRoot, 'good-source.md');
    writeFileSync(
      sourcePath,
      [
        '# Event Router',
        '',
        'Go 实现的 DAG 事件路由器，支持 Source → Transform → Sink 拓扑处理流式数据。',
        '文档包含配置说明、部署方式与可观测性指标。',
      ].join('\n'),
    );

    const result = await runValidate({
      vaultRoot,
      source: sourcePath,
      kind: 'file',
    });

    expect(result.approved).toBe(true);
    expect(result.method).toBe('agent');
    expect(mockedGenerateText).toHaveBeenCalledOnce();
    const call = mockedGenerateText.mock.calls[0][0];
    expect(call.system).toContain('Validate Agent');
    expect(call.tools).toHaveProperty('report_validation');
  });
});
