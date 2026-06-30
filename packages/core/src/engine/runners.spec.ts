import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runQuery } from './query-runner.js';
import { runIngest } from './ingest-runner.js';
import { runValidate } from './validate-runner.js';
import { runLintDeterministic } from './lint-runner.js';
import { FsKnowledgeStore } from '../adapters/fs-store.js';
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
      skipTuning: true,
    });

    expect(result.status).toBe('complete');
    expect(result.draftBranch).toMatch(/^memoss\/draft\/ingest-/);

    const ingestCall = mockedGenerateText.mock.calls.at(-1)?.[0];
    expect(ingestCall?.system).toContain('Ingest Agent');
    expect(ingestCall?.tools).toHaveProperty('read_source');
    expect(ingestCall?.tools).toHaveProperty('git_commit');
    expect(ingestCall?.prompt).toContain('https://example.com/article');
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

  it('rejects broken PDF extraction via heuristics without calling the model', async () => {
    const vaultRoot = createVault();
    const badPath = join(vaultRoot, 'broken-pdf.md');
    const lines: string[] = [];
    for (let i = 0; i < 120; i += 1) {
      lines.push('w', 'i', '∈', 'w', '1:N');
      lines.push(`1.${i % 9}.${i % 3}  n-grams. . . . . . . . . . . . . . . . . . ${i}`);
    }
    writeFileSync(badPath, lines.join('\n'));

    const result = await runValidate({
      vaultRoot,
      source: badPath,
      kind: 'file',
      extracted: true,
    });

    expect(result.approved).toBe(false);
    expect(result.method).toBe('heuristic');
    expect(result.issues.some((i) => i.includes('broken PDF'))).toBe(true);
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

describe('E2E: ingest → query → lint pipeline', () => {
  it('full pipeline with mock model: ingest creates draft, query answers, lint scores', async () => {
    mockedGenerateText.mockResolvedValue({
      text: 'Ingest complete.',
      finishReason: 'stop',
      steps: [],
    } as Awaited<ReturnType<typeof generateText>>);

    const vaultRoot = createVault();

    // Step 1: Ingest a source URL
    const ingestResult = await runIngest({
      vaultRoot,
      source: 'https://example.com/data-architecture',
      kind: 'web',
      extract: false,
      skipValidate: true,
      skipTuning: true,
    });

    expect(ingestResult.status).toBe('complete');
    expect(ingestResult.draftBranch).toMatch(/^memoss\/draft\/ingest-/);

    // Verify ingest agent received correct tools
    const ingestCall = mockedGenerateText.mock.calls.at(-1)?.[0];
    expect(ingestCall?.system).toContain('Ingest Agent');
    expect(ingestCall?.tools).toHaveProperty('read_source');
    expect(ingestCall?.tools).toHaveProperty('write_page');
    expect(ingestCall?.tools).toHaveProperty('git_commit');

    // Step 2: Simulate agent writing a page to the vault (what the agent would do)
    const store = new FsKnowledgeStore(vaultRoot);
    await store.writePage('topics/data-pipeline.md', {
      frontmatter: {
        type: 'Concept',
        title: 'Data Pipeline',
        description: 'An end-to-end data pipeline from ingestion to serving.',
        tags: ['data-engineering', 'etl'],
        timestamp: '2026-06-28',
      },
      body: [
        '# Data Pipeline',
        '',
        'A data pipeline moves data from source to destination through stages.',
        '',
        '## Stages',
        '',
        '- **Ingestion**: collecting raw data',
        '- **Transformation**: cleaning and shaping data',
        '- **Serving**: making data available for consumption',
        '',
        '# Citations',
        '',
        '- [Data Architecture](https://example.com/data-architecture)',
      ].join('\n'),
    });

    await store.appendLog('**Ingest**: [Data Architecture](https://example.com/data-architecture) — Created [data-pipeline](topics/data-pipeline.md).');

    // Verify page was written with correct frontmatter
    const written = await store.readPage('topics/data-pipeline.md');
    expect(written.frontmatter.type).toBe('Concept');
    expect(written.frontmatter.title).toBe('Data Pipeline');

    // Step 3: Query the vault
    mockedGenerateText.mockResolvedValue({
      text: 'The vault contains a page about Data Pipelines which describes the three stages: ingestion, transformation, and serving.',
      finishReason: 'stop',
      steps: [],
    } as Awaited<ReturnType<typeof generateText>>);

    const queryResult = await runQuery({
      vaultRoot,
      question: 'What is a data pipeline?',
    });

    expect(queryResult.status).toBe('complete');
    expect(queryResult.text).toContain('Data Pipeline');

    // Query uses read-only tools by default
    const queryCall = mockedGenerateText.mock.calls.at(-1)?.[0];
    expect(queryCall?.tools).toHaveProperty('read_page');
    expect(queryCall?.tools).toHaveProperty('search_kb');
    expect(queryCall?.tools).not.toHaveProperty('write_page');

    // Step 4: Run deterministic lint
    const lintResult = await runLintDeterministic(vaultRoot);
    expect(lintResult.issues.length).toBeGreaterThanOrEqual(0);
    expect(typeof lintResult.health_score).toBe('number');
    expect(lintResult.page_count).toBeGreaterThanOrEqual(1);

    // Orphan page should be detected if no other pages link to it
    const orphanIssue = lintResult.issues.find(
      (i) => i.code === 'ORPHAN_PAGE' && i.path === 'topics/data-pipeline.md',
    );
    expect(orphanIssue).toBeDefined();
    expect(orphanIssue?.severity).toBe('warning');
  });

  it('handles ingest validation rejection and returns rejected status', async () => {
    const vaultRoot = createVault();
    const badPath = join(vaultRoot, 'raw-html.md');
    writeFileSync(
      badPath,
      '<!DOCTYPE html><html><head><script></script></head><body>Page</body></html>',
    );

    // Validation should detect raw HTML and reject without calling the model
    const result = await runIngest({
      vaultRoot,
      source: badPath,
      kind: 'file',
      extract: false,
    });

    expect(result.status).toBe('rejected');
    expect(result.validation?.method).toBe('heuristic');
    expect(result.text).toContain('aborted');
    // Model should NOT be called for heuristic rejection
    expect(mockedGenerateText).not.toHaveBeenCalled();
  });

  it('query with save mode enables write tools', async () => {
    mockedGenerateText.mockResolvedValue({
      text: 'Key concepts found: data pipeline, ETL, streaming.',
      finishReason: 'stop',
      steps: [],
    } as Awaited<ReturnType<typeof generateText>>);

    const vaultRoot = createVault();
    // Pre-populate a page
    const store = new FsKnowledgeStore(vaultRoot);
    await store.writePage('topics/etl.md', {
      frontmatter: {
        type: 'Concept',
        title: 'ETL',
        description: 'Extract, Transform, Load pattern.',
      },
      body: '# ETL\n\nETL is a data integration pattern.\n\n# Citations\n\n- [ETL Definition](https://example.com)',
    });

    const result = await runQuery({
      vaultRoot,
      question: 'What is ETL?',
      save: true,
    });

    expect(result.status).toBe('complete');

    // With save mode, write tools should be available
    const queryCall = mockedGenerateText.mock.calls.at(-1)?.[0];
    expect(queryCall?.tools).toHaveProperty('write_page');
    expect(queryCall?.tools).toHaveProperty('append_log');
    expect(queryCall?.system).toContain('Save mode');
  });
});
