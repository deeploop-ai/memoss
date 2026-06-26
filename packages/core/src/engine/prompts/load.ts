import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type PromptName = 'ingest' | 'query' | 'lint' | 'extract';

const PROMPTS_DIR = dirname(fileURLToPath(import.meta.url));
const cache = new Map<PromptName, string>();

export function loadPromptTemplate(name: PromptName): string {
  const cached = cache.get(name);
  if (cached) {
    return cached;
  }

  const content = readFileSync(join(PROMPTS_DIR, `${name}.md`), 'utf8');
  cache.set(name, content);
  return content;
}

export function clearPromptCache(): void {
  cache.clear();
}
