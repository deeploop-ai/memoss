import { describe, expect, it } from 'vitest';
import { getCoreVersion, MCP_SERVER_VERSION } from './index.js';

describe('@memoss/mcp-server', () => {
  it('exports versions and delegates to core', () => {
    expect(MCP_SERVER_VERSION).toBe('0.0.1');
    expect(getCoreVersion()).toBe('0.0.1');
  });
});
