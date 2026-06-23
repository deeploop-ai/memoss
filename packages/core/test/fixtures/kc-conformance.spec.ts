import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseOKF } from '../../src/okf/document.js';
import { validateForRead } from '../../src/okf/validator.js';

const fixtureRoot = fileURLToPath(
  new URL('./kc-sample/crypto_bitcoin', import.meta.url),
);

function collectMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...collectMarkdownFiles(fullPath));
    } else if (entry.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('knowledge-catalog sample bundle conformance', () => {
  it('parses all fixture markdown files without errors', () => {
    const files = collectMarkdownFiles(fixtureRoot);
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      const doc = parseOKF(text);
      const relative = file.slice(fixtureRoot.length + 1).replace(/\\/g, '/');

      if (doc.frontmatter.type) {
        expect(() => validateForRead(doc, relative)).not.toThrow();
      }
    }
  });
});
