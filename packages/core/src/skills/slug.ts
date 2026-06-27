import { createHash } from 'node:crypto';
import { basename, extname } from 'node:path';

export function sourceToSlug(source: string): string {
  if (/^https?:\/\//i.test(source)) {
    try {
      const url = new URL(source);
      const host = url.hostname.replace(/^www\./, '');
      const pathPart = url.pathname
        .replace(/\/$/, '')
        .replace(/\//g, '-')
        .replace(/^-/, '');
      const raw = pathPart ? `${host}-${pathPart}` : host;
      return sanitizeSlug(raw);
    } catch {
      return sanitizeSlug('source');
    }
  }

  const name = basename(source, extname(source));
  return sanitizeSlug(name);
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
