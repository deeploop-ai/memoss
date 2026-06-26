import {
  TOOL_NAMES,
  createRunnerSetup,
  getToolInputSchema,
  runIngest,
  runIngestSchema,
  runIngestStatusSchema,
  runExtract,
  runExtractSchema,
  runLint,
  runLintSchema,
  runQuery,
  runQuerySchema,
  type ToolName,
  type ToolRegistry,
} from '@memoss/core';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { z } from 'zod';
import {
  DEFAULT_MCP_CAPABILITIES,
  type McpCapability,
  resolveMcpToolNames,
} from './capabilities.js';
import {
  createMcpIngestJob,
  readMcpJob,
  updateMcpJob,
} from './mcp-jobs.js';
import { MCP_SERVER_VERSION } from './version.js';

export const RUNNER_TOOL_NAMES = [
  'run_ingest',
  'run_ingest_status',
  'run_extract',
  'run_query',
  'run_lint',
] as const;
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

function createIngestRunOptions(
  vaultRoot: string,
  args: z.infer<typeof runIngestSchema>,
) {
  return {
    vaultRoot,
    source: args.source,
    kind: args.kind,
    noDraft: args.noDraft,
    skill: args.skill,
    extract: args.noExtract === true ? false : (args.extract ?? 'auto'),
    noCache: args.noCache,
  };
}

function startAsyncIngest(
  vaultRoot: string,
  args: z.infer<typeof runIngestSchema>,
): {
  jobId: string;
  status: 'pending';
  message: string;
} {
  const job = createMcpIngestJob(vaultRoot, args);
  void (async () => {
    updateMcpJob(vaultRoot, job.id, { status: 'running' });
    try {
      const result = await runIngest(createIngestRunOptions(vaultRoot, args));
      updateMcpJob(vaultRoot, job.id, { status: 'complete', result });
    } catch (error) {
      updateMcpJob(vaultRoot, job.id, {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();

  return {
    jobId: job.id,
    status: 'pending',
    message:
      'Ingest started in background. Poll run_ingest_status with jobId until complete or failed.',
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
    runIngestStatus: (
      args: z.infer<typeof runIngestStatusSchema>,
    ) => Promise<unknown>;
    runExtract: (args: z.infer<typeof runExtractSchema>) => Promise<unknown>;
    runQuery: (args: z.infer<typeof runQuerySchema>) => Promise<unknown>;
    runLint: (args: z.infer<typeof runLintSchema>) => Promise<unknown>;
  },
  capabilities: readonly McpCapability[] = DEFAULT_MCP_CAPABILITIES,
): void {
  const enabled = new Set(resolveMcpToolNames(capabilities));

  for (const name of TOOL_NAMES) {
    if (!enabled.has(name)) {
      continue;
    }
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

  if (enabled.has('run_ingest')) {
    server.registerTool(
      'run_ingest',
      {
        description:
          'Run the ingest agent on a source. Defaults to async (returns jobId); set async:false to block. Poll run_ingest_status for results.',
        inputSchema: runIngestSchema,
      },
      async (args) => formatToolResult(await handlers.runIngest(args)),
    );
  }

  if (enabled.has('run_ingest_status')) {
    server.registerTool(
      'run_ingest_status',
      {
        description: 'Poll status of an async run_ingest job',
        inputSchema: runIngestStatusSchema,
      },
      async (args) => formatToolResult(await handlers.runIngestStatus(args)),
    );
  }

  if (enabled.has('run_extract')) {
    server.registerTool(
      'run_extract',
      {
        description: 'Extract a source to markdown using agent skills',
        inputSchema: runExtractSchema,
      },
      async (args) => formatToolResult(await handlers.runExtract(args)),
    );
  }

  if (enabled.has('run_query')) {
    server.registerTool(
      'run_query',
      {
        description: 'Run the query agent',
        inputSchema: runQuerySchema,
      },
      async (args) => formatToolResult(await handlers.runQuery(args)),
    );
  }

  if (enabled.has('run_lint')) {
    server.registerTool(
      'run_lint',
      {
        description: 'Run the lint agent',
        inputSchema: runLintSchema,
      },
      async (args) => formatToolResult(await handlers.runLint(args)),
    );
  }
}

export interface CreateMemossMcpServerOptions {
  vaultRoot: string;
  capabilities?: readonly McpCapability[];
}

export function createMemossMcpServer(
  vaultRootOrOptions: string | CreateMemossMcpServerOptions,
): McpServer {
  const options =
    typeof vaultRootOrOptions === 'string'
      ? { vaultRoot: vaultRootOrOptions }
      : vaultRootOrOptions;
  const capabilities = options.capabilities ?? DEFAULT_MCP_CAPABILITIES;
  const vaultRoot = options.vaultRoot;

  const ctx = createMemossMcpContext(vaultRoot);
  const server = new McpServer({
    name: 'memoss',
    version: MCP_SERVER_VERSION,
  });

  registerMemossTools(
    server,
    ctx,
    {
      runIngest: async (args) => {
        if (args.async !== false) {
          return startAsyncIngest(vaultRoot, args);
        }
        return runIngest(createIngestRunOptions(vaultRoot, args));
      },
      runIngestStatus: async (args) => {
        const job = readMcpJob(vaultRoot, args.jobId);
        if (!job) {
          throw new Error(`Ingest job not found: ${args.jobId}`);
        }
        if (job.status === 'complete') {
          return {
            jobId: job.id,
            status: job.status,
            result: job.result,
          };
        }
        if (job.status === 'failed') {
          return {
            jobId: job.id,
            status: job.status,
            error: job.error,
          };
        }
        return {
          jobId: job.id,
          status: job.status,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
        };
      },
      runExtract: (args) =>
        runExtract({
          vaultRoot,
          source: args.source,
          kind: args.kind,
          skill: args.skill,
          noCache: args.noCache,
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
    },
    capabilities,
  );

  return server;
}
