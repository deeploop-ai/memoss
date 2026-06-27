import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, isAbsolute, join, resolve, sep } from 'node:path';
import type { ExtractionConfig } from '../config/vault-config.js';
import { MemossError } from '../errors.js';
import { sourceToSlug } from './slug.js';
import type { ExtractKind } from './types.js';

export type ArchiveOriginalMode = 'auto' | 'always' | 'never';

export interface SourceArchive {
  /** Vault-relative path (posix). */
  raw_path: string;
  raw_content_hash: string;
  /** True when bytes were copied or fetched into raw_dir; false when referencing an in-vault file. */
  copied: boolean;
}

const USER_AGENT =
  'memoss/0.1 (+https://github.com/deeploop-ai/memoss)';

const BINARY_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.mp3',
  '.wav',
  '.m4a',
  '.flac',
  '.ogg',
  '.aac',
  '.mp4',
  '.webm',
  '.mov',
  '.avi',
  '.mkv',
  '.zip',
  '.epub',
]);

const TEXT_EXTENSIONS = new Set(['.md', '.markdown', '.txt']);

const MIME_EXTENSION: Record<string, string> = {
  'text/html': '.html',
  'application/pdf': '.pdf',
  'text/markdown': '.md',
  'text/plain': '.txt',
  'application/json': '.json',
};

function bufferHash(buffer: Buffer): string {
  return `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
}

function fileHash(path: string): string {
  return bufferHash(readFileSync(path));
}

function isHttpSource(source: string): boolean {
  return /^https?:\/\//i.test(source);
}

function resolveLocalPath(source: string, vaultRoot: string): string {
  return isAbsolute(source) ? resolve(source) : resolve(vaultRoot, source);
}

function isInsideVault(vaultRoot: string, filePath: string): boolean {
  const resolved = resolve(filePath);
  const vault = resolve(vaultRoot);
  return resolved === vault || resolved.startsWith(`${vault}${sep}`);
}

function vaultRelativePath(vaultRoot: string, absolutePath: string): string {
  return resolve(absolutePath)
    .slice(resolve(vaultRoot).length + 1)
    .replace(/\\/g, '/');
}

function localExtension(source: string): string {
  return extname(source).toLowerCase();
}

export function isPlainTextExtractSource(
  source: string,
  extractKind: ExtractKind,
): boolean {
  if (extractKind === 'markdown' || extractKind === 'text') {
    return true;
  }
  if (isHttpSource(source)) {
    try {
      return TEXT_EXTENSIONS.has(
        extname(new URL(source).pathname).toLowerCase(),
      );
    } catch {
      return false;
    }
  }
  return TEXT_EXTENSIONS.has(localExtension(source));
}

function isPlainTextSource(source: string, extractKind: ExtractKind): boolean {
  return isPlainTextExtractSource(source, extractKind);
}

function isBinaryLocalSource(source: string, extractKind: ExtractKind): boolean {
  if (
    extractKind === 'pdf' ||
    extractKind === 'audio' ||
    extractKind === 'video'
  ) {
    return true;
  }
  const ext = localExtension(source);
  return BINARY_EXTENSIONS.has(ext);
}

function extensionFromMime(contentType: string | null): string | undefined {
  if (!contentType) {
    return undefined;
  }
  const base = contentType.split(';')[0]?.trim().toLowerCase();
  return base ? MIME_EXTENSION[base] : undefined;
}

function extensionFromUrl(source: string): string {
  try {
    const pathname = new URL(source).pathname;
    const ext = extname(pathname).toLowerCase();
    if (ext) {
      return ext;
    }
  } catch {
    // fall through
  }
  return '';
}

function resolveRawFilename(
  source: string,
  extractKind: ExtractKind,
  contentType: string | null,
): string {
  const slug = sourceToSlug(source);
  const fromMime = extensionFromMime(contentType);
  if (fromMime) {
    return `${slug}${fromMime}`;
  }
  const fromPath = extensionFromUrl(source);
  if (fromPath) {
    return `${slug}${fromPath}`;
  }
  if (extractKind === 'pdf') {
    return `${slug}.pdf`;
  }
  if (extractKind === 'web' || extractKind === 'github') {
    return `${slug}.html`;
  }
  return `${slug}.bin`;
}

export function shouldArchiveOriginal(
  source: string,
  extractKind: ExtractKind,
  mode: ArchiveOriginalMode,
  vaultRoot: string,
): boolean {
  if (mode === 'never') {
    return false;
  }

  const plainText = isPlainTextSource(source, extractKind);

  if (!isHttpSource(source)) {
    const absolute = resolveLocalPath(source, vaultRoot);
    if (isInsideVault(vaultRoot, absolute)) {
      if (mode === 'auto' && plainText) {
        return false;
      }
      return existsSync(absolute);
    }
    if (mode === 'auto') {
      return isBinaryLocalSource(source, extractKind);
    }
    return !plainText;
  }

  if (mode === 'auto') {
    if (plainText) {
      return false;
    }
    return (
      extractKind === 'web' ||
      extractKind === 'github' ||
      extractKind === 'pdf'
    );
  }

  return !plainText;
}

async function archiveHttpSource(input: {
  vaultRoot: string;
  source: string;
  extractKind: ExtractKind;
  rawDir: string;
}): Promise<SourceArchive> {
  const response = await fetch(input.source, {
    headers: {
      Accept: '*/*',
      'User-Agent': USER_AGENT,
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new MemossError(
      'FETCH_ERROR',
      `HTTP ${response.status} archiving ${input.source}`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const filename = resolveRawFilename(
    input.source,
    input.extractKind,
    response.headers.get('content-type'),
  );
  const relativeRaw = join(input.rawDir, filename).replace(/\\/g, '/');
  const dest = resolve(input.vaultRoot, relativeRaw);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buffer);

  return {
    raw_path: relativeRaw,
    raw_content_hash: bufferHash(buffer),
    copied: true,
  };
}

function archiveLocalSource(input: {
  vaultRoot: string;
  source: string;
  rawDir: string;
}): SourceArchive {
  const absolute = resolveLocalPath(input.source, input.vaultRoot);

  if (!existsSync(absolute)) {
    throw new MemossError('EXTRACT_ERROR', `Source file not found: ${input.source}`);
  }

  if (isInsideVault(input.vaultRoot, absolute)) {
    return {
      raw_path: vaultRelativePath(input.vaultRoot, absolute),
      raw_content_hash: fileHash(absolute),
      copied: false,
    };
  }

  const ext = localExtension(input.source) || '.bin';
  const slug = sourceToSlug(input.source);
  const relativeRaw = join(input.rawDir, `${slug}${ext}`).replace(/\\/g, '/');
  const dest = resolve(input.vaultRoot, relativeRaw);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(absolute, dest);

  return {
    raw_path: relativeRaw,
    raw_content_hash: fileHash(dest),
    copied: true,
  };
}

/** Archive or reference the original source bytes before extraction. */
export async function maybeArchiveOriginal(input: {
  vaultRoot: string;
  source: string;
  extractKind: ExtractKind;
  config: Pick<ExtractionConfig, 'archive_original' | 'raw_dir'>;
}): Promise<SourceArchive | null> {
  const mode = input.config.archive_original;
  if (
    !shouldArchiveOriginal(
      input.source,
      input.extractKind,
      mode,
      input.vaultRoot,
    )
  ) {
    return null;
  }

  if (isHttpSource(input.source)) {
    return archiveHttpSource({
      vaultRoot: input.vaultRoot,
      source: input.source,
      extractKind: input.extractKind,
      rawDir: input.config.raw_dir,
    });
  }

  return archiveLocalSource({
    vaultRoot: input.vaultRoot,
    source: input.source,
    rawDir: input.config.raw_dir,
  });
}

export function mergeArchiveIntoMeta<T extends { raw_path?: string; raw_content_hash?: string }>(
  meta: T,
  archive: SourceArchive | null | undefined,
): T {
  if (!archive) {
    return meta;
  }
  return {
    ...meta,
    raw_path: archive.raw_path,
    raw_content_hash: archive.raw_content_hash,
  };
}
