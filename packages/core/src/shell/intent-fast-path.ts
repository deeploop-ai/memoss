import type { ShellTaskProposal, ShellTaskType } from './session.js';

const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;
const PATH_PATTERN =
  /(?:^|[\s"'(])([\w./\\-]+\.(?:md|pdf|html?|txt|docx?))(?:[\s"'),]|$)/i;

const INGEST_VERBS =
  /(?:导入| ingest|ingest|添加|加入|收录|fetch|import|爬取|crawl|抓取)/i;
const QUERY_PREFIX =
  /^(?:什么是|是什么|what is|how|why|explain|解释|对比|compare|请问|？|\?)/i;
const LINT_VERBS = /(?:lint|检查|健康|health|audit|审计)/i;
const APPROVE_VERBS = /(?:批准|approve|合并|merge|确认写入)/i;
const REJECT_VERBS = /(?:拒绝|reject|discard|丢弃|放弃)/i;
const STATUS_VERBS = /(?:status|状态|概况|统计)/i;

export interface FastPathResult {
  proposal: ShellTaskProposal;
  confidence: 'high' | 'medium';
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
        params: { source: urlMatch[0] },
        rationale: 'URL + ingest verb detected',
      },
    };
  }

  if (urlMatch && !QUERY_PREFIX.test(trimmed)) {
    return {
      confidence: 'medium',
      proposal: {
        task: 'ingest',
        params: { source: urlMatch[0] },
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
        params: { source: pathMatch[1] },
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

  if (QUERY_PREFIX.test(trimmed) || trimmed.endsWith('?') || trimmed.endsWith('？')) {
    return {
      confidence: 'high',
      proposal: {
        task: 'query',
        params: {
          question: trimmed,
          save: /保存|save|写入 notes|file back/i.test(trimmed),
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
