import { describe, expect, it } from 'vitest';
import {
  classifyIntentFastPath,
} from './intent-fast-path.js';

describe('classifyIntentFastPath', () => {
  it('detects ingest URL', () => {
    const result = classifyIntentFastPath('导入 https://example.com/a.html');
    expect(result?.proposal.task).toBe('ingest');
    expect(result?.proposal.params.source).toBe('https://example.com/a.html');
  });

  it('detects query questions', () => {
    const result = classifyIntentFastPath('什么是 DDD');
    expect(result?.proposal.task).toBe('query');
  });

  it('detects approve', () => {
    const result = classifyIntentFastPath('批准刚才的 draft');
    expect(result?.proposal.task).toBe('approve');
  });

  it('parses crawl params from ingest message', () => {
    const result = classifyIntentFastPath(
      '爬取 https://docs.example.com 最多 10 页 allowed_hosts docs.example.com',
    );
    expect(result?.proposal.task).toBe('ingest');
    expect(result?.proposal.params.crawl).toEqual({
      maxPages: 10,
      allowedHosts: ['docs.example.com'],
    });
    expect(result?.proposal.params.skill).toBe('web-crawl');
  });

  it('detects comparison query format', () => {
    const result = classifyIntentFastPath('对比 DDD 和 Clean Architecture');
    expect(result?.proposal.task).toBe('query');
    expect(result?.proposal.params.format).toBe('comparison');
  });
});
