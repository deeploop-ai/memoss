import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { MemossError } from '../errors.js';
import type { SourceAdapter, SourceContent, SourceItem } from './types.js';

const SUPPORTED_EXTENSIONS = new Set(['.md', '.txt', '.pdf']);

async function readPdfText(filePath: string): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;
  const buffer = readFileSync(filePath);
  const result = await pdfParse(buffer);
  return result.text ?? '';
}

function collectFiles(targetPath: string): string[] {
  const stat = statSync(targetPath);
  if (stat.isFile()) {
    return SUPPORTED_EXTENSIONS.has(extname(targetPath).toLowerCase())
      ? [targetPath]
      : [];
  }

  const files: string[] = [];
  for (const entry of readdirSync(targetPath, { withFileTypes: true })) {
    const fullPath = join(targetPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else if (
      entry.isFile() &&
      SUPPORTED_EXTENSIONS.has(extname(entry.name).toLowerCase())
    ) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function mimeForExtension(extension: string): string {
  switch (extension) {
    case '.md':
      return 'text/markdown';
    case '.txt':
      return 'text/plain';
    case '.pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

export class FileSourceAdapter implements SourceAdapter {
  readonly kind = 'file' as const;
  readonly uri: string;
  private readonly rootPath: string;
  private readonly files: string[];

  constructor(uri: string) {
    this.uri = uri;
    this.rootPath = resolve(uri);
    try {
      this.files = collectFiles(this.rootPath);
    } catch {
      throw new MemossError('SOURCE_ERROR', `File source not found: ${uri}`);
    }
    if (this.files.length === 0) {
      throw new MemossError('SOURCE_ERROR', `No supported files in source: ${uri}`);
    }
  }

  async listItems(): Promise<SourceItem[]> {
    return this.files.map((filePath) => {
      const relative =
        this.files.length === 1 && filePath === this.rootPath
          ? basename(filePath)
          : filePath.slice(this.rootPath.length + 1).replace(/\\/g, '/');
      return {
        id: relative,
        title: basename(filePath, extname(filePath)),
        mime: mimeForExtension(extname(filePath).toLowerCase()),
      };
    });
  }

  async readItem(id: string): Promise<SourceContent> {
    const filePath = this.files.find((candidate) => {
      const relative =
        this.files.length === 1 && candidate === this.rootPath
          ? basename(candidate)
          : candidate.slice(this.rootPath.length + 1).replace(/\\/g, '/');
      return relative === id;
    });

    if (!filePath) {
      throw new MemossError('SOURCE_ERROR', `Unknown source item: ${id}`);
    }

    const extension = extname(filePath).toLowerCase();
    let text = '';
    if (extension === '.pdf') {
      text = await readPdfText(filePath);
    } else {
      text = readFileSync(filePath, 'utf8');
    }

    return {
      id,
      title: basename(filePath, extension),
      mime: mimeForExtension(extension),
      text,
      metadata: { path: filePath },
    };
  }
}
