import { describe, expect, it } from 'vitest';
import {
  assertSafeShellCommand,
  parseCommandArgv,
} from './safe-shell.js';

describe('safe-shell', () => {
  it('parses quoted argv', () => {
    expect(parseCommandArgv('python "my script.py" --flag')).toEqual([
      'python',
      'my script.py',
      '--flag',
    ]);
  });

  it('rejects shell metacharacters', () => {
    expect(() => assertSafeShellCommand('python foo.py; rm -rf /')).toThrow(
      /metacharacters/,
    );
  });

  it('rejects disallowed executables', () => {
    expect(() => assertSafeShellCommand('evil-binary foo')).toThrow(
      /not allowed/i,
    );
    expect(assertSafeShellCommand('python script.py')).toEqual([
      'python',
      'script.py',
    ]);
  });
});
