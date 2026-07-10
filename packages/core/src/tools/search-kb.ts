import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import fg from 'fast-glob';
import type { KnowledgeStore } from '../adapters/types.js';
import { isReservedFilename } from '../okf/paths.js';

export interface SearchSnippet {
  line: number;
  text: string;
}

export interface SearchResult {
  path: string;
  score: number;
  snippets: SearchSnippet[];
}

export interface SearchKbOptions {
  maxResults?: number;
}

const DEFAULT_MAX_RESULTS = 50;

export async function searchKb(
  store: KnowledgeStore,
  query: string,
  options: SearchKbOptions = {},
): Promise<SearchResult[]> {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;

  const files = await fg('**/*.md', {
    cwd: store.vaultRoot,
    onlyFiles: true,
    dot: false,
  });

  const results: SearchResult[] = [];

  for (const relativePath of files) {
    if (results.length >= maxResults) break;

    const path = relativePath.replace(/\\/g, '/');
    if (isReservedFilename(path)) {
      continue;
    }

    const absolute = join(store.vaultRoot, path);
    const content = await readFile(absolute, 'utf8');
    const lines = content.split(/\r?\n/);
    const snippets: SearchSnippet[] = [];

    for (let index = 0; index < lines.length; index++) {
      if (!lines[index]?.toLowerCase().includes(normalizedQuery)) {
        continue;
      }

      const context: string[] = [];
      if (lines[index - 1]) {
        context.push(lines[index - 1]);
      }
      context.push(lines[index] ?? '');
      if (lines[index + 1]) {
        context.push(lines[index + 1]);
      }

      snippets.push({
        line: index + 1,
        text: context.join('\n'),
      });
    }

    if (snippets.length > 0) {
      results.push({
        path,
        score: snippets.length,
        snippets,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
}
