import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { VaultConfig } from '../config/vault-config.js';
import { loadPromptTemplate, type PromptName } from './prompts/load.js';

export interface PromptContext {
  vaultName: string;
  schemaPack: string;
  instructions: string;
  date: string;
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
    save_instructions: '',
    fix_instructions: '',
    ...opts.extra,
  });
}

export const QUERY_SAVE_INSTRUCTIONS = `## Save mode

After answering, persist the exploration as a new note:
- Write to \`notes/\` with \`type: Note\` in frontmatter.
- Include \`title\` and \`description\`.
- Add bidirectional links between the note and cited pages.
- Use \`append_log\` to record the saved note.`;

export const LINT_FIX_INSTRUCTIONS = `## Fix mode

For issues you can resolve automatically:
- Create/checkout the draft branch if not already on one.
- Apply fixes via \`write_page\` / \`write_index\` (read before write).
- Commit with \`git_commit\` when done.
- Prefer minimal, targeted edits over large rewrites.`;
