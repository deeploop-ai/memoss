import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { MemossError } from '../errors.js';
import { parseSkillMd } from './parse-skill-md.js';
import type { ActivatedSkill, SkillRecord } from './types.js';

const RESOURCE_DIRS = ['scripts', 'references', 'assets'] as const;

function listResources(baseDir: string): string[] {
  const resources: string[] = [];
  for (const dirName of RESOURCE_DIRS) {
    const dir = join(baseDir, dirName);
    if (!existsSync(dir)) {
      continue;
    }
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isFile()) {
        resources.push(relative(baseDir, fullPath).replace(/\\/g, '/'));
      }
    }
  }
  return resources.sort();
}

export function activateSkill(record: SkillRecord): ActivatedSkill {
  const parsed = parseSkillMd(readFileSync(record.location, 'utf8'));
  if (!parsed) {
    throw new MemossError(
      'SKILL_ERROR',
      `Failed to parse skill at ${record.location}`,
    );
  }

  return {
    record,
    body: parsed.body,
    resources: listResources(record.baseDir),
  };
}

export function findSkillByName(
  skills: Map<string, SkillRecord>,
  name: string,
): SkillRecord {
  const record = skills.get(name);
  if (!record) {
    throw new MemossError('SKILL_ERROR', `Skill not found: ${name}`);
  }
  return record;
}
