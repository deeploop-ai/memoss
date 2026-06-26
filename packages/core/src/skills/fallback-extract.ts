import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fetchUrl } from '../adapters/fetch.js';
import { MemossError } from '../errors.js';
import { contentHash } from './slug.js';
import type { ExtractKind, ExtractMeta } from './types.js';

async function readPdfText(filePath: string): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;
  const buffer = readFileSync(filePath);
  const result = await pdfParse(buffer);
  return result.text ?? '';
}

export interface FallbackExtractInput {
  source: string;
  extractKind: ExtractKind;
  outputPath: string;
  metaPath: string;
}

export interface FallbackExtractResult {
  outputPath: string;
  metaPath: string;
  meta: ExtractMeta;
}

export async function runFallbackExtract(
  input: FallbackExtractInput,
): Promise<FallbackExtractResult> {
  let text = '';
  const sourceUri = input.source;

  switch (input.extractKind) {
    case 'web':
    case 'github': {
      const result = await fetchUrl(sourceUri);
      text = result.text;
      break;
    }
    case 'pdf': {
      const filePath = isAbsolute(sourceUri)
        ? sourceUri
        : resolve(sourceUri);
      text = await readPdfText(filePath);
      break;
    }
    default:
      throw new MemossError(
        'EXTRACT_ERROR',
        `No fallback extractor for kind "${input.extractKind}". Install a skill or pass --skill.`,
      );
  }

  if (!text.trim()) {
    throw new MemossError(
      'EXTRACT_ERROR',
      `Fallback extraction produced empty content for ${sourceUri}`,
    );
  }

  mkdirSync(dirname(input.outputPath), { recursive: true });
  writeFileSync(input.outputPath, text, 'utf8');

  const meta: ExtractMeta = {
    source_uri: sourceUri,
    extract_kind: input.extractKind,
    extracted_at: new Date().toISOString(),
    content_hash: contentHash(text),
    fallback: true,
  };
  writeFileSync(input.metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');

  return {
    outputPath: input.outputPath,
    metaPath: input.metaPath,
    meta,
  };
}
