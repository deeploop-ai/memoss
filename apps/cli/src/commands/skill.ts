import { spawn } from 'node:child_process';
import { defineCommand } from 'citty';
import { consola } from 'consola';
import {
  discoverSkills,
  isProjectSkillsTrusted,
  writeProjectSkillTrust,
} from '@memoss/core';
import { resolveVaultRoot } from '../utils/vault.js';

function runNpxSkills(args: string[]): Promise<number> {
  return new Promise((resolveExit, reject) => {
    const child = spawn('npx', ['skills', ...args], {
      stdio: 'inherit',
      shell: false,
      env: process.env,
    });
    child.on('error', reject);
    child.on('close', (code) => resolveExit(code ?? 1));
  });
}

export const skillCommand = defineCommand({
  meta: {
    name: 'skill',
    description: 'Manage extraction skills (skills.sh ecosystem)',
  },
  subCommands: {
    add: defineCommand({
      meta: {
        name: 'add',
        description: 'Install a skill via npx skills add',
      },
      args: {
        source: {
          type: 'positional',
          description: 'Skill package (owner/repo or URL)',
          required: true,
        },
        skill: {
          type: 'string',
          description: 'Specific skill name within the package',
        },
        global: {
          type: 'boolean',
          alias: 'g',
          description: 'Install to user-level ~/.agents/skills',
          default: false,
        },
        yes: {
          type: 'boolean',
          alias: 'y',
          description: 'Skip confirmation prompts',
          default: true,
        },
        vault: {
          type: 'string',
          alias: 'C',
          description: 'Vault root path (for project-level install cwd)',
        },
      },
      async run({ args }) {
        const vaultRoot = resolveVaultRoot(args);
        const cliArgs = ['add', args.source];
        if (args.global) {
          cliArgs.push('-g');
        } else {
          cliArgs.push('--dir', `${vaultRoot}/.agents/skills`);
        }
        if (args.skill) {
          cliArgs.push('--skill', args.skill);
        }
        if (args.yes) {
          cliArgs.push('-y');
        }

        consola.info(
          args.global
            ? 'Installing skill to user-level ~/.agents/skills'
            : `Installing skill into ${vaultRoot}/.agents/skills`,
        );
        const code = await runNpxSkills(cliArgs);
        if (code !== 0) {
          consola.error('Skill install failed. Ensure Node.js and npx are available.');
          process.exit(code);
        }
        consola.success('Skill installed.');
      },
    }),
    list: defineCommand({
      meta: {
        name: 'list',
        description: 'List discovered extraction skills',
      },
      args: {
        vault: {
          type: 'string',
          alias: 'C',
          description: 'Vault root path',
        },
      },
      async run({ args }) {
        const vaultRoot = resolveVaultRoot(args);
        const trusted = isProjectSkillsTrusted(
          vaultRoot,
          false,
        );
        const { skills, warnings } = discoverSkills({
          vaultRoot,
          trustProjectSkills: trusted,
        });

        for (const warning of warnings) {
          consola.warn(warning);
        }

        if (skills.size === 0) {
          consola.info('No skills found. Install one with: memoss skill add <owner/repo>');
          return;
        }

        for (const skill of [...skills.values()].sort((a, b) =>
          a.name.localeCompare(b.name),
        )) {
          consola.log(`${skill.name}  [${skill.scope}]`);
          consola.log(`  ${skill.description}`);
        }
      },
    }),
    trust: defineCommand({
      meta: {
        name: 'trust',
        description: 'Trust project-level skills in .agents/skills/',
      },
      args: {
        vault: {
          type: 'string',
          alias: 'C',
          description: 'Vault root path',
        },
      },
      async run({ args }) {
        const vaultRoot = resolveVaultRoot(args);
        const record = writeProjectSkillTrust(vaultRoot);
        consola.success(`Trusted project skills at ${vaultRoot}`);
        consola.info(`Trusted at ${record.trusted_at}`);
      },
    }),
    update: defineCommand({
      meta: {
        name: 'update',
        description: 'Update installed skills via npx skills update',
      },
      args: {
        global: {
          type: 'boolean',
          alias: 'g',
          description: 'Update user-level skills',
          default: false,
        },
        yes: {
          type: 'boolean',
          alias: 'y',
          description: 'Skip confirmation prompts',
          default: true,
        },
      },
      async run({ args }) {
        const cliArgs = ['update'];
        if (args.global) {
          cliArgs.push('-g');
        }
        if (args.yes) {
          cliArgs.push('-y');
        }
        const code = await runNpxSkills(cliArgs);
        process.exit(code);
      },
    }),
  },
});
