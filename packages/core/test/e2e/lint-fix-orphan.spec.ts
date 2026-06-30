import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runLint } from '../../src/engine/lint-runner.js';
import { runLintDeterministic } from '../../src/engine/lint-runner.js';
import { createMockGenerateTextFromSteps } from './mock-model.js';

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
const fixtureRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '../fixtures/vault-orphan-fix',
);
const tempDirs: string[] = [];

afterEach(() => {
  vi.clearAllMocks();
  for (const dir of tempDirs.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore Windows file locks
    }
  }
});

function copyFixtureVault(): string {
  const root = mkdtempSync(join(tmpdir(), 'memoss-orphan-fix-'));
  tempDirs.push(root);
  cpSync(fixtureRoot, root, { recursive: true });
  return root;
}

describe('E2E lint --fix orphan @e2e', () => {
  it('mock lint agent adds hub cross-link and clears ORPHAN_PAGE', async () => {
    const vaultRoot = copyFixtureVault();

    const before = await runLintDeterministic(vaultRoot);
    expect(
      before.issues.some(
        (issue) => issue.code === 'ORPHAN_PAGE' && issue.path === 'orphan.md',
      ),
    ).toBe(true);

    const hubBodyWithLink = [
      '# Hub Page',
      '',
      'This hub connects related concepts.',
      '',
      '## Related',
      '',
      '- [Linked concept](linked.md)',
      '- [Orphan concept](orphan.md)',
      '',
      '# Citations',
      '',
      '- [Fixture source](https://example.com/hub)',
    ].join('\n');

    mockedGenerateText.mockImplementation(
      createMockGenerateTextFromSteps([
        {
          toolCalls: [
            { toolName: 'list_pages', input: {} },
            { toolName: 'read_page', input: { path: 'hub.md' } },
            { toolName: 'read_page', input: { path: 'orphan.md' } },
            {
              toolName: 'write_page',
              input: {
                path: 'hub.md',
                frontmatter: {
                  type: 'Concept',
                  title: 'Hub Page',
                  description:
                    'Central hub linking to related concepts in this fixture vault.',
                  sources: [{ source_id: 'fixture-hub' }],
                  verified_at: '2026-06-28T00:00:00.000Z',
                },
                body: hubBodyWithLink,
              },
            },
          ],
          text: 'Added orphan cross-link from hub.',
        },
      ]),
    );

    const fixResult = await runLint({
      vaultRoot,
      fix: true,
    });

    expect(fixResult.status).toBe('complete');
    const lintCall = mockedGenerateText.mock.calls.at(-1)?.[0];
    expect(lintCall?.system).toContain('Orphan pages');

    const after = await runLintDeterministic(vaultRoot);
    expect(
      after.issues.some(
        (issue) => issue.code === 'ORPHAN_PAGE' && issue.path === 'orphan.md',
      ),
    ).toBe(false);
  });
});
