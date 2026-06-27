import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemossError } from '@memoss/core';

export type SchemaPackName = 'research' | 'personal' | 'data-catalog';

const TOKEN_PATTERN = /\{\{(name|description|date)\}\}/g;

export function resolveSchemaPacksRoot(): string {
  const besideBundle = join(
    dirname(fileURLToPath(import.meta.url)),
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

  throw new MemossError(
    'VAULT_NOT_FOUND',
    'Could not locate schema-packs directory.',
  );
}

export function initVaultFromSchemaPack(
  targetPath: string,
  pack: SchemaPackName,
  vars: { name: string; description: string },
): void {
  if (existsSync(join(targetPath, '.memoss', 'config.yaml'))) {
    throw new MemossError(
      'VAULT_NOT_FOUND',
      `Vault already exists at ${targetPath}`,
    );
  }

  const sourceRoot = join(resolveSchemaPacksRoot(), pack);
  if (!existsSync(sourceRoot)) {
    throw new MemossError(
      'VAULT_NOT_FOUND',
      `Schema pack "${pack}" not found at ${sourceRoot}`,
    );
  }

  const replacements = {
    name: vars.name,
    description: vars.description,
    date: new Date().toISOString().slice(0, 10),
  };

  copyTemplateDir(sourceRoot, targetPath, replacements);
}

function copyTemplateDir(
  sourceRoot: string,
  targetRoot: string,
  replacements: Record<string, string>,
): void {
  mkdirSync(targetRoot, { recursive: true });

  for (const entry of readdirSync(sourceRoot)) {
    const sourcePath = join(sourceRoot, entry);
    const targetPath = join(targetRoot, entry);
    const stats = statSync(sourcePath);

    if (stats.isDirectory()) {
      copyTemplateDir(sourcePath, targetPath, replacements);
      continue;
    }

    if (entry === '.gitkeep') {
      continue;
    }

    const raw = readFileSync(sourcePath, 'utf8');
    const rendered = raw.replace(TOKEN_PATTERN, (_, key: string) => {
      return replacements[key] ?? '';
    });
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, rendered, 'utf8');
  }
}

export function copySchemaPackForBundle(sourceRoot: string, destRoot: string): void {
  cpSync(sourceRoot, destRoot, { recursive: true });
}
