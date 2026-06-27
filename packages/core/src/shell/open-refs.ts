import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const LINK_PATTERN = /\[([^\]]*)\]\(([^)]+)\)/g;
const WIKI_LINK_PATTERN = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

export function extractVaultLinks(text: string): string[] {
  const links = new Set<string>();

  for (const match of text.matchAll(LINK_PATTERN)) {
    const href = match[2]?.trim();
    if (href && !href.startsWith('http') && !href.startsWith('#')) {
      links.add(href.replace(/^\.\//, ''));
    }
  }

  for (const match of text.matchAll(WIKI_LINK_PATTERN)) {
    const target = match[1]?.trim();
    if (target) {
      links.add(target.endsWith('.md') ? target : `${target}.md`);
    }
  }

  return [...links];
}

export function resolveVaultPagePath(vaultRoot: string, link: string): string | undefined {
  const normalized = link.replace(/\\/g, '/');
  const candidates = [
    join(vaultRoot, normalized),
    join(vaultRoot, normalized.endsWith('.md') ? normalized : `${normalized}.md`),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

export async function openVaultPage(
  vaultRoot: string,
  link: string,
): Promise<boolean> {
  const path = resolveVaultPagePath(vaultRoot, link);
  if (!path) {
    return false;
  }

  const command =
    process.platform === 'win32'
      ? 'cmd'
      : process.platform === 'darwin'
        ? 'open'
        : 'xdg-open';
  const args =
    process.platform === 'win32' ? ['/c', 'start', '', path] : [path];

  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      shell: process.platform === 'win32',
    });
    child.on('error', () => resolvePromise(false));
    child.unref();
    resolvePromise(true);
  });
}

export async function openObsidianPage(
  vaultRoot: string,
  link: string,
): Promise<boolean> {
  const path = resolveVaultPagePath(vaultRoot, link);
  if (!path) {
    return false;
  }

  const relative = path.slice(resolve(vaultRoot).length + 1).replace(/\\/g, '/');
  const uri = `obsidian://open?vault=${encodeURIComponent(vaultRoot)}&file=${encodeURIComponent(relative.replace(/\.md$/, ''))}`;

  const command = process.platform === 'win32' ? 'cmd' : 'open';
  const args =
    process.platform === 'win32'
      ? ['/c', 'start', '', uri]
      : process.platform === 'darwin'
        ? [uri]
        : ['xdg-open', uri];

  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      shell: process.platform === 'win32',
    });
    child.on('error', () => resolvePromise(false));
    child.unref();
    resolvePromise(true);
  });
}
