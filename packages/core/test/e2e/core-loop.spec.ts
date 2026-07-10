import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FsKnowledgeStore } from '../../src/adapters/fs-store.js';
import { SimpleGitAdapter } from '../../src/adapters/simple-git.js';
import { runIngest } from '../../src/engine/ingest-runner.js';
import { runQuery } from '../../src/engine/query-runner.js';
import { runLintDeterministic } from '../../src/engine/lint-runner.js';
import { searchKb } from '../../src/tools/search-kb.js';
import { sourceManifestId } from '../../src/provenance/hash.js';
import {
  approveDraftBranch,
  createMockGenerateTextFromSteps,
} from './mock-model.js';

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

vi.mock('../../src/engine/model-registry.js', () => ({
  resolveModel: vi.fn(() => ({ modelId: 'mock-model' })),
  parseModelOverride: vi.fn(),
}));

import { generateText } from 'ai';

const mockedGenerateText = vi.mocked(generateText);
const tempDirs: string[] = [];

afterEach(() => {
  vi.clearAllMocks();
  for (const dir of tempDirs.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Windows may hold git index locks briefly after merge.
    }
  }
});

async function initVaultGit(vaultRoot: string): Promise<void> {
  const git = new SimpleGitAdapter(vaultRoot);
  await git.init();
  await git.commit('Initial vault scaffold');
}

function createVault(): string {
  const root = mkdtempSync(join(tmpdir(), 'memoss-e2e-'));
  tempDirs.push(root);
  mkdirSync(join(root, '.memoss'), { recursive: true });
  mkdirSync(join(root, 'topics'), { recursive: true });
  writeFileSync(
    join(root, '.memoss', 'config.yaml'),
    [
      'name: e2e-vault',
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
      'provenance:',
      '  enabled: true',
      '  track_source_hash: true',
      'policies:',
      '  provenance:',
      '    track_affects: true',
      '    stale_check_on_lint: warn',
    ].join('\n'),
  );
  writeFileSync(join(root, '.memoss', 'instructions.md'), 'E2E vault.');
  writeFileSync(join(root, 'index.md'), '# Index\n');
  return root;
}

describe('E2E core loop @e2e', () => {
  it(
    'ingest → approve → query → lint with mock model tool execution',
    async () => {
    const vaultRoot = createVault();
    await initVaultGit(vaultRoot);
    const sourceUri = 'https://example.com/data-architecture';
    const sourceId = sourceManifestId(sourceUri);

    mockedGenerateText.mockImplementation(
      createMockGenerateTextFromSteps([
        {
          toolCalls: [
            { toolName: 'list_pages', input: {} },
            { toolName: 'read_page', input: { path: 'topics/data-pipeline.md' } },
            {
              toolName: 'write_page',
              input: {
                path: 'topics/data-pipeline.md',
                frontmatter: {
                  type: 'Concept',
                  title: 'Data Pipeline',
                  description: 'End-to-end data pipeline from ingestion to serving.',
                  sources: [{ source_id: sourceId }],
                },
                body: [
                  '# Data Pipeline',
                  '',
                  'A data pipeline moves data from source systems through transformation stages into serving layers for analytics and applications.',
                  '',
                  '# Citations',
                  '',
                  `- [Data Architecture](${sourceUri})`,
                ].join('\n'),
              },
            },
            {
              toolName: 'read_log',
              input: {},
            },
            {
              toolName: 'append_log',
              input: {
                line: `**Ingest**: [Data Architecture](${sourceUri}) — Created [data-pipeline](topics/data-pipeline.md).`,
              },
            },
            { toolName: 'git_commit', input: { message: 'Ingest data architecture' } },
          ],
          text: 'Ingest complete.',
        },
      ]),
    );

    const ingestResult = await runIngest({
      vaultRoot,
      source: sourceUri,
      kind: 'web',
      extract: false,
      skipValidate: true,
      skipTuning: true,
    });

    expect(ingestResult.status).toBe('complete');
    expect(ingestResult.draftBranch).toMatch(/^memoss\/draft\/ingest-/);
    expect(ingestResult.affects).toContain('topics/data-pipeline.md');

    const store = new FsKnowledgeStore(vaultRoot);
    const written = await store.readPage('topics/data-pipeline.md');
    expect(written.frontmatter.sources).toEqual([{ source_id: sourceId }]);
    expect(typeof written.frontmatter.verified_at).toBe('string');

    const mergedDraft = await approveDraftBranch(vaultRoot);
    expect(mergedDraft).toMatch(/^memoss\/draft\/ingest-/);

    const searchResults = await searchKb(store, 'data pipeline');
    expect(searchResults.some((entry) => entry.path === 'topics/data-pipeline.md')).toBe(
      true,
    );

    mockedGenerateText.mockResolvedValueOnce({
      text: 'The vault describes a data pipeline with ingestion, transformation, and serving stages.',
      finishReason: 'stop',
      steps: [],
    } as Awaited<ReturnType<typeof generateText>>);

    const queryResult = await runQuery({
      vaultRoot,
      question: 'What is a data pipeline?',
    });
    expect(queryResult.status).toBe('complete');
    expect(queryResult.text.toLowerCase()).toContain('pipeline');

    const lintReport = await runLintDeterministic(vaultRoot);
    expect(lintReport.provenance_coverage.with_sources).toBeGreaterThanOrEqual(1);
    expect(lintReport.provenance_coverage.with_verified_at).toBeGreaterThanOrEqual(1);
    expect(lintReport.page_count).toBeGreaterThanOrEqual(1);
  },
  15_000,
  );
});
