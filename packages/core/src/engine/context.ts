import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { VaultConfig } from '../config/vault-config.js';
import {
  loadPromptTemplate,
  loadQualityPatterns,
  loadSchemaPackOverlay,
  type PromptName,
} from './prompts/load.js';

export interface PromptContext {
  vaultName: string;
  schemaPack: string;
  instructions: string;
  date: string;
  qualityPatterns: string;
  schemaOverlay: string;
}

export interface BuildSystemPromptOptions extends PromptContext {
  prompt: PromptName;
  extra?: Record<string, string>;
}

export function loadVaultInstructions(vaultRoot: string): string {
  const path = join(vaultRoot, '.memoss', 'instructions.md');
  if (!existsSync(path)) {
    return '_No vault-specific instructions._';
  }
  return readFileSync(path, 'utf8').trim();
}

export function createPromptContext(
  vaultRoot: string,
  config: VaultConfig,
  date = new Date(),
): PromptContext {
  return {
    vaultName: config.name,
    schemaPack: config.schema_pack,
    instructions: loadVaultInstructions(vaultRoot),
    date: date.toISOString().slice(0, 10),
    qualityPatterns: loadQualityPatterns(),
    schemaOverlay: loadSchemaPackOverlay(config.schema_pack),
  };
}

function renderTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? '');
}

export function buildSystemPrompt(opts: BuildSystemPromptOptions): string {
  const template = loadPromptTemplate(opts.prompt);
  return renderTemplate(template, {
    vault_name: opts.vaultName,
    schema_pack: opts.schemaPack,
    instructions: opts.instructions,
    date: opts.date,
    quality_patterns: opts.qualityPatterns,
    schema_overlay: opts.schemaOverlay,
    save_instructions: '',
    fix_instructions: '',
    quality_overlay: '',
    deterministic_lint: '',
    format_instructions: '',
    ...opts.extra,
  });
}

export const QUERY_SAVE_INSTRUCTIONS = `## Save mode

After answering, persist the exploration as a new note:
- Write to \`notes/\` with \`type: Note\` in frontmatter.
- Include \`title\` and \`description\`.
- Add bidirectional links between the note and cited pages.
- Use \`append_log\` to record the saved note.`;

export const QUERY_COMPARISON_INSTRUCTIONS = `## Comparison format

Structure the answer as a markdown comparison table:
- First row: column headers (concepts/options being compared)
- First column: comparison dimensions
- Cite vault pages in cells where applicable`;

export const QUERY_SAVE_HEURISTIC = `## Save suggestion

If the answer synthesizes multiple pages, resolves a non-trivial question, or would be useful to revisit, mention that it is worth saving to notes/.`;

export const LINT_FIX_INSTRUCTIONS = `## Fix mode

For issues you can resolve automatically:
- Create/checkout the draft branch if not already on one.
- Apply fixes via \`write_page\` / \`write_index\` (read before write).
- Commit with \`git_commit\` when done.
- Prefer minimal, targeted edits over large rewrites.

### Orphan pages (ORPHAN_PAGE)

When a page has no inbound markdown links:
1. \`read_page\` the orphan and one or more related hub pages in the same directory.
2. Add a file-relative link from the hub body (e.g. \`See also [Orphan Title](orphan.md)\`) or from \`index.md\` via \`write_index\`.
3. Preserve existing headings and body content; only add cross-links or index entries.
4. Do not delete the orphan page unless it is truly duplicate content.

### Missing provenance (MISSING_SOURCES)

When frontmatter lacks \`sources\` on a substantive page, add \`sources: [{ source_id: <manifest-id> }]\` if you can infer the source from \`# Citations\` or vault context.`;
