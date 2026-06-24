import { afterEach, describe, expect, it } from 'vitest';
import { clearPromptCache } from './prompts/load.js';
import {
  buildSystemPrompt,
  createPromptContext,
  loadVaultInstructions,
  LINT_FIX_INSTRUCTIONS,
  QUERY_SAVE_INSTRUCTIONS,
} from './context.js';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDefaultVaultConfig } from '../config/vault-config.js';

const tempDirs: string[] = [];

afterEach(() => {
  clearPromptCache();
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createVault(): string {
  const root = mkdtempSync(join(tmpdir(), 'memoss-engine-'));
  tempDirs.push(root);
  mkdirSync(join(root, '.memoss'), { recursive: true });
  writeFileSync(
    join(root, '.memoss', 'config.yaml'),
    'name: test-vault\nokf_version: "0.1"\nagent:\n  default_model:\n    provider: anthropic\n    model: claude-sonnet-4-6\n  lightweight_model:\n    provider: anthropic\n    model: claude-haiku-4-5\n',
  );
  writeFileSync(
    join(root, '.memoss', 'instructions.md'),
    'Always prefer concise titles.',
  );
  return root;
}

describe('buildSystemPrompt', () => {
  it('renders ingest template with vault variables', () => {
    const system = buildSystemPrompt({
      prompt: 'ingest',
      vaultName: 'my-wiki',
      schemaPack: 'research',
      instructions: 'Custom rule.',
      date: '2026-06-24',
    });

    expect(system).toContain('my-wiki');
    expect(system).toContain('research');
    expect(system).toContain('Custom rule.');
    expect(system).toContain('2026-06-24');
    expect(system).toContain('Augment, don');
  });

  it('injects save instructions for query mode', () => {
    const system = buildSystemPrompt({
      prompt: 'query',
      vaultName: 'v',
      schemaPack: 'personal',
      instructions: 'x',
      date: '2026-06-24',
      extra: { save_instructions: QUERY_SAVE_INSTRUCTIONS },
    });

    expect(system).toContain('Save mode');
    expect(system).toContain('type: Note');
  });

  it('injects fix instructions for lint mode', () => {
    const system = buildSystemPrompt({
      prompt: 'lint',
      vaultName: 'v',
      schemaPack: 'research',
      instructions: 'x',
      date: '2026-06-24',
      extra: { fix_instructions: LINT_FIX_INSTRUCTIONS },
    });

    expect(system).toContain('Fix mode');
    expect(system).toContain('git_commit');
  });
});

describe('createPromptContext', () => {
  it('loads vault instructions from disk', () => {
    const vaultRoot = createVault();
    const config = createDefaultVaultConfig({ name: 'loaded-vault' });
    const ctx = createPromptContext(vaultRoot, config, new Date('2026-06-24T12:00:00Z'));

    expect(ctx.vaultName).toBe('loaded-vault');
    expect(ctx.instructions).toContain('concise titles');
    expect(ctx.date).toBe('2026-06-24');
  });
});

describe('loadVaultInstructions', () => {
  it('returns placeholder when instructions file is missing', () => {
    const vaultRoot = mkdtempSync(join(tmpdir(), 'memoss-no-inst-'));
    tempDirs.push(vaultRoot);
    mkdirSync(join(vaultRoot, '.memoss'), { recursive: true });

    expect(loadVaultInstructions(vaultRoot)).toContain('No vault-specific instructions');
  });
});
