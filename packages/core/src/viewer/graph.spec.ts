import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { buildGraph, walkConcepts } from './graph.js';
import { generateGraphHtml } from './generate.js';

const fixtureRoot = join(
  import.meta.dirname,
  '../../test/fixtures/kc-sample/crypto_bitcoin',
);

describe('walkConcepts', () => {
  it('walks knowledge-catalog sample bundle', () => {
    const concepts = walkConcepts(fixtureRoot);
    expect(concepts.length).toBeGreaterThanOrEqual(3);
    expect(concepts.some((c) => c.id === 'datasets/crypto_bitcoin')).toBe(true);
  });
});

describe('buildGraph', () => {
  it('creates edges for internal markdown links', () => {
    const concepts = walkConcepts(fixtureRoot);
    const graph = buildGraph(concepts);
    expect(graph.nodes.length).toBe(concepts.length);
    expect(graph.edges.length).toBeGreaterThan(0);
    expect(graph.types).toContain('BigQuery Dataset');
  });
});

describe('generateGraphHtml', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes a self-contained HTML file', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'memoss-viewer-'));
    tempDirs.push(outDir);
    const outPath = join(outDir, 'viz.html');

    const result = generateGraphHtml({
      bundleRoot: fixtureRoot,
      outPath,
      bundleName: 'crypto_bitcoin',
    });

    expect(result.concepts).toBeGreaterThan(0);
    expect(result.bytes).toBeGreaterThan(1000);

    const html = readFileSync(outPath, 'utf8');
    expect(html).toContain('window.BUNDLE =');
    expect(html).toContain('cytoscape');
    expect(html).toContain('crypto_bitcoin');
  });
});
