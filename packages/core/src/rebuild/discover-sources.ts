import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadSourceManifest } from '../provenance/manifest.js';

export type RebuildSourceOrigin = 'manifest' | 'raw' | 'inbox' | 'extracted';

export interface RebuildSource {
  uri: string;
  origin: RebuildSourceOrigin;
}

const SOURCE_SCAN_DIRS: Record<
  Exclude<RebuildSourceOrigin, 'manifest' | 'extracted'>,
  string
> = {
  raw: 'sources/raw',
  inbox: 'sources/inbox',
};

function listFilesRecursive(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }

  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(fullPath));
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function readExtractSourceUri(
  vaultRoot: string,
  extractedPath: string,
): string | undefined {
  const metaPath = extractedPath.replace(/\.md$/i, '.meta.json');
  if (!existsSync(metaPath)) {
    return undefined;
  }

  try {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as {
      source_uri?: string;
    };
    return typeof meta.source_uri === 'string' && meta.source_uri
      ? meta.source_uri
      : undefined;
  } catch {
    return undefined;
  }
}

function discoverFromDirectory(
  vaultRoot: string,
  origin: Exclude<RebuildSourceOrigin, 'manifest' | 'extracted'>,
): RebuildSource[] {
  const relativeDir = SOURCE_SCAN_DIRS[origin];
  const absoluteDir = join(vaultRoot, relativeDir);
  return listFilesRecursive(absoluteDir)
    .filter((file) => statSync(file).isFile())
    .map((file) => ({
      uri: file.replace(/\\/g, '/'),
      origin,
    }));
}

function discoverFromExtracted(vaultRoot: string): RebuildSource[] {
  const extractedDir = join(vaultRoot, 'sources/extracted');
  if (!existsSync(extractedDir)) {
    return [];
  }

  return readdirSync(extractedDir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const absolutePath = join(extractedDir, name).replace(/\\/g, '/');
      const sourceUri =
        readExtractSourceUri(vaultRoot, absolutePath) ?? absolutePath;
      return {
        uri: sourceUri,
        origin: 'extracted' as const,
      };
    });
}

function dedupeSources(sources: RebuildSource[]): RebuildSource[] {
  const seen = new Set<string>();
  const unique: RebuildSource[] = [];
  for (const source of sources) {
    const key = source.uri.replace(/\\/g, '/');
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push({ ...source, uri: key });
  }
  return unique;
}

/** Resolve source URIs to re-ingest when rebuilding a vault. */
export function discoverRebuildSources(
  vaultRoot: string,
  origin: RebuildSourceOrigin = 'manifest',
): RebuildSource[] {
  if (origin === 'manifest') {
    const manifest = loadSourceManifest(vaultRoot);
    const fromManifest = manifest.sources
      .map((entry) => entry.uri)
      .filter((uri): uri is string => typeof uri === 'string' && uri.length > 0)
      .map((uri) => ({ uri, origin: 'manifest' as const }));

    if (fromManifest.length > 0) {
      return dedupeSources(fromManifest);
    }

    const fallback = [
      ...discoverFromDirectory(vaultRoot, 'raw'),
      ...discoverFromDirectory(vaultRoot, 'inbox'),
      ...discoverFromExtracted(vaultRoot),
    ];
    return dedupeSources(fallback);
  }

  if (origin === 'extracted') {
    return dedupeSources(discoverFromExtracted(vaultRoot));
  }

  return dedupeSources(discoverFromDirectory(vaultRoot, origin));
}
