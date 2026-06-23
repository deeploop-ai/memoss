import { describe, expect, it } from 'vitest';
import { OKFValidationError } from '../errors.js';
import type { OKFDocument } from './types.js';
import { validateForRead, validateForWrite } from './validator.js';

const fullDoc: OKFDocument = {
  frontmatter: {
    type: 'Topic',
    title: 'Example',
    description: 'An example page.',
  },
  body: '# Example\n',
};

describe('validateForRead', () => {
  it('accepts documents with type', () => {
    expect(() => validateForRead(fullDoc)).not.toThrow();
  });

  it('rejects documents missing type', () => {
    expect(() =>
      validateForRead({ frontmatter: {}, body: 'x' }),
    ).toThrow(OKFValidationError);
  });

  it('skips reserved filenames', () => {
    expect(() =>
      validateForRead({ frontmatter: {}, body: '# Index\n' }, 'index.md'),
    ).not.toThrow();
  });
});

describe('validateForWrite', () => {
  it('accepts full agent frontmatter', () => {
    expect(() => validateForWrite(fullDoc)).not.toThrow();
  });

  it('rejects missing title or description', () => {
    expect(() =>
      validateForWrite({
        frontmatter: { type: 'Topic', title: 'Only title' },
        body: '',
      }),
    ).toThrow(/description/);

    expect(() =>
      validateForWrite({
        frontmatter: { type: 'Topic', description: 'Only description' },
        body: '',
      }),
    ).toThrow(/title/);
  });
});
