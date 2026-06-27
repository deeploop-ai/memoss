import { tool, type Tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './context.js';
import {
  createListPagesTool,
  createReadIndexTool,
  createReadSourceTool,
  createFetchUrlTool,
} from './page-tools.js';

export const tuningReportSchema = z.object({
  summary: z.string(),
  emphasis: z.array(z.string()).default([]),
  skip_patterns: z.array(z.string()).default([]),
  cross_link_targets: z.array(z.string()).default([]),
  pack_hints: z.array(z.string()).default([]),
  proposed_pages: z
    .array(
      z.object({
        path: z.string(),
        action: z.enum(['create', 'update']),
      }),
    )
    .default([]),
  confidence: z.enum(['high', 'medium', 'low']).default('medium'),
});

export type TuningReport = z.infer<typeof tuningReportSchema>;

export interface TuningReportState {
  report?: TuningReport;
}

export function createReportTuningTool(state: TuningReportState): Tool {
  return tool({
    description: 'Submit the ingest tuning plan. Call exactly once.',
    inputSchema: tuningReportSchema,
    execute: async (input) => {
      state.report = input;
      return { recorded: true };
    },
  });
}

export function createTuningToolRegistry(
  ctx: ToolContext,
  state: TuningReportState,
  allowFetch: boolean,
): Record<string, Tool> {
  const tools: Record<string, Tool> = {
    list_pages: createListPagesTool(ctx),
    read_index: createReadIndexTool(ctx),
    read_source: createReadSourceTool(ctx),
    report_tuning: createReportTuningTool(state),
  };
  if (allowFetch) {
    tools.fetch_url = createFetchUrlTool(ctx);
  }
  return tools;
}

export function formatTuningOverlay(report: TuningReport): string {
  const lines = [
    `**Summary:** ${report.summary}`,
    `**Confidence:** ${report.confidence}`,
  ];
  if (report.emphasis.length > 0) {
    lines.push(`**Emphasis:** ${report.emphasis.join('; ')}`);
  }
  if (report.skip_patterns.length > 0) {
    lines.push(`**Skip:** ${report.skip_patterns.join('; ')}`);
  }
  if (report.cross_link_targets.length > 0) {
    lines.push(`**Cross-link targets:** ${report.cross_link_targets.join(', ')}`);
  }
  if (report.pack_hints.length > 0) {
    lines.push(`**Hints:** ${report.pack_hints.join('; ')}`);
  }
  if (report.proposed_pages.length > 0) {
    lines.push('**Proposed pages:**');
    for (const page of report.proposed_pages) {
      lines.push(`- ${page.action}: \`${page.path}\``);
    }
  }
  return lines.join('\n');
}
