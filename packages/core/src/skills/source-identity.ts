import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

export const CONTENT_HASH_PREFIX = 'sha256:';
export const CONTENT_HASH_SUFFIX_LENGTH = 10;

export function isHttpSource(source: string): boolean {
  return /^https?:\/\//i.test(source);
}

export function hashBuffer(buffer: Buffer): string {
  return `${CONTENT_HASH_PREFIX}${createHash('sha256').update(buffer).digest('hex')}`;
}

export function hashFileContent(filePath: string): string {
  return hashBuffer(readFileSync(filePath));
}

export function resolveLocalSourcePath(source: string, vaultRoot: string): string {
  return isAbsolute(source) ? resolve(source) : resolve(vaultRoot, source);
}

/** SHA256 digest of local file bytes; undefined for URLs or missing paths. */
export function tryHashLocalSource(
  source: string,
  vaultRoot: string,
): string | undefined {
  if (isHttpSource(source)) {
    return undefined;
  }

  const filePath = resolveLocalSourcePath(source, vaultRoot);
  if (!existsSync(filePath)) {
    return undefined;
  }

  try {
    const stat = statSync(filePath);
    if (!stat.isFile()) {
      return undefined;
    }
  } catch {
    return undefined;
  }

  return hashFileContent(filePath);
}

export function contentHashSuffix(contentHash: string): string {
  return contentHash.replace(/^sha256:/, '').slice(0, CONTENT_HASH_SUFFIX_LENGTH);
}
