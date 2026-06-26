import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  getUserAgentsSkillsDir,
  getUserMemossSkillsDir,
} from '../config/user-paths.js';
import { parseSkillMd } from './parse-skill-md.js';
import { isProjectSkillsTrusted } from './trust.js';
import type { SkillRecord, SkillScope } from './types.js';

export interface DiscoverSkillsOptions {
  vaultRoot?: string;
  trustProjectSkills?: boolean;
}

export interface DiscoverSkillsResult {
  skills: Map<string, SkillRecord>;
  warnings: string[];
}

interface ScanTarget {
  dir: string;
  scope: SkillScope;
  enabled: boolean;
}

function listSkillDirs(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  const dirs: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) {
      continue;
    }
    const skillMd = join(root, entry.name, 'SKILL.md');
    if (existsSync(skillMd)) {
      dirs.push(join(root, entry.name));
    }
  }
  return dirs;
}

function loadSkillFromDir(dir: string, scope: SkillScope): SkillRecord | null {
  const location = join(dir, 'SKILL.md');
  const parsed = parseSkillMd(readFileSync(location, 'utf8'));
  if (!parsed) {
    return null;
  }

  return {
    name: parsed.name,
    description: parsed.description,
    compatibility: parsed.compatibility,
    allowedTools: parsed.allowedTools,
    location,
    baseDir: dir,
    scope,
  };
}

function buildScanTargets(opts: DiscoverSkillsOptions): ScanTarget[] {
  const vaultRoot = opts.vaultRoot;
  const projectTrusted =
    vaultRoot != null &&
    isProjectSkillsTrusted(vaultRoot, opts.trustProjectSkills ?? false);

  return [
    {
      dir: getUserAgentsSkillsDir(),
      scope: 'user-agents',
      enabled: true,
    },
    {
      dir: getUserMemossSkillsDir(),
      scope: 'user-memoss',
      enabled: true,
    },
    {
      dir: vaultRoot ? join(vaultRoot, '.agents', 'skills') : '',
      scope: 'vault-agents',
      enabled: Boolean(vaultRoot && projectTrusted),
    },
    {
      dir: vaultRoot ? join(vaultRoot, '.memoss', 'skills') : '',
      scope: 'vault-memoss',
      enabled: Boolean(vaultRoot),
    },
  ];
}

/** Later scan targets override earlier ones (vault-memoss wins). */
export function discoverSkills(
  opts: DiscoverSkillsOptions = {},
): DiscoverSkillsResult {
  const skills = new Map<string, SkillRecord>();
  const warnings: string[] = [];

  for (const target of buildScanTargets(opts)) {
    if (!target.enabled || !target.dir) {
      continue;
    }

    for (const dir of listSkillDirs(target.dir)) {
      const record = loadSkillFromDir(dir, target.scope);
      if (!record) {
        warnings.push(`Skipped invalid skill at ${join(dir, 'SKILL.md')}`);
        continue;
      }

      if (skills.has(record.name)) {
        warnings.push(
          `Skill "${record.name}" shadowed by higher-priority installation`,
        );
      }
      skills.set(record.name, record);
    }
  }

  return { skills, warnings };
}

export function getSkillMtime(record: SkillRecord): number {
  return statSync(record.location).mtimeMs;
}
