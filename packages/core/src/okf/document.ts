import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { OKFDocumentError } from '../errors.js';
import type { OKFDocument, OKFFrontmatter } from './types.js';

const FRONTMATTER_DELIM = '---';

export function parseOKF(text: string): OKFDocument {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0 || lines[0]?.trim() !== FRONTMATTER_DELIM) {
    return { frontmatter: {}, body: text };
  }

  let endIdx: number | undefined;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === FRONTMATTER_DELIM) {
      endIdx = i;
      break;
    }
  }

  if (endIdx === undefined) {
    throw new OKFDocumentError('Unterminated YAML frontmatter block');
  }

  const fmText = lines.slice(1, endIdx).join('\n');
  let parsed: unknown;
  try {
    parsed = fmText.trim() === '' ? {} : parseYaml(fmText);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new OKFDocumentError(`Invalid YAML in frontmatter: ${detail}`);
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new OKFDocumentError('Frontmatter must be a YAML mapping');
  }

  let body = lines.slice(endIdx + 1).join('\n');
  if (body.startsWith('\n')) {
    body = body.slice(1);
  }

  return {
    frontmatter: (parsed ?? {}) as OKFFrontmatter,
    body,
  };
}

export function serializeOKF(doc: OKFDocument): string {
  const fmText = stringifyYaml(doc.frontmatter, {
    sortMapEntries: false,
    lineWidth: 0,
  }).trimEnd();

  let body = doc.body;
  if (!body.endsWith('\n')) {
    body += '\n';
  }

  return `${FRONTMATTER_DELIM}\n${fmText}\n${FRONTMATTER_DELIM}\n\n${body}`;
}
