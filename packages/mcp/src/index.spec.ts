import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CORE_VERSION } from '@memoss/core';
import { getCoreVersion, MCP_SERVER_VERSION } from './index.js';

describe('@memoss/mcp-server', () => {
  it('exports versions from package.json', () => {
    const mcpPkg = JSON.parse(
      readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'),
    ) as { version: string };
    const corePkg = JSON.parse(
      readFileSync(
        join(import.meta.dirname, '..', '..', 'core', 'package.json'),
        'utf8',
      ),
    ) as { version: string };

    expect(MCP_SERVER_VERSION).toBe(mcpPkg.version);
    expect(getCoreVersion()).toBe(corePkg.version);
    expect(CORE_VERSION).toBe(corePkg.version);
  });
});
