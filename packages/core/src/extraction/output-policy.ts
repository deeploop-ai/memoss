import { basename, extname } from 'node:path';

/** Sidecar files written during web crawl extraction. */
const CRAWL_SIDECAR_RE = /\.url\.txt$/i;

/** Extensions agents must never leave under sources/extracted/. */
const ARTIFACT_EXTENSIONS = new Set([
  '.py',
  '.sh',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.txt',
  '.json',
  '.bat',
  '.ps1',
  '.exe',
  '.log',
]);

/**
 * Paths agents may write under sources/extracted/.
 * System-owned sidecars (.meta.json) are excluded — agents must not write them.
 */
export function isAllowedExtractAgentOutput(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/');
  const base = basename(normalized);

  if (base.endsWith('.md')) {
    return true;
  }

  if (CRAWL_SIDECAR_RE.test(base)) {
    return true;
  }

  return false;
}

export function extractAgentOutputRejectReason(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/');
  const ext = extname(normalized).toLowerCase();

  if (ext === '.meta.json' || normalized.endsWith('.meta.json')) {
    return 'Sidecar metadata is written by Memoss; do not write .meta.json files.';
  }

  if (ARTIFACT_EXTENSIONS.has(ext)) {
    return `Intermediate or script files (${ext}) are not allowed under sources/extracted/. Run scripts from a temp directory via bash, then write only the final markdown with write_file.`;
  }

  return 'Only markdown (.md) and crawl URL sidecars (*.url.txt) may be written under sources/extracted/.';
}

/** Remove agent-created junk files from the extract output tree. */
export function isExtractArtifactToRemove(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/');
  const base = basename(normalized);

  if (base.endsWith('.meta.json')) {
    return false;
  }

  if (isAllowedExtractAgentOutput(normalized)) {
    return false;
  }

  const ext = extname(normalized).toLowerCase();
  if (ARTIFACT_EXTENSIONS.has(ext)) {
    return true;
  }

  return ext.length > 0;
}
