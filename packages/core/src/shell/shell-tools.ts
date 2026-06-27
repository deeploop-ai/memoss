import { tool, type Tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from '../tools/context.js';
import type { ShellTaskProposal } from './session.js';

export const proposeTaskSchema = z.object({
  task: z.enum(['ingest', 'query', 'lint', 'approve', 'reject', 'status']),
  params: z.record(z.string(), z.unknown()).default({}),
  rationale: z.string().optional(),
});

export interface ShellProposalState {
  proposal?: ShellTaskProposal;
}

export function createProposeTaskTool(state: ShellProposalState): Tool {
  return tool({
    description:
      'Propose a vault task for user confirmation. Does not execute the task.',
    inputSchema: proposeTaskSchema,
    execute: async (input) => {
      state.proposal = input;
      return { proposed: true, task: input.task };
    },
  });
}

export function createGetVaultStatusTool(ctx: ToolContext): Tool {
  return tool({
    description: 'Get vault page count, schema pack, and git branch summary.',
    inputSchema: z.object({}),
    execute: async () => {
      const pages = await ctx.store.listPages();
      const branch = ctx.config.git.enabled
        ? await ctx.git.getCurrentBranch().catch(() => 'unknown')
        : 'git-disabled';
      return {
        name: ctx.config.name,
        schemaPack: ctx.config.schema_pack,
        pageCount: pages.length,
        gitBranch: branch,
      };
    },
  });
}

export function createGetRecentLogTool(ctx: ToolContext): Tool {
  return tool({
    description: 'Read recent entries from log.md.',
    inputSchema: z.object({
      lines: z.number().int().positive().max(20).default(5),
    }),
    execute: async ({ lines }) => {
      const content = await ctx.store.readLog();
      const tail = content.split('\n').filter(Boolean).slice(-lines);
      return { lines: tail };
    },
  });
}

export function createShellToolRegistry(
  ctx: ToolContext,
  state: ShellProposalState,
): Record<string, Tool> {
  return {
    get_vault_status: createGetVaultStatusTool(ctx),
    get_recent_log: createGetRecentLogTool(ctx),
    propose_task: createProposeTaskTool(state),
  };
}
