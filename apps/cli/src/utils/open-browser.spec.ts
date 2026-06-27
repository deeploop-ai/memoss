import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('open', () => ({
  default: vi.fn(async () => undefined),
}));

vi.mock('node:child_process', () => ({
  execFile: vi.fn(
    (
      _file: string,
      _args: string[],
      _options: unknown,
      callback: (error: Error | null) => void,
    ) => {
      callback(null);
    },
  ),
}));

import open from 'open';
import { openInDefaultBrowser } from './open-browser.js';

const tempDirs: string[] = [];

afterEach(() => {
  vi.clearAllMocks();
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('openInDefaultBrowser', () => {
  it('opens an absolute file path with the open package', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'memoss-open-browser-'));
    tempDirs.push(dir);
    const htmlPath = join(dir, 'viz.html');
    writeFileSync(htmlPath, '<html></html>');

    await openInDefaultBrowser(htmlPath);

    expect(open).toHaveBeenCalledOnce();
    const openedPath = vi.mocked(open).mock.calls[0]?.[0] as string;
    expect(openedPath.replace(/\\/g, '/')).toBe(htmlPath.replace(/\\/g, '/'));
  });
});
