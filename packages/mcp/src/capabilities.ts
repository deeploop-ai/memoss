import type { ToolName } from '@memoss/core';
import type { McpToolName, RunnerToolName } from './mcp-tools.js';

export const MCP_CAPABILITY_LEVELS = ['agent', 'read', 'write'] as const;
export type McpCapability = (typeof MCP_CAPABILITY_LEVELS)[number];

export const DEFAULT_MCP_CAPABILITIES: readonly McpCapability[] = ['agent'];

export const AGENT_TOOL_NAMES: readonly RunnerToolName[] = [
  'run_query',
  'run_ingest',
  'run_ingest_status',
  'run_extract',
  'run_lint',
];

export const READ_TOOL_NAMES: readonly ToolName[] = [
  'read_page',
  'list_pages',
  'read_index',
  'read_log',
  'search_kb',
  'read_source',
  'list_sources',
  'fetch_url',
  'git_diff',
  'git_log',
];

export const WRITE_TOOL_NAMES: readonly ToolName[] = [
  'write_page',
  'write_index',
  'append_log',
  'delete_page',
  'git_commit',
  'git_create_branch',
  'git_merge',
];

export function parseMcpCapabilities(
  value: string | undefined,
): McpCapability[] {
  const raw = (value ?? 'agent').trim().toLowerCase();
  if (!raw || raw === 'agent') {
    return ['agent'];
  }
  if (raw === 'full') {
    return ['agent', 'read', 'write'];
  }

  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const enabled = new Set<McpCapability>();
  for (const part of parts) {
    if (part === 'full') {
      for (const level of MCP_CAPABILITY_LEVELS) {
        enabled.add(level);
      }
      continue;
    }
    if (!MCP_CAPABILITY_LEVELS.includes(part as McpCapability)) {
      throw new Error(
        `Invalid MCP capability "${part}". Use agent, read, write, or full.`,
      );
    }
    enabled.add(part as McpCapability);
  }

  if (enabled.size === 0) {
    return [...DEFAULT_MCP_CAPABILITIES];
  }

  return MCP_CAPABILITY_LEVELS.filter((level) => enabled.has(level));
}

export function resolveMcpToolNames(
  capabilities: readonly McpCapability[],
): McpToolName[] {
  const names: McpToolName[] = [];
  const enabled = new Set(capabilities);

  if (enabled.has('agent')) {
    names.push(...AGENT_TOOL_NAMES);
  }
  if (enabled.has('read')) {
    names.push(...READ_TOOL_NAMES);
  }
  if (enabled.has('write')) {
    names.push(...WRITE_TOOL_NAMES);
  }

  return names;
}

export function hasMcpCapability(
  capabilities: readonly McpCapability[],
  level: McpCapability,
): boolean {
  return capabilities.includes(level);
}
