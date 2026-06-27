import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { isExtractArtifactToRemove } from './output-policy.js';

export interface CleanupExtractArtifactsResult {
  removed: string[];
}

/** Delete non-markdown junk left in sources/extracted/ by extract agents. */
export function cleanupExtractArtifacts(
  vaultRoot: string,
  outputDir: string,
): CleanupExtractArtifactsResult {
  const root = resolve(vaultRoot, outputDir);
  if (!existsSync(root)) {
    return { removed: [] };
  }

  const removed: string[] = [];

  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      const relativePath = relative(resolve(vaultRoot), fullPath).replace(
        /\\/g,
        '/',
      );
      if (!isExtractArtifactToRemove(relativePath)) {
        continue;
      }

      unlinkSync(fullPath);
      removed.push(relativePath);
    }
  }

  walk(root);
  return { removed };
}
