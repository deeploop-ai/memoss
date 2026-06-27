import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type PromptName =
  | 'ingest'
  | 'query'
  | 'lint'
  | 'extract'
  | 'validate'
  | 'tuning'
  | 'shell';

const PROMPTS_DIR = dirname(fileURLToPath(import.meta.url));
const cache = new Map<string, string>();

function loadFile(relativePath: string): string {
  const cached = cache.get(relativePath);
  if (cached) {
    return cached;
  }
  const content = readFileSync(join(PROMPTS_DIR, relativePath), 'utf8');
  cache.set(relativePath, content);
  return content;
}

export function loadPromptTemplate(name: PromptName): string {
  return loadFile(`${name}.md`);
}

export function loadQualityPatterns(): string {
  return loadFile('quality/universal.md');
}

export function loadSchemaPackOverlay(
  schemaPack: string,
): string {
  const known = new Set(['personal', 'research', 'data-catalog']);
  const pack = known.has(schemaPack) ? schemaPack : 'research';
  try {
    return loadFile(`overlays/${pack}.md`);
  } catch {
    return '';
  }
}

export function clearPromptCache(): void {
  cache.clear();
}
