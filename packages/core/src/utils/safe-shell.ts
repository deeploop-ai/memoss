import { basename } from 'node:path';
import { spawn } from 'node:child_process';
import { MemossError } from '../errors.js';

const ALLOWED_EXECUTABLES = new Set([
  'bash',
  'cat',
  'cp',
  'curl',
  'echo',
  'find',
  'firecrawl',
  'grep',
  'head',
  'jq',
  'ls',
  'mkdir',
  'mv',
  'node',
  'npm',
  'npx',
  'pip',
  'pip3',
  'pnpm',
  'python',
  'python3',
  'rm',
  'sh',
  'sort',
  'tail',
  'uniq',
  'uv',
  'wc',
  'wget',
  'yarn',
]);

const BLOCKED_SHELL_CHARS = /[;|&`><\n\r]/;

/** Quote-aware argv split (no shell expansion). */
export function parseCommandArgv(command: string): string[] {
  const args: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        args.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }

  if (quote) {
    throw new MemossError('EXTRACT_ERROR', 'Unterminated quote in command');
  }
  if (current) {
    args.push(current);
  }
  if (args.length === 0) {
    throw new MemossError('EXTRACT_ERROR', 'Empty command');
  }
  return args;
}

export function assertSafeShellCommand(command: string): string[] {
  const trimmed = command.trim();
  if (!trimmed) {
    throw new MemossError('EXTRACT_ERROR', 'Empty command');
  }
  if (BLOCKED_SHELL_CHARS.test(trimmed)) {
    throw new MemossError(
      'EXTRACT_ERROR',
      'Shell metacharacters (;|&`></newlines) are not allowed in commands',
    );
  }

  const argv = parseCommandArgv(trimmed);
  const exe = basename(argv[0]).toLowerCase().replace(/\.(exe|cmd|bat)$/i, '');
  if (!ALLOWED_EXECUTABLES.has(exe)) {
    throw new MemossError('EXTRACT_ERROR', `Command not allowed: ${argv[0]}`);
  }
  return argv;
}

export function runSafeCommand(
  command: string,
  cwd: string,
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const argv = assertSafeShellCommand(command);
  return new Promise((resolvePromise, reject) => {
    const child = spawn(argv[0], argv.slice(1), {
      cwd,
      shell: false,
      env: process.env,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(
          new MemossError(
            'EXTRACT_ERROR',
            `Command timed out after ${timeoutMs}ms`,
          ),
        );
        return;
      }
      resolvePromise({
        stdout,
        stderr,
        exitCode: code ?? 1,
      });
    });
  });
}
