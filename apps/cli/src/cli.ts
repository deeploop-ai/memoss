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
import { CLI_VERSION } from './version.js';

export const mainCommand = defineCommand({
  meta: {
    name: 'memoss',
    version: CLI_VERSION,
    description: 'Agent-native knowledge runtime',
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
  },
});
