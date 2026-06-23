import { describe, expect, it } from 'vitest';
import {
  conceptIdToPath,
  isReservedFilename,
  parseConceptId,
  pathToConceptId,
  resolveLink,
} from './paths.js';

describe('paths', () => {
  it('maps concept ids to vault paths', () => {
    expect(conceptIdToPath('/vault', ['topics', 'bitcoin'])).toBe(
      '/vault/topics/bitcoin.md',
    );
    expect(pathToConceptId('/vault', '/vault/topics/bitcoin.md')).toEqual([
      'topics',
      'bitcoin',
    ]);
    expect(parseConceptId('tables/blocks')).toEqual(['tables', 'blocks']);
  });

  it('flags reserved filenames', () => {
    expect(isReservedFilename('index.md')).toBe(true);
    expect(isReservedFilename('topics/index.md')).toBe(true);
    expect(isReservedFilename('topics/foo.md')).toBe(false);
  });

  it('resolves file-relative and bundle-relative links', () => {
    expect(resolveLink('datasets/crypto_bitcoin.md', '../tables/blocks.md')).toBe(
      'tables/blocks.md',
    );
    expect(resolveLink('index.md', 'tables/blocks.md')).toBe('tables/blocks.md');
    expect(resolveLink('tables/blocks.md', './inputs.md')).toBe(
      'tables/inputs.md',
    );
  });
});
