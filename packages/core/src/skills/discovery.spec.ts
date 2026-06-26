import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverSkills } from './discovery.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function writeSkill(root: string, name: string, description: string): void {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'SKILL.md'),
    `---
name: ${name}
description: ${description}
---

# ${name}
`,
    'utf8',
  );
}

describe('discoverSkills', () => {
  it('discovers vault-memoss skills over user skills', () => {
    const vaultRoot = mkdtempSync(join(tmpdir(), 'memoss-skills-'));
    tempDirs.push(vaultRoot);

    const userAgents = join(vaultRoot, '.agents', 'skills');
    const vaultMemoss = join(vaultRoot, '.memoss', 'skills');
    mkdirSync(userAgents, { recursive: true });
    mkdirSync(vaultMemoss, { recursive: true });

    writeSkill(userAgents, 'web-tool', 'User skill');
    writeSkill(vaultMemoss, 'web-tool', 'Vault override skill');

    const originalHome = process.env.HOME;
    const originalUserProfile = process.env.USERPROFILE;
    process.env.HOME = vaultRoot;
    process.env.USERPROFILE = vaultRoot;

    try {
      const { skills } = discoverSkills({
        vaultRoot,
        trustProjectSkills: false,
      });
      expect(skills.get('web-tool')?.description).toBe('Vault override skill');
      expect(skills.get('web-tool')?.scope).toBe('vault-memoss');
    } finally {
      if (originalHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = originalHome;
      }
      if (originalUserProfile === undefined) {
        delete process.env.USERPROFILE;
      } else {
        process.env.USERPROFILE = originalUserProfile;
      }
    }
  });
});
