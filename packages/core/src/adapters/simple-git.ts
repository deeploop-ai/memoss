import { simpleGit, type SimpleGit } from 'simple-git';
import { MemossError } from '../errors.js';
import type { GitAdapter, GitCommit } from './types.js';

export function createDraftBranchName(operation: string, date = new Date()): string {
  const stamp = date
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  const formatted = `${stamp.slice(0, 8)}-${stamp.slice(8, 14)}`;
  const safeOperation = operation.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  return `memoss/draft/${safeOperation}-${formatted}`;
}

export class SimpleGitAdapter implements GitAdapter {
  constructor(private readonly root: string) {}

  private git(): SimpleGit {
    return simpleGit(this.root);
  }

  private async requireRepo(): Promise<SimpleGit> {
    const git = this.git();
    if (!(await git.checkIsRepo())) {
      throw new MemossError('GIT_ERROR', 'Not a git repository');
    }
    return git;
  }

  async isRepo(): Promise<boolean> {
    try {
      return await this.git().checkIsRepo();
    } catch {
      return false;
    }
  }

  async init(): Promise<void> {
    const git = this.git();
    if (await git.checkIsRepo()) {
      return;
    }
    await git.init();
    await git.addConfig('user.email', 'memoss@local', false, 'local');
    await git.addConfig('user.name', 'Memoss', false, 'local');
  }

  async getCurrentBranch(): Promise<string> {
    const git = await this.requireRepo();
    const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
    return branch.trim();
  }

  async createBranch(name: string): Promise<void> {
    const git = await this.requireRepo();
    await git.checkoutLocalBranch(name);
  }

  async checkout(branch: string): Promise<void> {
    const git = await this.requireRepo();
    await git.checkout(branch);
  }

  async merge(branch: string, options: { ffOnly?: boolean } = {}): Promise<void> {
    const git = await this.requireRepo();
    if (options.ffOnly) {
      await git.merge([branch, '--ff-only']);
      return;
    }
    await git.merge([branch]);
  }

  async deleteBranch(name: string): Promise<void> {
    const git = await this.requireRepo();
    await git.deleteLocalBranch(name);
  }

  async commit(message: string): Promise<string> {
    const git = await this.requireRepo();
    await git.add('.');
    const result = await git.commit(message);
    return result.commit;
  }

  async diff(ref?: string): Promise<string> {
    const git = await this.requireRepo();
    if (ref) {
      return git.diff([ref]);
    }
    return git.diff();
  }

  async log(limit = 20): Promise<GitCommit[]> {
    const git = await this.requireRepo();
    const result = await git.log({ maxCount: limit });
    return result.all.map((entry) => ({
      hash: entry.hash,
      message: entry.message,
      date: entry.date,
      author: entry.author_name,
    }));
  }
}
