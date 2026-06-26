import { extname } from 'node:path';
import type { SourceKind } from '../adapters/types.js';
import type { ExtractKind } from './types.js';

const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.wav',
  '.m4a',
  '.flac',
  '.ogg',
  '.aac',
]);

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.webm',
  '.mov',
  '.avi',
  '.mkv',
]);

export function inferSourceKindForExtract(source: string): SourceKind | 'auto' {
  if (/^https?:\/\//i.test(source)) {
    if (/github\.com/i.test(source)) {
      return 'github';
    }
    return 'web';
  }
  return 'file';
}

export function inferExtractKind(
  source: string,
  sourceKind: SourceKind | 'auto' = 'auto',
): ExtractKind {
  const resolvedKind =
    sourceKind === 'auto' ? inferSourceKindForExtract(source) : sourceKind;

  if (resolvedKind === 'web') {
    return 'web';
  }
  if (resolvedKind === 'github') {
    return 'github';
  }

  const extension = extname(source).toLowerCase();
  if (extension === '.pdf') {
    return 'pdf';
  }
  if (extension === '.md' || extension === '.markdown') {
    return 'markdown';
  }
  if (extension === '.txt') {
    return 'text';
  }
  if (AUDIO_EXTENSIONS.has(extension)) {
    return 'audio';
  }
  if (VIDEO_EXTENSIONS.has(extension)) {
    return 'video';
  }

  return 'unknown';
}

export function shouldSkipExtract(
  extractKind: ExtractKind,
  explicitSkill?: string,
): boolean {
  if (explicitSkill) {
    return false;
  }
  return extractKind === 'markdown' || extractKind === 'text';
}
