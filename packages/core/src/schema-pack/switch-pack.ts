import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { loadVaultConfig, type VaultConfig } from '../config/vault-config.js';
import { MemossError } from '../errors.js';
import {
  resolveSchemaPacksRoot,
  type SchemaPackName,
} from './resolve-root.js';

const TOKEN_PATTERN = /\{\{(name|description|date)\}\}/g;
const SCHEMA_PACKS: SchemaPackName[] = ['personal', 'research', 'data-catalog'];

export interface SwitchSchemaPackOptions {
  vaultRoot: string;
  pack: SchemaPackName;
  schemaPacksRoot?: string;
  dryRun?: boolean;
  updateIndex?: boolean;
}

export interface SwitchSchemaPackReport {
  previousPack: SchemaPackName;
  newPack: SchemaPackName;
  changed: boolean;
  configUpdated: boolean;
  instructionsUpdated: boolean;
  scaffoldAdded: string[];
}

export function listSchemaPacks(): SchemaPackName[] {
  return [...SCHEMA_PACKS];
}

function renderTemplate(
  raw: string,
  config: Pick<VaultConfig, 'name' | 'description'>,
): string {
  const replacements = {
    name: config.name,
    description: config.description,
    date: new Date().toISOString().slice(0, 10),
  };
  return raw.replace(TOKEN_PATTERN, (_, key: string) => {
    return replacements[key as keyof typeof replacements] ?? '';
  });
}

function resolvePackRoot(
  pack: SchemaPackName,
  schemaPacksRoot?: string,
): string {
  const root = join(resolveSchemaPacksRoot(schemaPacksRoot), pack);
  if (!existsSync(root)) {
    throw new MemossError(
      'VAULT_NOT_FOUND',
      `Schema pack "${pack}" not found at ${root}`,
    );
  }
  return root;
}

function updateConfigSchemaPack(
  configPath: string,
  pack: SchemaPackName,
  dryRun: boolean,
): boolean {
  const raw = readFileSync(configPath, 'utf8');
  const parsed = parseYaml(raw) as Record<string, unknown>;
  if (parsed.schema_pack === pack) {
    return false;
  }
  parsed.schema_pack = pack;
  if (!dryRun) {
    writeFileSync(configPath, `${stringifyYaml(parsed).trim()}\n`, 'utf8');
  }
  return true;
}

function copyMissingScaffold(
  sourceRoot: string,
  targetRoot: string,
  config: VaultConfig,
  options: {
    dryRun: boolean;
    updateIndex: boolean;
  },
): string[] {
  const added: string[] = [];

  function walk(sourceDir: string, targetDir: string): void {
    for (const entry of readdirSync(sourceDir)) {
      const sourcePath = join(sourceDir, entry);
      const targetPath = join(targetDir, entry);
      const stats = statSync(sourcePath);

      if (stats.isDirectory()) {
        if (entry === 'sources') {
          continue;
        }
        if (!existsSync(targetPath) && !options.dryRun) {
          mkdirSync(targetPath, { recursive: true });
        }
        walk(sourcePath, targetPath);
        continue;
      }

      if (entry === '.gitkeep') {
        continue;
      }

      const relative = targetPath
        .slice(targetRoot.length + 1)
        .replace(/\\/g, '/');

      if (relative === '.memoss/config.yaml') {
        continue;
      }
      if (relative === '.memoss/instructions.md') {
        continue;
      }
      if (!options.updateIndex && (relative === 'index.md' || relative === 'README.md')) {
        continue;
      }
      if (existsSync(targetPath)) {
        continue;
      }

      const raw = readFileSync(sourcePath, 'utf8');
      const rendered = renderTemplate(raw, config);
      if (!options.dryRun) {
        mkdirSync(dirname(targetPath), { recursive: true });
        writeFileSync(targetPath, rendered, 'utf8');
      }
      added.push(relative);
    }
  }

  walk(sourceRoot, targetRoot);
  return added.sort();
}

/** Switch an existing vault to a different schema pack without touching wiki pages. */
export async function runSwitchSchemaPack(
  opts: SwitchSchemaPackOptions,
): Promise<SwitchSchemaPackReport> {
  const configPath = join(opts.vaultRoot, '.memoss', 'config.yaml');
  if (!existsSync(configPath)) {
    throw new MemossError(
      'VAULT_NOT_FOUND',
      `No vault found at ${opts.vaultRoot}`,
    );
  }

  if (!SCHEMA_PACKS.includes(opts.pack)) {
    throw new MemossError(
      'VAULT_NOT_FOUND',
      `Unsupported schema pack "${opts.pack}". Use personal, research, or data-catalog.`,
    );
  }

  const config = loadVaultConfig(opts.vaultRoot);
  const previousPack = config.schema_pack;

  if (previousPack === opts.pack) {
    return {
      previousPack,
      newPack: opts.pack,
      changed: false,
      configUpdated: false,
      instructionsUpdated: false,
      scaffoldAdded: [],
    };
  }

  const packRoot = resolvePackRoot(opts.pack, opts.schemaPacksRoot);
  const instructionsSource = join(packRoot, '.memoss', 'instructions.md');
  const instructionsTarget = join(opts.vaultRoot, '.memoss', 'instructions.md');

  if (!existsSync(instructionsSource)) {
    throw new MemossError(
      'VAULT_NOT_FOUND',
      `Schema pack "${opts.pack}" is missing .memoss/instructions.md`,
    );
  }

  const dryRun = opts.dryRun === true;
  const configUpdated = updateConfigSchemaPack(configPath, opts.pack, dryRun);

  let instructionsUpdated = false;
  const nextInstructions = renderTemplate(
    readFileSync(instructionsSource, 'utf8'),
    config,
  );
  const currentInstructions = existsSync(instructionsTarget)
    ? readFileSync(instructionsTarget, 'utf8')
    : '';
  if (currentInstructions !== nextInstructions) {
    instructionsUpdated = true;
    if (!dryRun) {
      writeFileSync(instructionsTarget, nextInstructions, 'utf8');
    }
  }

  const scaffoldAdded = copyMissingScaffold(packRoot, opts.vaultRoot, config, {
    dryRun,
    updateIndex: opts.updateIndex === true,
  });

  return {
    previousPack,
    newPack: opts.pack,
    changed: configUpdated || instructionsUpdated || scaffoldAdded.length > 0,
    configUpdated,
    instructionsUpdated,
    scaffoldAdded,
  };
}
