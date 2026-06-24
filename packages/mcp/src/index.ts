import { CORE_VERSION } from '@memoss/core';

export { startMcpServer } from './server.js';
export type { StartMcpServerOptions } from './server.js';

/** MCP server entry (M6). */
export const MCP_SERVER_VERSION = '0.0.1';

export function getCoreVersion(): string {
  return CORE_VERSION;
}
