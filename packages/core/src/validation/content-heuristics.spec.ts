import { describe, expect, it } from 'vitest';
import { checkSourceContent } from './content-heuristics.js';

describe('checkSourceContent', () => {
  it('blocks raw HTML pages', () => {
    const html = '<!DOCTYPE html>\n<html><head><script></script></head><body>x</body></html>';
    const result = checkSourceContent(html);
    expect(result.blocking).toBe(true);
    expect(result.issues.some((i) => i.includes('HTML'))).toBe(true);
  });

  it('allows normal markdown', () => {
    const md = [
      '---',
      'title: Event Router',
      'type: Reference',
      '---',
      '',
      '# Event Router',
      '',
      'Go 实现的 DAG 事件路由器，支持 Source → Transform → Sink 拓扑。',
      '详细说明见配置文档与部署指南。',
    ].join('\n');
    const result = checkSourceContent(md);
    expect(result.blocking).toBe(false);
    expect(result.issues).toHaveLength(0);
  });

  it('blocks very short content', () => {
    const result = checkSourceContent('# Hi\n');
    expect(result.blocking).toBe(true);
  });

  it('allows content with embedded null bytes after normalization', () => {
    const md = [
      '# LLM Overview',
      '',
      'Large language models are neural networks trained on vast text corpora.',
      'They support reasoning, coding, and multilingual tasks at scale.',
    ].join('\0\n');
    const result = checkSourceContent(md);
    expect(result.blocking).toBe(false);
    expect(result.issues).toHaveLength(0);
  });
});
