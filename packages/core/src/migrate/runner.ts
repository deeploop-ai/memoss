import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { FsKnowledgeStore } from '../adapters/fs-store.js';
import { loadVaultConfig } from '../config/vault-config.js';
import { parsePoliciesConfig } from '../policies/config.js';
import { regenerateIndexes } from '../okf/index-builder.js';
import { runDeterministicLint } from '../lint/checks.js';
import { computeHealthScore, summarizeLintIssues } from '../lint/score.js';
import { MemossError } from '../errors.js';

export interface MigrateOptions {
  vaultRoot: string;
  dryRun?: boolean;
  fix?: boolean;
}

export interface MigrateReport {
  configUpgraded: boolean;
  indexesRebuilt: string[];
  citationsFixed: string[];
  issuesBefore: ReturnType<typeof summarizeLintIssues>;
  healthScoreBefore: number;
  healthScoreAfter?: number;
}

function upgradeConfig(vaultRoot: string, dryRun: boolean): boolean {
  const configPath = join(vaultRoot, '.memoss', 'config.yaml');
  if (!existsSync(configPath)) {
    return false;
  }

  const raw = readFileSync(configPath, 'utf8');
  let changed = false;
  let content = raw;

  if (!content.includes('flash_model:') && content.includes('lightweight_model:')) {
    content = content.replace(/lightweight_model:/g, 'flash_model:');
    changed = true;
  }

  if (!content.includes('policies:')) {
    const defaults = parsePoliciesConfig({});
    const policiesYaml = stringifyYaml({ policies: defaults }).trim();
    content = `${content.trim()}\n\n${policiesYaml}\n`;
    changed = true;
  }

  if (changed && !dryRun) {
    writeFileSync(configPath, content, 'utf8');
  }

  return changed;
}

async function fixCitationsFromResource(
  store: FsKnowledgeStore,
  pages: string[],
): Promise<string[]> {
  const fixed: string[] = [];
  for (const page of pages) {
    if (page.endsWith('index.md') || page.endsWith('log.md')) {
      continue;
    }
    const doc = await store.readPage(page);
    const resource = doc.frontmatter.resource;
    if (typeof resource !== 'string' || !resource) {
      continue;
    }
    if (doc.body.includes('# Citations')) {
      if (doc.body.includes(resource)) {
        continue;
      }
      await store.writePage(page, {
        frontmatter: doc.frontmatter,
        body: `${doc.body.trim()}\n- ${resource}\n`,
      });
      fixed.push(page);
      continue;
    }
    await store.writePage(page, {
      frontmatter: doc.frontmatter,
      body: `${doc.body.trim()}\n\n# Citations\n\n- ${resource}\n`,
    });
    fixed.push(page);
  }
  return fixed;
}

export async function runMigrate(opts: MigrateOptions): Promise<MigrateReport> {
  if (!existsSync(join(opts.vaultRoot, '.memoss', 'config.yaml'))) {
    throw new MemossError(
      'VAULT_NOT_FOUND',
      `No vault found at ${opts.vaultRoot}`,
    );
  }

  const store = new FsKnowledgeStore(opts.vaultRoot);
  const before = await runDeterministicLint(store);
  const scoreBefore = computeHealthScore(before.issues, before.pageCount);

  const configUpgraded = upgradeConfig(opts.vaultRoot, opts.dryRun === true);

  let indexesRebuilt: string[] = [];
  let citationsFixed: string[] = [];
  let scoreAfter: number | undefined;

  if (opts.fix && !opts.dryRun) {
    if (configUpgraded) {
      loadVaultConfig(opts.vaultRoot);
    }
    indexesRebuilt = regenerateIndexes(opts.vaultRoot);
    const pages = await store.listPages();
    citationsFixed = await fixCitationsFromResource(store, pages);
    const after = await runDeterministicLint(store);
    scoreAfter = computeHealthScore(after.issues, after.pageCount);
  }

  return {
    configUpgraded,
    indexesRebuilt,
    citationsFixed,
    issuesBefore: summarizeLintIssues(before.issues),
    healthScoreBefore: scoreBefore,
    healthScoreAfter: scoreAfter,
  };
}
