import type { Tool } from 'ai';
import type { ToolContext } from './context.js';
import {
  createAppendLogTool,
  createDeletePageTool,
  createFetchUrlTool,
  createGitCommitTool,
  createGitCreateBranchTool,
  createGitDiffTool,
  createGitLogTool,
  createGitMergeTool,
  createListPagesTool,
  createListSourcesTool,
  createReadIndexTool,
  createReadLogTool,
  createReadPageTool,
  createReadSourceTool,
  createSearchKbTool,
  createWriteIndexTool,
  createWritePageTool,
} from './page-tools.js';

export const TOOL_NAMES = [
  'read_page',
  'write_page',
  'list_pages',
  'delete_page',
  'read_index',
  'write_index',
  'search_kb',
  'read_log',
  'append_log',
  'fetch_url',
  'read_source',
  'list_sources',
  'git_commit',
  'git_diff',
  'git_log',
  'git_create_branch',
  'git_merge',
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export type ToolRegistry = Record<ToolName, Tool>;

export function createToolRegistry(ctx: ToolContext): ToolRegistry {
  return {
    read_page: createReadPageTool(ctx),
    write_page: createWritePageTool(ctx),
    list_pages: createListPagesTool(ctx),
    delete_page: createDeletePageTool(ctx),
    read_index: createReadIndexTool(ctx),
    write_index: createWriteIndexTool(ctx),
    search_kb: createSearchKbTool(ctx),
    read_log: createReadLogTool(ctx),
    append_log: createAppendLogTool(ctx),
    fetch_url: createFetchUrlTool(ctx),
    read_source: createReadSourceTool(ctx),
    list_sources: createListSourcesTool(ctx),
    git_commit: createGitCommitTool(ctx),
    git_diff: createGitDiffTool(ctx),
    git_log: createGitLogTool(ctx),
    git_create_branch: createGitCreateBranchTool(ctx),
    git_merge: createGitMergeTool(ctx),
  };
}
