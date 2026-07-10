import { SimpleGitAdapter } from '../adapters/simple-git.js';
import { MemossError } from '../errors.js';

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
  throw new MemossError(
    'GIT_ERROR',
    'No main or master branch found. Initialize the vault with a main branch before approving drafts.',
  );
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

  if (await git.hasUncommittedChanges()) {
    throw new MemossError(
      'GIT_ERROR',
      'Working tree has uncommitted changes. Commit or stash them before approving the draft.',
    );
  }

  const mainBranch = await resolveMainBranch(git);
  try {
    await git.checkout(mainBranch);
    await git.merge(draftBranch, { ffOnly: true });
    await git.deleteBranch(draftBranch);
  } catch (error) {
    try {
      await git.checkout(draftBranch);
    } catch {
      // Best-effort restore; original error is more important.
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new MemossError(
      'GIT_ERROR',
      `Failed to merge ${draftBranch} into ${mainBranch}: ${message}. You are back on ${draftBranch}.`,
    );
  }

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
