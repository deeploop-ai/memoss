import { OKFValidationError } from '../errors.js';
import type { OKFDocument } from './types.js';
import { isReservedFilename } from './paths.js';

const READ_REQUIRED = ['type'] as const;
const WRITE_REQUIRED = ['type', 'title', 'description'] as const;

function missingKeys(
  frontmatter: Record<string, unknown>,
  keys: readonly string[],
): string[] {
  return keys.filter((key) => {
    const value = frontmatter[key];
    return value === undefined || value === null || value === '';
  });
}

function assertHasKeys(
  doc: OKFDocument,
  keys: readonly string[],
  relativePath?: string,
): void {
  if (relativePath && isReservedFilename(relativePath)) {
    return;
  }

  const missing = missingKeys(doc.frontmatter, keys);
  if (missing.length > 0) {
    throw new OKFValidationError(
      `Missing required frontmatter keys: ${missing.join(', ')}`,
    );
  }
}

/** Permissive validation for third-party bundles (requires `type` only). */
export function validateForRead(
  doc: OKFDocument,
  relativePath?: string,
): void {
  assertHasKeys(doc, READ_REQUIRED, relativePath);
}

/** Strict validation for agent-authored pages. */
export function validateForWrite(
  doc: OKFDocument,
  relativePath?: string,
): void {
  assertHasKeys(doc, WRITE_REQUIRED, relativePath);
}
