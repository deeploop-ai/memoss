import { stripNullBytes } from '../text/strip-null-bytes.js';

export interface ContentHeuristicResult {
  /** When true, reject immediately without calling the validation agent. */
  blocking: boolean;
  issues: string[];
  /** When true, content was written but is not suitable for automatic ingest. */
  needsManualReview?: boolean;
}

export interface LineStructureMetrics {
  nonEmptyLines: number;
  shortLineRatio: number;
  singleCharLineRatio: number;
  verticalCjkLineRatio: number;
  avgLineLength: number;
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

/** Detect PDF text-layer extraction that fragments lines or drops glyphs. */
export function analyzeLineStructure(text: string): LineStructureMetrics {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const nonEmptyLines = lines.length;
  if (nonEmptyLines === 0) {
    return {
      nonEmptyLines: 0,
      shortLineRatio: 0,
      singleCharLineRatio: 0,
      verticalCjkLineRatio: 0,
      avgLineLength: 0,
    };
  }

  let shortLines = 0;
  let singleCharLines = 0;
  let verticalCjkLines = 0;
  let totalLength = 0;

  for (const line of lines) {
    totalLength += line.length;
    if (line.length <= 2) {
      shortLines += 1;
    }
    if (line.length === 1) {
      singleCharLines += 1;
    }
    if (/^[\u4e00-\u9fff]$/.test(line)) {
      verticalCjkLines += 1;
    }
  }

  return {
    nonEmptyLines,
    shortLineRatio: shortLines / nonEmptyLines,
    singleCharLineRatio: singleCharLines / nonEmptyLines,
    verticalCjkLineRatio: verticalCjkLines / nonEmptyLines,
    avgLineLength: totalLength / nonEmptyLines,
  };
}

function checkBrokenPdfExtraction(metrics: LineStructureMetrics): string[] {
  if (metrics.nonEmptyLines < 80) {
    return [];
  }

  const issues: string[] = [];
  const fragmented =
    metrics.shortLineRatio >= 0.25 && metrics.avgLineLength <= 18;
  const verticalGlyphs =
    metrics.verticalCjkLineRatio >= 0.05 && metrics.shortLineRatio >= 0.18;
  const singleCharNoise =
    metrics.singleCharLineRatio >= 0.2 && metrics.avgLineLength <= 20;

  if (fragmented || verticalGlyphs || singleCharNoise) {
    issues.push(
      'Content looks like broken PDF text extraction (fragmented short lines, missing glyphs, or vertical CJK splits). Re-extract with a dedicated PDF skill or repair manually before ingest.',
    );
  }

  return issues;
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

  issues.push(...checkBrokenPdfExtraction(analyzeLineStructure(normalized)));

  return {
    blocking: issues.length > 0,
    issues,
    needsManualReview: issues.some((issue) => issue.includes('broken PDF')),
  };
}
