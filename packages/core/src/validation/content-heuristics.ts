import { stripNullBytes } from '../text/strip-null-bytes.js';

export interface ContentHeuristicResult {
  /** When true, reject immediately without calling the validation agent. */
  blocking: boolean;
  issues: string[];
}

function countHtmlOpenTags(text: string): number {
  return (text.match(/<[a-z][\w-]*[\s>]/gi) ?? []).length;
}

function meaningfulText(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_\[\]()!`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Fast checks for obviously unsuitable source material before ingest. */
export function checkSourceContent(text: string): ContentHeuristicResult {
  const issues: string[] = [];
  const normalized = stripNullBytes(text);
  const trimmed = normalized.trimStart();
  const plain = meaningfulText(normalized);

  if (/^<!doctype\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    issues.push(
      'Content looks like a raw HTML page instead of extracted markdown or article text.',
    );
  }

  if (
    /<head[\s>]/i.test(normalized) &&
    /<script[\s>]/i.test(normalized) &&
    countHtmlOpenTags(normalized) >= 20
  ) {
    issues.push(
      'Content contains heavy HTML scaffolding (<head>, <script>) typical of a fetched web page shell, not knowledge content.',
    );
  }

  if (plain.length < 80) {
    issues.push(
      `Content is too short (${plain.length} chars of meaningful text) to be useful knowledge.`,
    );
  }

  if (/\uFFFD/.test(normalized)) {
    issues.push('Content contains replacement characters (U+FFFD), suggesting encoding corruption.');
  }

  const preview = plain.slice(0, 600);
  if (
    /\b404\b.*\b(not found|page not found)\b/i.test(preview) ||
    /\b403\b.*\b(forbidden|access denied)\b/i.test(preview)
  ) {
    issues.push('Content resembles an HTTP error page (404/403).');
  }

  return {
    blocking: issues.length > 0,
    issues,
  };
}
