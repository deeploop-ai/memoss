import { describe, expect, it } from 'vitest';
import { inferSourceKind } from './runner-setup.js';

describe('inferSourceKind', () => {
  it('detects web URLs', () => {
    expect(inferSourceKind('https://example.com/post')).toBe('web');
  });

  it('detects github URLs', () => {
    expect(inferSourceKind('https://github.com/org/repo')).toBe('github');
  });

  it('defaults to file paths', () => {
    expect(inferSourceKind('./articles/notes.md')).toBe('file');
  });
});
