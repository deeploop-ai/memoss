import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { sourceToSlug } from './hash.js';
import type { ExtractMeta } from '../skills/types.js';

export interface SourceManifestEntry {
  id: string;
  uri: string;
  fetched_at?: string;
  content_hash: string;
  ingested_at?: string;
  extractor?: string;
  extracted_path?: string;
  raw_path?: string;
  raw_content_hash?: string;
  affects?: string[];
}

export interface SourceManifest {
  sources: SourceManifestEntry[];
}

export function manifestPath(vaultRoot: string): string {
  return join(vaultRoot, 'sources', 'manifest.yaml');
}

export function loadSourceManifest(vaultRoot: string): SourceManifest {
  const path = manifestPath(vaultRoot);
  if (!existsSync(path)) {
    return { sources: [] };
  }

  const raw = parseYaml(readFileSync(path, 'utf8')) as
    | SourceManifest
    | null
    | undefined;
  if (!raw || !Array.isArray(raw.sources)) {
    return { sources: [] };
  }
  return { sources: raw.sources };
}

export function saveSourceManifest(
  vaultRoot: string,
  manifest: SourceManifest,
): void {
  const path = manifestPath(vaultRoot);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stringifyYaml(manifest), 'utf8');
}

export function upsertSourceManifestEntry(
  vaultRoot: string,
  entry: SourceManifestEntry,
): SourceManifestEntry {
  const manifest = loadSourceManifest(vaultRoot);
  const index = manifest.sources.findIndex((item) => item.id === entry.id);
  const merged: SourceManifestEntry =
    index >= 0 ? { ...manifest.sources[index], ...entry } : entry;

  if (index >= 0) {
    manifest.sources[index] = merged;
  } else {
    manifest.sources.push(merged);
  }

  manifest.sources.sort((left, right) => left.id.localeCompare(right.id));
  saveSourceManifest(vaultRoot, manifest);
  return merged;
}

export function registerExtractProvenance(
  vaultRoot: string,
  input: {
    sourceUri: string;
    extractedPath: string;
    meta: ExtractMeta;
  },
): SourceManifestEntry {
  const relativePath = input.extractedPath.startsWith(vaultRoot)
    ? input.extractedPath.slice(vaultRoot.length + 1).replace(/\\/g, '/')
    : input.extractedPath;

  return upsertSourceManifestEntry(vaultRoot, {
    id: sourceToSlug(input.sourceUri),
    uri: input.sourceUri,
    fetched_at: input.meta.extracted_at,
    content_hash: input.meta.content_hash,
    extractor: input.meta.skill,
    extracted_path: relativePath,
    raw_path: input.meta.raw_path,
    raw_content_hash: input.meta.raw_content_hash,
  });
}

export function registerIngestProvenance(
  vaultRoot: string,
  input: {
    sourceUri: string;
    ingested_at?: string;
    affects?: string[];
  },
): SourceManifestEntry {
  const id = sourceToSlug(input.sourceUri);
  const existing = loadSourceManifest(vaultRoot).sources.find(
    (item) => item.id === id,
  );

  return upsertSourceManifestEntry(vaultRoot, {
    id,
    uri: input.sourceUri,
    content_hash: existing?.content_hash ?? '',
    fetched_at: existing?.fetched_at,
    extractor: existing?.extractor,
    extracted_path: existing?.extracted_path,
    ingested_at: input.ingested_at ?? new Date().toISOString(),
    affects: input.affects ?? existing?.affects,
  });
}
