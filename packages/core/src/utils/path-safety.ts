import { resolve, sep } from 'node:path';
import { MemossError } from '../errors.js';

export function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, '/').replace(/^\.\/+/, '');
}

export function isPathInsideRoot(root: string, absolute: string): boolean {
  const resolvedRoot = resolve(root);
  const resolvedAbs = resolve(absolute);
  return (
    resolvedAbs === resolvedRoot || resolvedAbs.startsWith(resolvedRoot + sep)
  );
}

export function resolveContainedPath(
  root: string,
  relativePath: string,
): string {
  const normalized = normalizeRelativePath(relativePath);
  if (normalized.includes('..')) {
    throw new MemossError(
      'POLICY_VIOLATION',
      `Path traversal rejected: ${relativePath}`,
    );
  }

  const resolvedRoot = resolve(root);
  const absolute = resolve(resolvedRoot, normalized);
  if (!isPathInsideRoot(resolvedRoot, absolute)) {
    throw new MemossError(
      'POLICY_VIOLATION',
      `Path escapes vault root: ${relativePath}`,
    );
  }

  return absolute;
}
