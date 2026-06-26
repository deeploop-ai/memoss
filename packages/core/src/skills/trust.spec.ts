import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverSkills } from './discovery.js';
import {
  isProjectSkillsTrusted,
  writeProjectSkillTrust,
} from './trust.js';
import { writeFileSync } from 'node:fs';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function writeSkill(root: string, name: string): void {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'SKILL.md'),
    `---
name: ${name}
description: Test skill ${name}
---
`,
    'utf8',
  );
}

describe('project skill trust', () => {
  it('loads vault .agents skills only after trust', () => {
    const vaultRoot = mkdtempSync(join(tmpdir(), 'memoss-trust-'));
    tempDirs.push(vaultRoot);

    const agentsDir = join(vaultRoot, '.agents', 'skills');
    mkdirSync(agentsDir, { recursive: true });
    writeSkill(agentsDir, 'project-skill');

    expect(isProjectSkillsTrusted(vaultRoot, false)).toBe(false);
    expect(discoverSkills({ vaultRoot, trustProjectSkills: false }).skills.has('project-skill')).toBe(false);

    writeProjectSkillTrust(vaultRoot);
    expect(isProjectSkillsTrusted(vaultRoot, false)).toBe(true);
    expect(discoverSkills({ vaultRoot, trustProjectSkills: false }).skills.has('project-skill')).toBe(true);
  });
});
