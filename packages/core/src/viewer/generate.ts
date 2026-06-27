import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGraph, walkConcepts } from './graph.js';
import type { GraphGenerationResult } from './types.js';

const ASSETS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'assets');

function loadAsset(name: string): string {
  return readFileSync(join(ASSETS_DIR, name), 'utf8');
}

/** Escape JSON for safe embedding inside an HTML `<script>` block. */
function embedJsonInScript(value: unknown): string {
  return JSON.stringify(value).replace(/<\//g, '<\\/');
}

export interface GenerateGraphHtmlOptions {
  bundleRoot: string;
  outPath: string;
  bundleName?: string;
}

export function generateGraphHtml(opts: GenerateGraphHtmlOptions): GraphGenerationResult {
  const bundleRoot = resolve(opts.bundleRoot);
  const outPath = resolve(opts.outPath);

  const concepts = walkConcepts(bundleRoot);
  const graph = buildGraph(concepts);
  const template = loadAsset('viz.html');
  const css = loadAsset('viz.css');
  const js = loadAsset('viz.js');
  const name = opts.bundleName ?? basename(bundleRoot);

  const bundleNameJson = embedJsonInScript(name);
  const bundleDataJson = embedJsonInScript(graph);

  const html = template
    .replace('/*__VIZ_CSS__*/', css)
    .replace('/*__VIZ_JS__*/', js)
    // Use function replacers so `$'`, `$&`, etc. in JSON/LaTeX are not interpreted.
    .replace('__BUNDLE_NAME__', () => bundleNameJson)
    .replace('__BUNDLE_DATA__', () => bundleDataJson);

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html, 'utf8');

  return {
    concepts: concepts.length,
    edges: graph.edges.length,
    bytes: Buffer.byteLength(html, 'utf8'),
  };
}

export type { GraphGenerationResult } from './types.js';
