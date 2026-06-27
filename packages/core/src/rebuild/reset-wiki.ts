import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FsKnowledgeStore } from '../adapters/fs-store.js';
import type { VaultConfig } from '../config/vault-config.js';

const TOKEN_PATTERN = /\{\{(name|description|date)\}\}/g;
const PRESERVE_PREFIXES = ['sources/', '.memoss/cache/'];

function resolveSchemaPacksRoot(): string {
  const besideBundle = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
    '..',
    'schema-packs',
  );
  if (existsSync(besideBundle)) {
    return besideBundle;
  }

  let dir = process.cwd();
  while (true) {
    const candidate = join(dir, 'schema-packs');
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  throw new Error('Could not locate schema-packs directory.');
}

function shouldPreservePage(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/');
  return PRESERVE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function copyWikiSkeleton(
  schemaPackRoot: string,
  vaultRoot: string,
  config: VaultConfig,
): void {
  const replacements = {
    name: config.name,
    description: config.description,
    date: new Date().toISOString().slice(0, 10),
  };

  function walk(sourceRoot: string, targetRoot: string): void {
    for (const entry of readdirSync(sourceRoot)) {
      const sourcePath = join(sourceRoot, entry);
      const targetPath = join(targetRoot, entry);
      const stats = statSync(sourcePath);

      if (stats.isDirectory()) {
        if (entry === 'sources') {
          continue;
        }
        mkdirSync(targetPath, { recursive: true });
        walk(sourcePath, targetPath);
        continue;
      }

      if (entry === '.gitkeep') {
        continue;
      }

      const relative = targetPath
        .slice(resolve(vaultRoot).length + 1)
        .replace(/\\/g, '/');
      if (relative === '.memoss/config.yaml') {
        continue;
      }

      const raw = readFileSync(sourcePath, 'utf8');
      const rendered = raw.replace(TOKEN_PATTERN, (_, key: string) => {
        return replacements[key as keyof typeof replacements] ?? '';
      });
      mkdirSync(dirname(targetPath), { recursive: true });
      writeFileSync(targetPath, rendered, 'utf8');
    }
  }

  walk(schemaPackRoot, vaultRoot);
}

/** Remove wiki pages and restore the schema-pack skeleton (sources/ untouched). */
export async function resetWikiContent(
  vaultRoot: string,
  config: VaultConfig,
): Promise<{ pagesRemoved: number }> {
  const store = new FsKnowledgeStore(vaultRoot);
  const pages = await store.listPages();
  let pagesRemoved = 0;

  for (const page of pages) {
    if (shouldPreservePage(page)) {
      continue;
    }
    await store.deletePage(page);
    pagesRemoved += 1;
  }

  const schemaPackRoot = join(
    resolveSchemaPacksRoot(),
    config.schema_pack,
  );
  if (!existsSync(schemaPackRoot)) {
    throw new Error(
      `Schema pack "${config.schema_pack}" not found at ${schemaPackRoot}`,
    );
  }

  copyWikiSkeleton(schemaPackRoot, vaultRoot, config);

  for (const dirName of ['topics', 'references', 'notes', 'tables', 'data']) {
    const dirPath = join(vaultRoot, dirName);
    if (!existsSync(dirPath)) {
      continue;
    }
    pruneEmptyDirectories(dirPath);
  }

  return { pagesRemoved };
}

function pruneEmptyDirectories(dirPath: string): void {
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const childPath = join(dirPath, entry.name);
    pruneEmptyDirectories(childPath);
    if (readdirSync(childPath).length === 0) {
      rmSync(childPath, { recursive: true, force: true });
    }
  }
}
