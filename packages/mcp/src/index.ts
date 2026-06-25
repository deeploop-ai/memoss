import { CORE_VERSION } from '@memoss/core';

export { startMcpServer } from './server.js';
export type { StartMcpServerOptions } from './server.js';
export {
  createMemossMcpServer,
  createMemossMcpContext,
  MCP_TOOL_NAMES,
  RUNNER_TOOL_NAMES,
  type McpToolName,
} from './mcp-tools.js';

/** MCP server entry (M6). */
export const MCP_SERVER_VERSION = '0.0.1';

export function getCoreVersion(): string {
  return CORE_VERSION;
}
