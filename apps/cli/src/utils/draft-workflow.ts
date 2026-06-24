import { MemossError, SimpleGitAdapter } from '@memoss/core';

const DRAFT_PREFIX = 'memoss/draft/';

export function isDraftBranch(name: string): boolean {
  return name.startsWith(DRAFT_PREFIX);
}

export async function resolveMainBranch(git: SimpleGitAdapter): Promise<string> {
  const branches = await git.listLocalBranches();
  if (branches.includes('main')) {
    return 'main';
  }
  if (branches.includes('master')) {
    return 'master';
  }
  return git.getCurrentBranch();
}

export async function approveDraftBranch(vaultRoot: string): Promise<string> {
  const git = new SimpleGitAdapter(vaultRoot);
  const draftBranch = await git.getCurrentBranch();

  if (!isDraftBranch(draftBranch)) {
    throw new MemossError(
      'GIT_ERROR',
      `Not on a draft branch (current: ${draftBranch}). Nothing to approve.`,
    );
  }

  const mainBranch = await resolveMainBranch(git);
  await git.checkout(mainBranch);
  await git.merge(draftBranch, { ffOnly: true });
  await git.deleteBranch(draftBranch);

  return draftBranch;
}

export async function rejectDraftBranch(
  vaultRoot: string,
  branch?: string,
): Promise<string> {
  const git = new SimpleGitAdapter(vaultRoot);
  const current = await git.getCurrentBranch();
  const draftBranch = branch ?? current;

  if (!isDraftBranch(draftBranch)) {
    throw new MemossError(
      'GIT_ERROR',
      `Branch "${draftBranch}" is not a memoss draft branch.`,
    );
  }

  const mainBranch = await resolveMainBranch(git);

  if (current === draftBranch) {
    await git.checkout(mainBranch);
  }

  await git.deleteBranch(draftBranch, true);
  return draftBranch;
}
