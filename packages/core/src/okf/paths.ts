import { dirname, posix } from 'node:path';
import { OKFDocumentError } from '../errors.js';
import type { ConceptId } from './types.js';

export const RESERVED_FILENAMES = new Set(['index.md', 'log.md']);

const SEGMENT_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;

function validateSegment(segment: string): void {
  if (!SEGMENT_RE.test(segment)) {
    throw new OKFDocumentError(`Invalid concept id segment: ${JSON.stringify(segment)}`);
  }
}

export function isReservedFilename(relativePath: string): boolean {
  const base = posix.basename(relativePath.replace(/\\/g, '/'));
  return RESERVED_FILENAMES.has(base);
}

export function parseConceptId(value: string): ConceptId {
  const parts = value.split('/').filter(Boolean);
  if (parts.length === 0) {
    throw new OKFDocumentError(`Empty concept id: ${JSON.stringify(value)}`);
  }
  for (const part of parts) {
    validateSegment(part);
  }
  return parts;
}

export function conceptIdToPath(
  bundleRoot: string,
  conceptId: ConceptId,
): string {
  if (conceptId.length === 0) {
    throw new OKFDocumentError('concept_id must have at least one segment');
  }
  for (const segment of conceptId) {
    validateSegment(segment);
  }
  const dirs = conceptId.slice(0, -1);
  const name = conceptId[conceptId.length - 1];
  return posix.normalize(posix.join(bundleRoot, ...dirs, `${name}.md`));
}

export function pathToConceptId(
  bundleRoot: string,
  relativePath: string,
): ConceptId {
  const normalizedRoot = posix.normalize(bundleRoot.replace(/\\/g, '/'));
  const normalizedPath = posix.normalize(relativePath.replace(/\\/g, '/'));
  const rel = posix.relative(normalizedRoot, normalizedPath);
  if (rel.startsWith('..')) {
    throw new OKFDocumentError(`Path is outside bundle root: ${relativePath}`);
  }
  const withoutExt = rel.endsWith('.md') ? rel.slice(0, -3) : rel;
  return withoutExt.split('/').filter(Boolean);
}

/**
 * Resolve a markdown link to a vault-relative path.
 * Supports file-relative (`../topics/foo.md`) and bundle-relative (`topics/foo.md`).
 */
export function resolveLink(fromRelativePath: string, link: string): string {
  const normalizedLink = link.split('#')[0]?.split('?')[0]?.trim() ?? '';
  if (!normalizedLink) {
    throw new OKFDocumentError('Empty link target');
  }

  const fromDir = dirname(fromRelativePath.replace(/\\/g, '/'));
  const resolved =
    normalizedLink.startsWith('.') || normalizedLink.startsWith('/')
      ? posix.normalize(posix.join(fromDir, normalizedLink))
      : posix.normalize(normalizedLink);

  return resolved.replace(/\\/g, '/');
}
