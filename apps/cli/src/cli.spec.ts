import { describe, expect, it } from 'vitest';
import { shouldLaunchShell } from './cli.js';
import { isInteractiveTerminal, isSupportedNodeVersion } from './tui/terminal.js';

describe('shouldLaunchShell', () => {
  it('skips shell for subcommands', () => {
    expect(shouldLaunchShell(['status'])).toBe(false);
    expect(shouldLaunchShell(['ingest', 'https://example.com'])).toBe(false);
  });

  it('launches shell for bare invocation', () => {
    expect(shouldLaunchShell([])).toBe(true);
  });

  it('skips shell for global flags', () => {
    expect(shouldLaunchShell(['--version'])).toBe(false);
    expect(shouldLaunchShell(['-v'])).toBe(false);
    expect(shouldLaunchShell(['--help'])).toBe(false);
  });

  it('respects MEMOSS_NO_TUI', () => {
    const prev = process.env.MEMOSS_NO_TUI;
    process.env.MEMOSS_NO_TUI = '1';
    try {
      expect(shouldLaunchShell([])).toBe(false);
    } finally {
      if (prev === undefined) {
        delete process.env.MEMOSS_NO_TUI;
      } else {
        process.env.MEMOSS_NO_TUI = prev;
      }
    }
  });
});

describe('Node 24 support', () => {
  it('accepts Node 24 in supported majors', () => {
    expect(isSupportedNodeVersion('24.11.1')).toBe(true);
  });

  it('accepts Node 20 and 22', () => {
    expect(isSupportedNodeVersion('20.19.0')).toBe(true);
    expect(isSupportedNodeVersion('22.12.0')).toBe(true);
  });

  it('rejects unsupported majors', () => {
    expect(isSupportedNodeVersion('18.20.0')).toBe(false);
    expect(isSupportedNodeVersion('25.0.0')).toBe(false);
  });

  it('detects non-interactive stdin', () => {
    expect(isInteractiveTerminal({ isTTY: false } as NodeJS.ReadStream, { isTTY: true } as NodeJS.WriteStream)).toBe(false);
  });
});
