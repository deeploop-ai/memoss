import type { ShellTaskProposal, ShellTaskType } from './session.js';

const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;
const PATH_PATTERN =
  /(?:^|[\s"'(])([\w./\\-]+\.(?:md|pdf|html?|txt|docx?))(?:[\s"'),]|$)/i;

const INGEST_VERBS =
  /(?:导入| ingest|ingest|添加|加入|收录|fetch|import|爬取|crawl|抓取)/i;
const CRAWL_VERBS = /(?:爬取|crawl|抓取|spider|scrape site)/i;
const QUERY_PREFIX =
  /^(?:什么是|是什么|what is|how|why|explain|解释|对比|compare|请问|？|\?)/i;
const LINT_VERBS = /(?:lint|检查|健康|health|audit|审计)/i;
const APPROVE_VERBS = /(?:批准|approve|合并|merge|确认写入)/i;
const REJECT_VERBS = /(?:拒绝|reject|discard|丢弃|放弃)/i;
const STATUS_VERBS = /(?:status|状态|概况|统计)/i;

export interface CrawlParams {
  maxPages?: number;
  allowedHosts?: string[];
}

export function parseCrawlParams(message: string): CrawlParams | undefined {
  if (!CRAWL_VERBS.test(message)) {
    return undefined;
  }

  const params: CrawlParams = {};

  const maxMatch =
    message.match(/(?:最多|上限|max[_\s-]?pages?)\s*[:：]?\s*(\d+)/i) ??
    message.match(/(\d+)\s*(?:页|pages?)/i);
  if (maxMatch?.[1]) {
    params.maxPages = Number.parseInt(maxMatch[1], 10);
  }

  const hostsMatch = message.match(
    /(?:allowed[_\s-]?hosts?|限定域名|仅允许|hosts?)\s*[:：]?\s*([^\n]+)/i,
  );
  if (hostsMatch?.[1]) {
    params.allowedHosts = hostsMatch[1]
      .split(/[,，\s]+/)
      .map((h) => h.trim())
      .filter(Boolean);
  }

  return params;
}

export interface FastPathResult {
  proposal: ShellTaskProposal;
  confidence: 'high' | 'medium';
}

function buildIngestParams(
  source: string,
  message: string,
): Record<string, unknown> {
  const crawl = parseCrawlParams(message);
  if (crawl) {
    return {
      source,
      crawl: {
        maxPages: crawl.maxPages,
        allowedHosts: crawl.allowedHosts,
      },
      skill: 'web-crawl',
    };
  }
  return { source };
}

export function classifyIntentFastPath(message: string): FastPathResult | undefined {
  const trimmed = message.trim();
  if (!trimmed) {
    return undefined;
  }

  const urlMatch = trimmed.match(URL_PATTERN);
  if (urlMatch && INGEST_VERBS.test(trimmed)) {
    return {
      confidence: 'high',
      proposal: {
        task: 'ingest',
        params: buildIngestParams(urlMatch[0], trimmed),
        rationale: 'URL + ingest verb detected',
      },
    };
  }

  if (urlMatch && !QUERY_PREFIX.test(trimmed)) {
    return {
      confidence: 'medium',
      proposal: {
        task: 'ingest',
        params: buildIngestParams(urlMatch[0], trimmed),
        rationale: 'Bare URL — defaulting to ingest',
      },
    };
  }

  const pathMatch = trimmed.match(PATH_PATTERN);
  if (pathMatch && INGEST_VERBS.test(trimmed)) {
    return {
      confidence: 'high',
      proposal: {
        task: 'ingest',
        params: buildIngestParams(pathMatch[1], trimmed),
        rationale: 'File path + ingest verb detected',
      },
    };
  }

  if (APPROVE_VERBS.test(trimmed)) {
    return {
      confidence: 'high',
      proposal: { task: 'approve', params: {}, rationale: 'Approve verb' },
    };
  }

  if (REJECT_VERBS.test(trimmed)) {
    return {
      confidence: 'high',
      proposal: { task: 'reject', params: {}, rationale: 'Reject verb' },
    };
  }

  if (LINT_VERBS.test(trimmed)) {
    return {
      confidence: 'medium',
      proposal: {
        task: 'lint',
        params: { fix: /fix|修复|自动/.test(trimmed) },
        rationale: 'Lint verb',
      },
    };
  }

  if (STATUS_VERBS.test(trimmed)) {
    return {
      confidence: 'high',
      proposal: { task: 'status', params: {}, rationale: 'Status verb' },
    };
  }

  const isComparison = /(?:对比|compare|vs\.?|versus)/i.test(trimmed);
  if (QUERY_PREFIX.test(trimmed) || trimmed.endsWith('?') || trimmed.endsWith('？')) {
    return {
      confidence: 'high',
      proposal: {
        task: 'query',
        params: {
          question: trimmed,
          save: /保存|save|写入 notes|file back/i.test(trimmed),
          format: isComparison ? 'comparison' : 'default',
        },
        rationale: 'Question shape',
      },
    };
  }

  return undefined;
}

export function isWriteTask(task: ShellTaskType): boolean {
  return task === 'ingest' || task === 'lint' || task === 'approve' || task === 'reject';
}
