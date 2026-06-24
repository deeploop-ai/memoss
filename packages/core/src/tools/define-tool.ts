import { tool, type Tool } from 'ai';
import type { z } from 'zod';
import type { ToolContext } from './context.js';

export interface ToolDefinition<T extends z.ZodTypeAny> {
  description: string;
  inputSchema: T;
  execute: (args: z.infer<T>, ctx: ToolContext) => Promise<unknown>;
}

export function defineTool<T extends z.ZodTypeAny>(
  ctx: ToolContext,
  definition: ToolDefinition<T>,
): Tool {
  return tool({
    description: definition.description,
    inputSchema: definition.inputSchema,
    execute: async (args) =>
      definition.execute(args as z.infer<T>, ctx),
  });
}
