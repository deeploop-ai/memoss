import { z } from 'zod';
import {
  runIngest,
  runLint,
  runQuery,
  TOOL_NAMES,
  createRunnerSetup,
  type ToolName,
} from '@memoss/core';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const flexibleInput = z.object({}).passthrough();

const TOOL_DESCRIPTIONS: Partial<Record<ToolName, string>> = {
  read_page: 'Read an OKF page from the vault',
  write_page: 'Write or update an OKF page',
  list_pages: 'List OKF pages',
  search_kb: 'Search the knowledge base',
  fetch_url: 'Fetch a URL and return markdown',
};

export interface StartMcpServerOptions {
  vaultRoot: string;
}

export async function startMcpServer(opts: StartMcpServerOptions): Promise<void> {
  const setup = createRunnerSetup({ vaultRoot: opts.vaultRoot });
  const registry = setup.tools;

  const server = new McpServer({
    name: 'memoss',
    version: '0.0.1',
  });

  for (const name of TOOL_NAMES) {
    const tool = registry[name];
    server.registerTool(
      name,
      {
        description: TOOL_DESCRIPTIONS[name] ?? name.replaceAll('_', ' '),
        inputSchema: flexibleInput,
      },
      async (args) => {
        if (!tool.execute) {
          return {
            content: [{ type: 'text', text: `Tool ${name} has no execute handler.` }],
            isError: true,
          };
        }
        const result = await tool.execute(args, {
          toolCallId: `mcp-${name}`,
          messages: [],
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      },
    );
  }

  server.registerTool(
    'run_ingest',
    {
      description: 'Run the ingest agent on a source',
      inputSchema: z.object({
        source: z.string(),
        kind: z.enum(['auto', 'file', 'web', 'github']).optional(),
        noDraft: z.boolean().optional(),
      }),
    },
    async (args) => {
      const result = await runIngest({
        vaultRoot: opts.vaultRoot,
        source: args.source,
        kind: args.kind,
        noDraft: args.noDraft,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'run_query',
    {
      description: 'Run the query agent',
      inputSchema: z.object({
        question: z.string(),
        save: z.boolean().optional(),
      }),
    },
    async (args) => {
      const result = await runQuery({
        vaultRoot: opts.vaultRoot,
        question: args.question,
        save: args.save,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'run_lint',
    {
      description: 'Run the lint agent',
      inputSchema: z.object({
        fix: z.boolean().optional(),
      }),
    },
    async (args) => {
      const result = await runLint({
        vaultRoot: opts.vaultRoot,
        fix: args.fix,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
