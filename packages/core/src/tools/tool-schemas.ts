import { z } from 'zod';

export const pathSchema = z.object({
  path: z.string().describe('Vault-relative path to the OKF page'),
});

export const writePageSchema = z.object({
  path: z.string().describe('Vault-relative path to the OKF page'),
  frontmatter: z.record(z.string(), z.unknown()).describe('YAML frontmatter fields'),
  body: z.string().describe('Markdown body'),
});

export const listPagesSchema = z.object({
  dir: z.string().optional().describe('Optional directory scope'),
});

export const readIndexSchema = z.object({
  dir: z.string().optional().describe('Directory containing index.md'),
});

export const writeIndexSchema = z.object({
  dir: z.string().describe('Directory to write index.md into'),
  content: z.string().describe('index.md markdown content'),
});

export const emptySchema = z.object({});

export const appendLogSchema = z.object({
  line: z.string().describe('Log line to append'),
  date: z.string().optional().describe('ISO date group (YYYY-MM-DD)'),
});

export const searchKbSchema = z.object({
  query: z.string().describe('Grep-style search query'),
  maxResults: z.number().int().positive().optional().describe('Maximum results to return (default 50)'),
});

export const fetchUrlSchema = z.object({
  url: z.string().url().describe('URL to fetch'),
});

export const readSourceSchema = z.object({
  id: z.string().describe('Source item identifier'),
});

export const gitCommitSchema = z.object({
  message: z.string().describe('Commit message'),
});

export const gitDiffSchema = z.object({
  ref: z.string().optional().describe('Optional git ref to diff against'),
});

export const gitLogSchema = z.object({
  limit: z.number().int().positive().optional().describe('Maximum commits to return'),
});

export const gitCreateBranchSchema = z.object({
  name: z.string().describe('Branch name to create and checkout'),
});

export const gitMergeSchema = z.object({
  branch: z.string().describe('Branch to merge into the current branch'),
  ffOnly: z.boolean().optional().describe('Fast-forward only merge'),
});

export const runIngestSchema = z.object({
  source: z
    .string()
    .describe(
      'Source URI, path, or URL to add to the knowledge base (extract + ingest pipeline)',
    ),
  kind: z.enum(['auto', 'file', 'web', 'github']).optional().describe('Source adapter kind'),
  noDraft: z.boolean().optional().describe('Write directly to the current branch'),
  skill: z.string().optional().describe('Extraction skill name'),
  extract: z
    .union([z.boolean(), z.literal('auto')])
    .optional()
    .describe('Extraction mode; default auto'),
  noExtract: z.boolean().optional().describe('Skip extraction before ingest'),
  noCache: z.boolean().optional().describe('Bypass extract cache during ingest'),
  skipValidate: z
    .boolean()
    .optional()
    .describe('Skip pre-ingest content validation agent'),
  async: z
    .boolean()
    .optional()
    .describe(
      'When true, return immediately with jobId (MCP: poll run_ingest_status)',
    ),
});

export const runIngestStatusSchema = z.object({
  jobId: z.string().describe('Job ID returned by async run_ingest'),
});

export const runExtractSchema = z.object({
  source: z
    .string()
    .describe(
      'Source URI, path, or URL to extract to markdown only (does not update the knowledge base)',
    ),
  kind: z.enum(['auto', 'file', 'web', 'github']).optional().describe('Source kind hint'),
  skill: z.string().optional().describe('Extraction skill name'),
  noCache: z.boolean().optional().describe('Bypass extract cache'),
});

export const runQuerySchema = z.object({
  question: z.string().describe('Natural-language question'),
  save: z.boolean().optional().describe('Save the answer as a Note page'),
});

export const runLintSchema = z.object({
  fix: z.boolean().optional().describe('Propose fixes on a draft branch'),
});
