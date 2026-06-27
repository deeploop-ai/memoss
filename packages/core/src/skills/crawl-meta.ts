import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface CrawlPageEntry {
  url: string;
  path: string;
  content_hash: string;
}

function hashFile(path: string): string {
  const content = readFileSync(path);
  return createHash('sha256').update(content).digest('hex');
}

/** Scan a multi-page crawl output directory for `.meta.json` companion pages. */
export function discoverCrawlPages(
  vaultRoot: string,
  outputDir: string,
  slug: string,
): CrawlPageEntry[] {
  const dir = resolve(vaultRoot, outputDir, slug);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return [];
  }

  const pages: CrawlPageEntry[] = [];
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith('.md')) {
      continue;
    }
    const fullPath = join(dir, entry);
    const relative = join(outputDir, slug, entry).replace(/\\/g, '/');
    const sidecar = join(dir, `${entry}.url.txt`);
    let url = relative;
    if (existsSync(sidecar)) {
      url = readFileSync(sidecar, 'utf8').trim() || url;
    }
    pages.push({
      url,
      path: relative,
      content_hash: `sha256:${hashFile(fullPath)}`,
    });
  }
  return pages.sort((a, b) => a.path.localeCompare(b.path));
}

export function isCrawlOutputDir(vaultRoot: string, outputDir: string, slug: string): boolean {
  const dir = resolve(vaultRoot, outputDir, slug);
  return existsSync(dir) && statSync(dir).isDirectory();
}
