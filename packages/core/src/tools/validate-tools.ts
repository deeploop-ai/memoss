import { tool, type Tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './context.js';
import { createListSourcesTool, createReadSourceTool } from './page-tools.js';

export const reportValidationSchema = z.object({
  approved: z.boolean().describe('True when content is suitable for knowledge-base ingestion'),
  summary: z.string().describe('One-sentence verdict for the user'),
  issues: z
    .array(z.string())
    .describe('Specific problems; empty when approved is true'),
});

export type ValidationReport = z.infer<typeof reportValidationSchema>;

export interface ValidationReportState {
  report?: ValidationReport;
}

export function createReportValidationTool(state: ValidationReportState): Tool {
  return tool({
    description:
      'Submit the final validation verdict. Call exactly once after reviewing the source.',
    inputSchema: reportValidationSchema,
    execute: async (input) => {
      state.report = input;
      return { recorded: true };
    },
  });
}

export function createValidateToolRegistry(
  ctx: ToolContext,
  state: ValidationReportState,
): Record<string, Tool> {
  return {
    read_source: createReadSourceTool(ctx),
    list_sources: createListSourcesTool(ctx),
    report_validation: createReportValidationTool(state),
  };
}
