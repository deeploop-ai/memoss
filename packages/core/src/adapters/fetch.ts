import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { MemossError } from '../errors.js';

const USER_AGENT =
  'memoss/0.1 (+https://github.com/deeploop-ai/memoss)';
const MAX_MARKDOWN_BYTES = 40 * 1024;

export interface FetchResult {
  url: string;
  title?: string;
  mime: string;
  text: string;
  links: string[];
}

function assertHttpUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new MemossError('FETCH_ERROR', `Invalid URL: ${url}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new MemossError('FETCH_ERROR', `Only http/https URLs are allowed: ${url}`);
  }
  return parsed;
}

function truncateUtf8(text: string, maxBytes: number): string {
  const encoded = Buffer.from(text, 'utf8');
  if (encoded.length <= maxBytes) {
    return text;
  }
  return `${encoded.subarray(0, maxBytes).toString('utf8')}\n\n[...truncated...]`;
}

function extractLinks(html: string, baseUrl: string): string[] {
  const { document } = parseHTML(html);
  const seen = new Set<string>();
  const links: string[] = [];

  for (const anchor of document.querySelectorAll('a[href]')) {
    const href = anchor.getAttribute('href')?.trim();
    if (!href) {
      continue;
    }
    let absolute: string;
    try {
      absolute = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
    const protocol = new URL(absolute).protocol;
    if (!['http:', 'https:'].includes(protocol)) {
      continue;
    }
    if (seen.has(absolute)) {
      continue;
    }
    seen.add(absolute);
    links.push(absolute);
  }

  return links;
}

function htmlToMarkdown(html: string): { title?: string; text: string } {
  const { document } = parseHTML(html);
  const article = new Readability(document).parse();
  const turndown = new TurndownService({ headingStyle: 'atx' });
  const title = article?.title ?? document.querySelector('title')?.textContent?.trim();
  const content = article?.content ?? html;
  const text = turndown.turndown(content);
  return { title: title || undefined, text };
}

export async function fetchUrl(url: string, init?: RequestInit): Promise<FetchResult> {
  const parsed = assertHttpUrl(url);
  const response = await fetch(parsed.toString(), {
    ...init,
    headers: {
      Accept: 'text/html,text/markdown,text/plain,*/*;q=0.5',
      'User-Agent': USER_AGENT,
      ...init?.headers,
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new MemossError(
      'FETCH_ERROR',
      `HTTP ${response.status} fetching ${parsed.toString()}`,
    );
  }

  const finalUrl = response.url || parsed.toString();
  const contentType = response.headers.get('content-type') ?? '';
  const lowerType = contentType.toLowerCase();

  if (lowerType.includes('text/markdown') || finalUrl.endsWith('.md')) {
    const text = truncateUtf8(await response.text(), MAX_MARKDOWN_BYTES);
    return {
      url: finalUrl,
      mime: 'text/markdown',
      text,
      links: [],
    };
  }

  if (lowerType.includes('text/plain')) {
    const text = truncateUtf8(await response.text(), MAX_MARKDOWN_BYTES);
    return {
      url: finalUrl,
      mime: 'text/plain',
      text,
      links: [],
    };
  }

  if (!lowerType.includes('text/html')) {
    throw new MemossError(
      'FETCH_ERROR',
      `Unsupported content-type: ${contentType || 'unknown'}`,
    );
  }

  const html = await response.text();
  const links = extractLinks(html, finalUrl);
  const { title, text } = htmlToMarkdown(html);

  return {
    url: finalUrl,
    title,
    mime: 'text/markdown',
    text: truncateUtf8(text, MAX_MARKDOWN_BYTES),
    links,
  };
}
