import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { posix } from 'node:path';
import { parseOKF } from './document.js';
import type { OKFDocument } from './types.js';

const INDEX_FILE = 'index.md';

export interface IndexEntry {
  type: string;
  title: string;
  link: string;
  description: string;
}

function loadDoc(filePath: string): OKFDocument | null {
  try {
    return parseOKF(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function buildIndexText(entries: IndexEntry[]): string {
  const grouped = new Map<string, IndexEntry[]>();
  for (const entry of entries) {
    const type = entry.type || 'Other';
    const list = grouped.get(type) ?? [];
    list.push(entry);
    grouped.set(type, list);
  }

  const sections: string[] = [];
  for (const type of [...grouped.keys()].sort()) {
    const lines = [`# ${type}`, ''];
    const items = grouped.get(type) ?? [];
    for (const entry of [...items].sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
    )) {
      const suffix = entry.description ? ` - ${entry.description}` : '';
      lines.push(`* [${entry.title}](${entry.link})${suffix}`);
    }
    sections.push(lines.join('\n'));
  }

  return `${sections.join('\n\n')}\n`;
}

function directoriesToIndex(bundleRoot: string): string[] {
  const root = resolve(bundleRoot);
  const dirs = new Set<string>();

  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        let current = dir;
        dirs.add(current);
        while (resolve(current) !== root) {
          current = dirname(current);
          dirs.add(current);
        }
      }
    }
  }

  if (statSync(root).isDirectory()) {
    walk(root);
  }

  return [...dirs].sort((a, b) => {
    const depthA = posix.relative(root, a).split('/').filter(Boolean).length;
    const depthB = posix.relative(root, b).split('/').filter(Boolean).length;
    return depthB - depthA || a.localeCompare(b);
  });
}

export interface RegenerateIndexesOptions {
  synthesizeDescription?: (
    relativeDir: string,
    entries: Array<{ title: string; description: string }>,
  ) => string;
}

/** Regenerate `index.md` files for a vault directory tree. */
export function regenerateIndexes(
  bundleRoot: string,
  options: RegenerateIndexesOptions = {},
): string[] {
  const root = resolve(bundleRoot);
  const written: string[] = [];
  const dirDescriptions = new Map<string, string>();
  const directories = directoriesToIndex(root);

  for (const directory of directories) {
    const entries: IndexEntry[] = [];

    for (const childName of readdirSync(directory).sort()) {
      if (childName === INDEX_FILE) {
        continue;
      }

      const childPath = join(directory, childName);
      const stat = statSync(childPath);

      if (stat.isFile() && childName.endsWith('.md')) {
        const doc = loadDoc(childPath);
        if (!doc) {
          continue;
        }
        const fm = doc.frontmatter;
        entries.push({
          type: String(fm.type ?? ''),
          title: String(fm.title ?? childName.replace(/\.md$/, '')),
          link: childName,
          description: String(fm.description ?? ''),
        });
      } else if (stat.isDirectory()) {
        entries.push({
          type: 'Subdirectories',
          title: childName,
          link: `${childName}/${INDEX_FILE}`,
          description: dirDescriptions.get(childPath) ?? '',
        });
      }
    }

    if (entries.length === 0) {
      continue;
    }

    const indexPath = join(directory, INDEX_FILE);
    writeFileSync(indexPath, buildIndexText(entries), 'utf8');
    written.push(indexPath);

    if (resolve(directory) === root) {
      continue;
    }

    const pairs = entries.map((entry) => ({
      title: entry.title,
      description: entry.description,
    }));

    if (pairs.length === 1 && pairs[0]?.description) {
      dirDescriptions.set(directory, pairs[0].description);
    } else if (options.synthesizeDescription) {
      const rel = posix.relative(root, directory).replace(/\\/g, '/');
      dirDescriptions.set(
        directory,
        options.synthesizeDescription(rel, pairs),
      );
    }
  }

  return written;
}
