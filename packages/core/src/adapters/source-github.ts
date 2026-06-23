import { Octokit } from '@octokit/rest';
import { MemossError } from '../errors.js';
import type { SourceAdapter, SourceContent, SourceItem } from './types.js';

const MAX_FILE_BYTES = 512 * 1024;

export interface ParsedGitHubUri {
  owner: string;
  repo: string;
  ref: string;
}

export function parseGitHubUri(uri: string): ParsedGitHubUri {
  const trimmed = uri.trim();
  const shorthand = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (shorthand) {
    return { owner: shorthand[1], repo: shorthand[2], ref: 'main' };
  }

  const parsed = new URL(
    trimmed.startsWith('http') ? trimmed : `https://${trimmed}`,
  );
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length < 2 || parts[0] === 'blob' || parts[0] === 'tree') {
    throw new MemossError('SOURCE_ERROR', `Invalid GitHub URI: ${uri}`);
  }

  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/, '');
  const ref = parts[3] && parts[2] === 'tree' ? parts[3] : 'main';
  return { owner, repo, ref };
}

export class GitHubSourceAdapter implements SourceAdapter {
  readonly kind = 'github' as const;
  readonly uri: string;
  private readonly parsed: ParsedGitHubUri;
  private readonly octokit: Octokit;
  private items: SourceItem[] | null = null;

  constructor(uri: string, token = process.env.GITHUB_TOKEN) {
    this.uri = uri;
    this.parsed = parseGitHubUri(uri);
    this.octokit = new Octokit(token ? { auth: token } : {});
  }

  private async loadItems(): Promise<SourceItem[]> {
    if (this.items) {
      return this.items;
    }

    const { owner, repo, ref } = this.parsed;
    const branch = await this.octokit.repos.getBranch({ owner, repo, branch: ref });
    const tree = await this.octokit.git.getTree({
      owner,
      repo,
      tree_sha: branch.data.commit.sha,
      recursive: 'true',
    });

    this.items = (tree.data.tree ?? [])
      .filter(
        (entry) =>
          entry.type === 'blob' &&
          typeof entry.path === 'string' &&
          entry.path.endsWith('.md'),
      )
      .map((entry) => ({
        id: entry.path as string,
        title: (entry.path as string).split('/').pop()?.replace(/\.md$/, ''),
        mime: 'text/markdown',
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    return this.items;
  }

  async listItems(): Promise<SourceItem[]> {
    return this.loadItems();
  }

  async readItem(id: string): Promise<SourceContent> {
    const items = await this.loadItems();
    const item = items.find((entry) => entry.id === id);
    if (!item) {
      throw new MemossError('SOURCE_ERROR', `Unknown GitHub source item: ${id}`);
    }

    const { owner, repo, ref } = this.parsed;
    const response = await this.octokit.repos.getContent({
      owner,
      repo,
      path: id,
      ref,
    });

    if (Array.isArray(response.data) || response.data.type !== 'file') {
      throw new MemossError('SOURCE_ERROR', `Expected file content for ${id}`);
    }

    if (typeof response.data.content !== 'string') {
      throw new MemossError('SOURCE_ERROR', `Missing file content for ${id}`);
    }

    const buffer = Buffer.from(response.data.content, response.data.encoding as BufferEncoding);
    if (buffer.byteLength > MAX_FILE_BYTES) {
      throw new MemossError('SOURCE_ERROR', `GitHub file exceeds 512KB: ${id}`);
    }

    return {
      id,
      title: item.title,
      mime: 'text/markdown',
      text: buffer.toString('utf8'),
      metadata: {
        owner,
        repo,
        ref,
        sha: response.data.sha,
      },
    };
  }
}
