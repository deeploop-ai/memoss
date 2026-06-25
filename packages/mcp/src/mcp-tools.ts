import {
  TOOL_NAMES,
  createRunnerSetup,
  getToolInputSchema,
  runIngest,
  runIngestSchema,
  runLint,
  runLintSchema,
  runQuery,
  runQuerySchema,
  type ToolName,
  type ToolRegistry,
} from '@memoss/core';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { z } from 'zod';

export const RUNNER_TOOL_NAMES = ['run_ingest', 'run_query', 'run_lint'] as const;
export type RunnerToolName = (typeof RUNNER_TOOL_NAMES)[number];
export type McpToolName = ToolName | RunnerToolName;

export const MCP_TOOL_NAMES: McpToolName[] = [
  ...TOOL_NAMES,
  ...RUNNER_TOOL_NAMES,
];

export interface MemossMcpContext {
  vaultRoot: string;
  registry: ToolRegistry;
}

export function createMemossMcpContext(vaultRoot: string): MemossMcpContext {
  const setup = createRunnerSetup({ vaultRoot });
  return { vaultRoot, registry: setup.tools };
}

function formatToolResult(result: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
}

function formatToolError(message: string): {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
} {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

async function executeRegistryTool(
  registry: ToolRegistry,
  name: ToolName,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: true }> {
  const tool = registry[name];
  if (!tool.execute) {
    return formatToolError(`Tool ${name} has no execute handler.`);
  }
  try {
    const result = await tool.execute(args, {
      toolCallId: `mcp-${name}`,
      messages: [],
    });
    return formatToolResult(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return formatToolError(message);
  }
}

export function registerMemossTools(
  server: McpServer,
  ctx: MemossMcpContext,
  handlers: {
    runIngest: (args: z.infer<typeof runIngestSchema>) => Promise<unknown>;
    runQuery: (args: z.infer<typeof runQuerySchema>) => Promise<unknown>;
    runLint: (args: z.infer<typeof runLintSchema>) => Promise<unknown>;
  },
): void {
  for (const name of TOOL_NAMES) {
    const tool = ctx.registry[name];
    const inputSchema = getToolInputSchema(tool);
    server.registerTool(
      name,
      {
        description: tool.description ?? name.replaceAll('_', ' '),
        inputSchema,
      },
      async (args) => executeRegistryTool(ctx.registry, name, args as Record<string, unknown>),
    );
  }

  server.registerTool(
    'run_ingest',
    {
      description: 'Run the ingest agent on a source',
      inputSchema: runIngestSchema,
    },
    async (args) => formatToolResult(await handlers.runIngest(args)),
  );

  server.registerTool(
    'run_query',
    {
      description: 'Run the query agent',
      inputSchema: runQuerySchema,
    },
    async (args) => formatToolResult(await handlers.runQuery(args)),
  );

  server.registerTool(
    'run_lint',
    {
      description: 'Run the lint agent',
      inputSchema: runLintSchema,
    },
    async (args) => formatToolResult(await handlers.runLint(args)),
  );
}

export function createMemossMcpServer(vaultRoot: string): McpServer {
  const ctx = createMemossMcpContext(vaultRoot);
  const server = new McpServer({
    name: 'memoss',
    version: '0.0.1',
  });

  registerMemossTools(server, ctx, {
    runIngest: (args) =>
      runIngest({
        vaultRoot,
        source: args.source,
        kind: args.kind,
        noDraft: args.noDraft,
      }),
    runQuery: (args) =>
      runQuery({
        vaultRoot,
        question: args.question,
        save: args.save,
      }),
    runLint: (args) =>
      runLint({
        vaultRoot,
        fix: args.fix,
      }),
  });

  return server;
}
