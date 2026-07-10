import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { OKFDocumentError } from '../errors.js';
import { parseOKF } from '../okf/document.js';
import { isReservedFilename } from '../okf/paths.js';
import type { Concept, GraphBundle, GraphEdge, GraphNode } from './types.js';

const LINK_RE = /\]\(([^)\s]+\.md)(?:#[A-Za-z0-9_-]*)?\)/g;

export const DEFAULT_TYPE_PALETTE: Record<string, string> = {
  'BigQuery Dataset': '#8b5cf6',
  'BigQuery Table': '#3b82f6',
  Reference: '#10b981',
  Topic: '#3b82f6',
  Note: '#f59e0b',
  Article: '#8b5cf6',
  Concept: '#6366f1',
};

const DEFAULT_NODE_COLOR = '#94a3b8';

function walkMarkdownFiles(root: string): string[] {
  const files: string[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.memoss') {
          continue;
        }
        stack.push(fullPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.md')) {
        continue;
      }
      const rel = relative(root, fullPath).replace(/\\/g, '/');
      if (isReservedFilename(rel) || rel.startsWith('.memoss/')) {
        continue;
      }
      files.push(fullPath);
    }
  }

  return files.sort();
}

function extractLinks(body: string, docDir: string, bundleRoot: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const bundleResolved = resolve(bundleRoot);

  for (const match of body.matchAll(LINK_RE)) {
    const target = match[1];
    if (!target || target.includes('://') || target.startsWith('/')) {
      continue;
    }
    const resolved = resolve(docDir, target);
    let rel = relative(bundleResolved, resolved).replace(/\\/g, '/');
    if (rel.startsWith('..')) {
      continue;
    }
    if (rel.endsWith('.md')) {
      rel = rel.slice(0, -3);
    }
    if (rel && !seen.has(rel)) {
      seen.add(rel);
      out.push(rel);
    }
  }

  return out;
}

function conceptToNode(concept: Concept, palette: Record<string, string>): GraphNode {
  const color = palette[concept.type] ?? DEFAULT_NODE_COLOR;
  return {
    data: {
      id: concept.id,
      label: concept.title || concept.id,
      type: concept.type,
      description: concept.description,
      resource: concept.resource,
      tags: concept.tags,
      color,
      size: 30 + Math.min(60, Math.floor(concept.body.length / 200)),
    },
  };
}

export function walkConcepts(bundleRoot: string): Concept[] {
  const concepts: Concept[] = [];
  const bundleResolved = resolve(bundleRoot);

  for (const mdPath of walkMarkdownFiles(bundleResolved)) {
    const rel = relative(bundleResolved, mdPath).replace(/\\/g, '/');
    const conceptId = rel.endsWith('.md') ? rel.slice(0, -3) : rel;

    let doc;
    try {
      doc = parseOKF(readFileSync(mdPath, 'utf8'));
    } catch (error) {
      if (error instanceof OKFDocumentError) {
        continue;
      }
      throw error;
    }

    const fm = doc.frontmatter;
    const rawTags = fm.tags;
    const tags = Array.isArray(rawTags)
      ? rawTags.map(String)
      : rawTags != null
        ? [String(rawTags)]
        : [];

    concepts.push({
      id: conceptId,
      type: String(fm.type ?? 'Unknown'),
      title: String(fm.title ?? conceptId),
      description: String(fm.description ?? ''),
      resource: String(fm.resource ?? ''),
      tags,
      body: doc.body,
      linksTo: extractLinks(doc.body, dirname(mdPath), bundleResolved),
    });
  }

  return concepts;
}

export function buildGraph(
  concepts: Concept[],
  palette: Record<string, string> = DEFAULT_TYPE_PALETTE,
): GraphBundle {
  const ids = new Set(concepts.map((c) => c.id));
  const nodes = concepts.map((c) => conceptToNode(c, palette));
  const edges: GraphEdge[] = [];
  const seenEdges = new Set<string>();

  for (const concept of concepts) {
    for (const target of concept.linksTo) {
      if (target === concept.id || !ids.has(target)) {
        continue;
      }
      const key = `${concept.id}__${target}`;
      if (seenEdges.has(key)) {
        continue;
      }
      seenEdges.add(key);
      edges.push({
        data: {
          id: key,
          source: concept.id,
          target,
        },
      });
    }
  }

  const bodies = Object.fromEntries(concepts.map((c) => [c.id, c.body]));
  const types = [...new Set(concepts.map((c) => c.type))].sort();

  return { nodes, edges, bodies, types, palette };
}
