import type { ToolName, ToolRegistry } from '../tools/registry.js';

export const INGEST_TOOL_NAMES = [
  'read_page',
  'write_page',
  'list_pages',
  'read_index',
  'write_index',
  'read_log',
  'append_log',
  'fetch_url',
  'read_source',
  'list_sources',
  'git_commit',
  'git_diff',
  'git_create_branch',
] as const satisfies readonly ToolName[];

export const QUERY_TOOL_NAMES = [
  'read_page',
  'read_index',
  'search_kb',
] as const satisfies readonly ToolName[];

export const QUERY_SAVE_TOOL_NAMES = [
  ...QUERY_TOOL_NAMES,
  'write_page',
  'append_log',
] as const satisfies readonly ToolName[];

export const LINT_TOOL_NAMES = [
  'read_page',
  'list_pages',
  'read_index',
  'search_kb',
] as const satisfies readonly ToolName[];

export const LINT_FIX_TOOL_NAMES = [
  ...LINT_TOOL_NAMES,
  'write_page',
  'write_index',
  'append_log',
  'git_commit',
  'git_diff',
  'git_create_branch',
] as const satisfies readonly ToolName[];

export type IngestToolName = (typeof INGEST_TOOL_NAMES)[number];
export type QueryToolName = (typeof QUERY_SAVE_TOOL_NAMES)[number];
export type LintToolName = (typeof LINT_FIX_TOOL_NAMES)[number];

export function pickTools(
  registry: ToolRegistry,
  names: readonly ToolName[],
): Partial<ToolRegistry> {
  const picked: Partial<ToolRegistry> = {};
  for (const name of names) {
    picked[name] = registry[name];
  }
  return picked;
}
