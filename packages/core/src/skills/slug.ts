import { createHash } from 'node:crypto';
import { basename, extname } from 'node:path';

const QUERY_LITERAL_MAX = 48;

function queryToSlugPart(search: string): string {
  if (!search || search === '?') {
    return '';
  }

  const params = new URLSearchParams(search);
  const keys = [...params.keys()].sort();
  if (keys.length === 0) {
    return '';
  }

  const parts: string[] = [];
  for (const key of keys) {
    for (const value of params.getAll(key)) {
      parts.push(`${key}-${value}`);
    }
  }

  const compact = parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!compact) {
    return '';
  }
  if (compact.length <= QUERY_LITERAL_MAX) {
    return compact;
  }

  return `q-${createHash('sha256').update(search).digest('hex').slice(0, 10)}`;
}

export interface SourceSlugOptions {
  /** Raw source bytes hash (`sha256:...`) to distinguish same-named local files. */
  contentHash?: string;
}

export function sourceToSlug(source: string, options?: SourceSlugOptions): string {
  if (/^https?:\/\//i.test(source)) {
    try {
      const url = new URL(source);
      const host = url.hostname.replace(/^www\./, '');
      const pathPart = url.pathname
        .replace(/\/$/, '')
        .replace(/\//g, '-')
        .replace(/^-/, '');
      const pathSlug = pathPart ? `${host}-${pathPart}` : host;
      const queryPart = queryToSlugPart(url.search);
      const raw = queryPart ? `${pathSlug}-${queryPart}` : pathSlug;
      return sanitizeSlug(raw);
    } catch {
      return sanitizeSlug('source');
    }
  }

  const name = basename(source, extname(source));
  const base = sanitizeSlug(name);
  if (options?.contentHash) {
    const digest = options.contentHash.replace(/^sha256:/, '').slice(0, 10);
    return sanitizeSlug(`${base}-${digest}`);
  }
  return base;
}

export function sourceManifestId(
  sourceUri: string,
  rawContentHash?: string,
): string {
  return sourceToSlug(sourceUri, { contentHash: rawContentHash });
}

function sanitizeSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return slug || 'source';
}

export function contentHash(text: string): string {
  return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
}
