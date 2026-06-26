import { defineCommand } from 'citty';
import { CORE_VERSION } from '@memoss/core';
import { initCommand } from './commands/init.js';
import { ingestCommand } from './commands/ingest.js';
import { queryCommand } from './commands/query.js';
import { lintCommand } from './commands/lint.js';
import { approveCommand } from './commands/approve.js';
import { rejectCommand } from './commands/reject.js';
import { statusCommand } from './commands/status.js';
import { viewCommand } from './commands/view.js';
import { mcpCommand } from './commands/mcp.js';

export const mainCommand = defineCommand({
  meta: {
    name: 'memoss',
    version: CORE_VERSION,
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
    view: viewCommand,
    mcp: mcpCommand,
  },
});
