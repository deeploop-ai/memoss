import { defineCommand } from 'citty';
import { serveCommand } from './serve.js';

export const mcpCommand = defineCommand({
  meta: {
    name: 'mcp',
    description: 'Model Context Protocol commands',
  },
  subCommands: {
    serve: serveCommand,
  },
});
