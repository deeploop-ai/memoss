import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MCP_CAPABILITIES,
  parseMcpCapabilities,
  resolveMcpToolNames,
} from './capabilities.js';

describe('parseMcpCapabilities', () => {
  it('defaults to agent-only', () => {
    expect(parseMcpCapabilities(undefined)).toEqual(['agent']);
    expect(parseMcpCapabilities('')).toEqual(['agent']);
    expect(DEFAULT_MCP_CAPABILITIES).toEqual(['agent']);
  });

  it('parses comma-separated levels', () => {
    expect(parseMcpCapabilities('agent,read')).toEqual(['agent', 'read']);
    expect(parseMcpCapabilities('read,write')).toEqual(['read', 'write']);
  });

  it('expands full to all levels', () => {
    expect(parseMcpCapabilities('full')).toEqual(['agent', 'read', 'write']);
    expect(parseMcpCapabilities('agent,full')).toEqual(['agent', 'read', 'write']);
  });

  it('rejects unknown levels', () => {
    expect(() => parseMcpCapabilities('agent,query')).toThrow(/Invalid MCP capability/);
  });
});

describe('resolveMcpToolNames', () => {
  it('exposes only agent runners by default', () => {
    expect(resolveMcpToolNames(['agent'])).toEqual([
      'run_query',
      'run_ingest',
      'run_ingest_status',
      'run_extract',
      'run_lint',
    ]);
  });

  it('adds read and write tools when enabled', () => {
    const names = resolveMcpToolNames(['agent', 'read', 'write']);
    expect(names).toContain('run_query');
    expect(names).toContain('search_kb');
    expect(names).toContain('write_page');
    expect(names).toContain('read_page');
    expect(resolveMcpToolNames(['read'])).toEqual(
      expect.arrayContaining(['read_page', 'search_kb']),
    );
    expect(resolveMcpToolNames(['read'])).not.toContain('run_query');
  });
});
