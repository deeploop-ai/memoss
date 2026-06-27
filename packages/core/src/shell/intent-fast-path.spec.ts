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
});
