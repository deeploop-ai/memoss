import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { MemossError } from '../errors.js';

const SCRIPT_CANDIDATES = [
  'scripts/extract.sh',
  'scripts/extract.py',
  'scripts/extract.mjs',
  'scripts/extract.js',
] as const;

export function findFastPathScript(skillBaseDir: string): string | undefined {
  for (const relative of SCRIPT_CANDIDATES) {
    const absolute = join(skillBaseDir, relative);
    if (existsSync(absolute)) {
      return absolute;
    }
  }
  return undefined;
}

function spawnArgsForScript(scriptPath: string): { file: string; args: string[] } {
  if (scriptPath.endsWith('.py')) {
    return { file: 'python', args: [scriptPath] };
  }
  if (scriptPath.endsWith('.mjs') || scriptPath.endsWith('.js')) {
    return { file: 'node', args: [scriptPath] };
  }
  return { file: 'bash', args: [scriptPath] };
}

export async function runFastPathExtract(input: {
  scriptPath: string;
  skillBaseDir: string;
  sourceUri: string;
  outputPath: string;
  vaultRoot: string;
  timeoutMs: number;
}): Promise<void> {
  const job = JSON.stringify({
    uri: input.sourceUri,
    output_path: input.outputPath,
  });

  const { file, args } = spawnArgsForScript(input.scriptPath);

  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(file, args, {
      cwd: input.skillBaseDir,
      shell: false,
      env: {
        ...process.env,
        SOURCE_URI: input.sourceUri,
        OUTPUT_PATH: input.outputPath,
        VAULT_ROOT: input.vaultRoot,
      },
      windowsHide: true,
    });

    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, input.timeoutMs);

    child.stdin.write(job);
    child.stdin.end();

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
            `Fast-path script timed out after ${input.timeoutMs}ms`,
          ),
        );
        return;
      }
      if (code !== 0) {
        reject(
          new MemossError(
            'EXTRACT_ERROR',
            `Fast-path script failed (exit ${code}): ${stderr || 'unknown error'}`,
          ),
        );
        return;
      }
      if (!existsSync(input.outputPath)) {
        reject(
          new MemossError(
            'EXTRACT_ERROR',
            `Fast-path script did not write output: ${input.outputPath}`,
          ),
        );
        return;
      }
      resolvePromise();
    });
  });
}
