import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

  it('does not interpret $\' in embedded bundle JSON as a replace pattern', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'memoss-viewer-'));
    tempDirs.push(outDir);
    const bundleRoot = join(outDir, 'bundle');
    const conceptDir = join(bundleRoot, 'topics');
    mkdirSync(conceptDir, { recursive: true });
    writeFileSync(
      join(conceptDir, 'latex.md'),
      "---\ntitle: LaTeX\ntype: Topic\n---\nAdd noise to the subject $s$'s embedding.\n",
      'utf8',
    );

    const outPath = join(outDir, 'viz.html');
    generateGraphHtml({ bundleRoot, outPath, bundleName: 'test' });

    const html = readFileSync(outPath, 'utf8');
    expect(html).toContain("$s$'s embedding");
    expect(html.match(/<\/script>/g)?.length).toBe(4);
  });

  it('escapes </script> in embedded bundle JSON', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'memoss-viewer-'));
    tempDirs.push(outDir);
    const bundleRoot = join(outDir, 'bundle');
    const conceptDir = join(bundleRoot, 'sources', 'extracted');
    mkdirSync(conceptDir, { recursive: true });
    writeFileSync(
      join(conceptDir, 'html-page.md'),
      '---\ntitle: HTML page\ntype: Source\n---\n<script>alert(1)</script>\n</script>\n',
      'utf8',
    );

    const outPath = join(outDir, 'viz.html');
    generateGraphHtml({ bundleRoot, outPath, bundleName: 'test' });

    const html = readFileSync(outPath, 'utf8');
    const match = html.match(/window\.BUNDLE = ([\s\S]+);\r?\n<\/script>/);
    expect(match).not.toBeNull();
    const bundle = JSON.parse(match![1]);
    expect(bundle.bodies['sources/extracted/html-page']).toContain('</script>');
    expect(match![1]).not.toContain('</script>');
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
