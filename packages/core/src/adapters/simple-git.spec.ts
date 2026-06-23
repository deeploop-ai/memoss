import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { MemossError } from '../errors.js';
import { createDraftBranchName, SimpleGitAdapter } from './simple-git.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createWorkspace(): { dir: string; git: SimpleGitAdapter } {
  const dir = mkdtempSync(join(tmpdir(), 'memoss-git-'));
  tempDirs.push(dir);
  writeFileSync(join(dir, 'README.md'), '# Vault\n', 'utf8');
  return { dir, git: new SimpleGitAdapter(dir) };
}

describe('SimpleGitAdapter', () => {
  it('initializes a repository and supports draft branch workflow', async () => {
    const { git } = createWorkspace();
    expect(await git.isRepo()).toBe(false);

    await git.init();
    expect(await git.isRepo()).toBe(true);

    const draft = createDraftBranchName('ingest', new Date('2026-06-23T14:30:22Z'));
    expect(draft).toBe('memoss/draft/ingest-20260623-143022');

    await git.commit('init vault');

    const base = await git.getCurrentBranch();
    await git.createBranch(draft);
    expect(await git.getCurrentBranch()).toBe(draft);

    await git.checkout(base);
    await git.merge(draft, { ffOnly: true });
    await git.deleteBranch(draft);
    expect(await git.log(1)).toHaveLength(1);
  });

  it('fails gracefully outside a git repository', async () => {
    const { git } = createWorkspace();
    await expect(git.commit('nope')).rejects.toThrow(MemossError);
  });
});
