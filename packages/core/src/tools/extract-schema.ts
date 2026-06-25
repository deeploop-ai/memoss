import type { Tool } from 'ai';
import { z } from 'zod';

type ToolWithSchema = Tool & { inputSchema?: z.ZodTypeAny };

/** Read the Zod input schema attached to an AI SDK tool. */
export function getToolInputSchema(tool: Tool): z.ZodTypeAny {
  const schema = (tool as ToolWithSchema).inputSchema;
  return schema ?? z.object({});
}
