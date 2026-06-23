import { describe, expect, it } from 'vitest';
import { OKFDocumentError } from '../errors.js';
import { parseOKF, serializeOKF } from './document.js';

const SAMPLE = `---
type: BigQuery Table
title: Sample
description: A sample table.
tags: [a, b]
timestamp: 2026-05-27T00:00:00+00:00
custom_field: preserved
---

# Sample

Body text.
`;

describe('parseOKF / serializeOKF', () => {
  it('round-trips frontmatter and body', () => {
    const doc = parseOKF(SAMPLE);
    expect(doc.frontmatter.type).toBe('BigQuery Table');
    expect(doc.frontmatter.tags).toEqual(['a', 'b']);
    expect(doc.frontmatter.custom_field).toBe('preserved');
    expect(doc.body).toContain('# Sample');

    const serialized = serializeOKF(doc);
    const reparsed = parseOKF(serialized);
    expect(reparsed.frontmatter).toEqual(doc.frontmatter);
    expect(reparsed.body.trim()).toBe(doc.body.trim());
  });

  it('treats documents without frontmatter as body-only', () => {
    const src = '# Hello\n\nNo frontmatter here.\n';
    const doc = parseOKF(src);
    expect(doc.frontmatter).toEqual({});
    expect(doc.body).toContain('Hello');
  });

  it('throws on unterminated frontmatter', () => {
    const src = '---\ntype: X\nstill in frontmatter\n';
    expect(() => parseOKF(src)).toThrow(OKFDocumentError);
  });

  it('throws on non-mapping frontmatter', () => {
    const src = '---\n- a\n- b\n---\n\nbody\n';
    expect(() => parseOKF(src)).toThrow(OKFDocumentError);
  });
});
