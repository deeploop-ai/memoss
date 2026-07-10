import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { SimpleGitAdapter } from '../adapters/simple-git.js';
import { MemossError } from '../errors.js';
import {
  approveDraftBranch,
  isDraftBranch,
  rejectDraftBranch,
  resolveMainBranch,
} from './draft-workflow.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createGitVault(): { dir: string; git: SimpleGitAdapter } {
  const dir = mkdtempSync(join(tmpdir(), 'memoss-draft-workflow-'));
  tempDirs.push(dir);
  writeFileSync(join(dir, 'README.md'), '# Vault\n', 'utf8');
  return { dir, git: new SimpleGitAdapter(dir) };
}

describe('draft-workflow', () => {
  it('identifies draft branches by prefix', () => {
    expect(isDraftBranch('memoss/draft/ingest-20260710')).toBe(true);
    expect(isDraftBranch('main')).toBe(false);
  });

  it('resolves main or master only', async () => {
    const { git } = createGitVault();
    await git.init();
    await git.commit('init');
    const mainBranch = await resolveMainBranch(git);
    expect(['main', 'master']).toContain(mainBranch);
    expect(await git.getCurrentBranch()).toBe(mainBranch);
  });

  it('approves a draft branch with fast-forward merge', async () => {
    const { dir, git } = createGitVault();
    await git.init();
    await git.commit('init');
    const mainBranch = await resolveMainBranch(git);

    const draft = 'memoss/draft/ingest-test';
    await git.createBranch(draft);
    mkdirSync(join(dir, 'topics'), { recursive: true });
    writeFileSync(join(dir, 'topics', 'note.md'), '# Note\n', 'utf8');
    await git.commit('draft change');

    expect(await git.getCurrentBranch()).toBe(draft);
    const merged = await approveDraftBranch(dir);
    expect(merged).toBe(draft);
    expect(await git.getCurrentBranch()).toBe(mainBranch);
    expect(await git.listLocalBranches()).not.toContain(draft);
  });

  it('rejects approval when not on a draft branch', async () => {
    const { dir, git } = createGitVault();
    await git.init();
    await git.commit('init');

    await expect(approveDraftBranch(dir)).rejects.toThrow(MemossError);
  });

  it('rejects a draft branch and returns to main', async () => {
    const { dir, git } = createGitVault();
    await git.init();
    await git.commit('init');
    const mainBranch = await resolveMainBranch(git);

    const draft = 'memoss/draft/ingest-reject';
    await git.createBranch(draft);
    writeFileSync(join(dir, 'draft-only.md'), '# Draft\n', 'utf8');
    await git.commit('draft only');

    const rejected = await rejectDraftBranch(dir);
    expect(rejected).toBe(draft);
    expect(await git.getCurrentBranch()).toBe(mainBranch);
    expect(await git.listLocalBranches()).not.toContain(draft);
  });
});
