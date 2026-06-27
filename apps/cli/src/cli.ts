import { defineCommand } from 'citty';
import { initCommand } from './commands/init.js';
import { ingestCommand } from './commands/ingest.js';
import { queryCommand } from './commands/query.js';
import { lintCommand } from './commands/lint.js';
import { approveCommand } from './commands/approve.js';
import { rejectCommand } from './commands/reject.js';
import { statusCommand } from './commands/status.js';
import { graphCommand } from './commands/graph.js';
import { mcpCommand } from './commands/mcp.js';
import { extractCommand } from './commands/extract.js';
import { skillCommand } from './commands/skill.js';
import { migrateCommand } from './commands/migrate.js';
import { runShellRepl } from './tui/shell-repl.js';
import { CLI_VERSION } from './version.js';

const GLOBAL_FLAGS = new Set([
  '--version',
  '-v',
  '--help',
  '-h',
]);

export function shouldLaunchShell(rawArgs: string[]): boolean {
  if (process.env.MEMOSS_NO_TUI === '1') {
    return false;
  }
  if (rawArgs.includes('--no-tui') || rawArgs.includes('--noTui')) {
    return false;
  }
  if (rawArgs.some((arg) => GLOBAL_FLAGS.has(arg))) {
    return false;
  }
  const subcommands = new Set([
    'init',
    'ingest',
    'query',
    'lint',
    'approve',
    'reject',
    'status',
    'graph',
    'mcp',
    'extract',
    'skill',
    'migrate',
  ]);
  const positional = rawArgs.filter(
    (arg) => !arg.startsWith('-') && arg !== 'memoss',
  );
  if (positional.length === 0) {
    return true;
  }
  return !subcommands.has(positional[0]);
}

export const mainCommand = defineCommand({
  meta: {
    name: 'memoss',
    version: CLI_VERSION,
    description: 'Agent-native knowledge runtime',
  },
  args: {
    noTui: {
      type: 'boolean',
      alias: 'no-tui',
      description: 'Disable interactive shell when no subcommand is given',
      default: false,
    },
  },
  subCommands: {
    init: initCommand,
    ingest: ingestCommand,
    query: queryCommand,
    lint: lintCommand,
    approve: approveCommand,
    reject: rejectCommand,
    status: statusCommand,
    graph: graphCommand,
    mcp: mcpCommand,
    extract: extractCommand,
    skill: skillCommand,
    migrate: migrateCommand,
  },
});

export async function runCli(rawArgs: string[]): Promise<void> {
  if (shouldLaunchShell(rawArgs)) {
    await runShellRepl();
    return;
  }
  const { runMain } = await import('citty');
  await runMain(mainCommand, { rawArgs });
}
