import { CORE_VERSION } from '@memoss/core';

export { startMcpServer } from './server.js';
export type { StartMcpServerOptions } from './server.js';
export {
  createMemossMcpServer,
  createMemossMcpContext,
  MCP_TOOL_NAMES,
  RUNNER_TOOL_NAMES,
  type McpToolName,
  type CreateMemossMcpServerOptions,
} from './mcp-tools.js';
export {
  parseMcpCapabilities,
  resolveMcpToolNames,
  DEFAULT_MCP_CAPABILITIES,
  MCP_CAPABILITY_LEVELS,
  AGENT_TOOL_NAMES,
  READ_TOOL_NAMES,
  WRITE_TOOL_NAMES,
  type McpCapability,
} from './capabilities.js';
export { MCP_SERVER_VERSION } from './version.js';

export function getCoreVersion(): string {
  return CORE_VERSION;
}
