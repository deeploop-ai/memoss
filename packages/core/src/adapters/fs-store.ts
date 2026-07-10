import { accessSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import fg from 'fast-glob';
import { MemossError } from '../errors.js';
import { parseOKF, serializeOKF } from '../okf/document.js';
import { isReservedFilename } from '../okf/paths.js';
import type { OKFDocument } from '../okf/types.js';
import {
  normalizeRelativePath,
  resolveContainedPath,
} from '../utils/path-safety.js';
import type { KnowledgeStore } from './types.js';

const LOG_FILE = 'log.md';
const INDEX_FILE = 'index.md';
const LOG_HEADER = '# Knowledge Base Activity Log';

function resolveVaultPath(vaultRoot: string, relativePath: string): string {
  return resolveContainedPath(vaultRoot, relativePath);
}

function ensureParentDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

function appendLogEntry(existing: string, line: string, date: string): string {
  const entry = `* ${line}`;
  const dateHeader = `## ${date}`;

  if (!existing.trim()) {
    return `${LOG_HEADER}\n\n${dateHeader}\n${entry}\n`;
  }

  const lines = existing.replace(/\r\n/g, '\n').split('\n');
  const dateIndex = lines.findIndex((value) => value.trim() === dateHeader);
  if (dateIndex === -1) {
    const trimmed = existing.trimEnd();
    return `${trimmed}\n\n${dateHeader}\n${entry}\n`;
  }

  let insertAt = dateIndex + 1;
  while (insertAt < lines.length && lines[insertAt]?.trim() === '') {
    insertAt += 1;
  }
  while (insertAt < lines.length && lines[insertAt]?.startsWith('* ')) {
    insertAt += 1;
  }

  lines.splice(insertAt, 0, entry);
  return `${lines.join('\n').trimEnd()}\n`;
}

export class FsKnowledgeStore implements KnowledgeStore {
  readonly vaultRoot: string;

  constructor(vaultRoot: string) {
    this.vaultRoot = resolve(vaultRoot);
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      accessSync(resolveVaultPath(this.vaultRoot, relativePath));
      return true;
    } catch {
      return false;
    }
  }

  async readPage(relativePath: string): Promise<OKFDocument> {
    const absolute = resolveVaultPath(this.vaultRoot, relativePath);
    try {
      return parseOKF(readFileSync(absolute, 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new MemossError('VAULT_NOT_FOUND', `Page not found: ${relativePath}`);
      }
      throw error;
    }
  }

  async writePage(relativePath: string, doc: OKFDocument): Promise<void> {
    const absolute = resolveVaultPath(this.vaultRoot, relativePath);
    ensureParentDir(absolute);
    writeFileSync(absolute, serializeOKF(doc), 'utf8');
  }

  async deletePage(relativePath: string): Promise<void> {
    const absolute = resolveVaultPath(this.vaultRoot, relativePath);
    try {
      unlinkSync(absolute);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new MemossError('VAULT_NOT_FOUND', `Page not found: ${relativePath}`);
      }
      throw error;
    }
  }

  async listPages(dir = ''): Promise<string[]> {
    const normalizedDir = normalizeRelativePath(dir);
    if (normalizedDir) {
      resolveVaultPath(this.vaultRoot, normalizedDir);
    }
    const pattern = normalizedDir ? `${normalizedDir}/**/*.md` : '**/*.md';
    const files = await fg(pattern, {
      cwd: this.vaultRoot,
      onlyFiles: true,
      dot: false,
    });

    return files
      .map((file) => file.replace(/\\/g, '/'))
      .filter((file) => !isReservedFilename(file))
      .sort();
  }

  async readIndex(dir = ''): Promise<string | null> {
    const relative = normalizeRelativePath(dir ? `${dir}/${INDEX_FILE}` : INDEX_FILE);
    if (!(await this.exists(relative))) {
      return null;
    }
    return readFileSync(resolveVaultPath(this.vaultRoot, relative), 'utf8');
  }

  async writeIndex(dir: string, content: string): Promise<void> {
    const relative = normalizeRelativePath(dir ? `${dir}/${INDEX_FILE}` : INDEX_FILE);
    const absolute = resolveVaultPath(this.vaultRoot, relative);
    ensureParentDir(absolute);
    const body = content.endsWith('\n') ? content : `${content}\n`;
    writeFileSync(absolute, body, 'utf8');
  }

  async readLog(): Promise<string> {
    if (!(await this.exists(LOG_FILE))) {
      return `${LOG_HEADER}\n`;
    }
    return readFileSync(resolveVaultPath(this.vaultRoot, LOG_FILE), 'utf8');
  }

  async appendLog(line: string, date?: string): Promise<void> {
    const logDate = date ?? new Date().toISOString().slice(0, 10);
    const existing = await this.readLog();
    const updated = appendLogEntry(existing, line, logDate);
    const absolute = resolveVaultPath(this.vaultRoot, LOG_FILE);
    ensureParentDir(absolute);
    writeFileSync(absolute, updated, 'utf8');
  }
}
