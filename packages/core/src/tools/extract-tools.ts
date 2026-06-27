import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { z } from 'zod';
import { tool, type Tool } from 'ai';
import { MemossError } from '../errors.js';
import { activateSkill, findSkillByName } from '../skills/activate.js';
import type { ExtractToolContext } from './extract-context.js';

const activateSkillSchema = z.object({
  name: z.string().describe('Skill name from the catalog'),
});

const bashSchema = z.object({
  command: z.string().describe('Shell command to run (non-interactive)'),
  cwd: z
    .string()
    .optional()
    .describe('Working directory; defaults to active skill base dir'),
});

const readFileSchema = z.object({
  path: z.string().describe('Absolute or skill-relative file path'),
});

const writeFileSchema = z.object({
  path: z
    .string()
    .describe('Output path (must be under sources/extracted/)'),
  content: z.string().describe('File content'),
});

const MAX_BASH_OUTPUT = 32 * 1024;

function truncate(text: string, maxBytes: number): string {
  const buffer = Buffer.from(text, 'utf8');
  if (buffer.length <= maxBytes) {
    return text;
  }
  return `${buffer.subarray(0, maxBytes).toString('utf8')}\n[...truncated...]`;
}

function resolveReadablePath(ctx: ExtractToolContext, inputPath: string): string {
  const absolute = isAbsolute(inputPath)
    ? resolve(inputPath)
    : ctx.activeSkillBaseDir
      ? resolve(ctx.activeSkillBaseDir, inputPath)
      : resolve(ctx.vaultRoot, inputPath);

  const vaultRoot = resolve(ctx.vaultRoot);
  const outputDir = resolve(ctx.vaultRoot, ctx.outputDir);
  const skillBase = ctx.activeSkillBaseDir
    ? resolve(ctx.activeSkillBaseDir)
    : undefined;

  const allowed =
    absolute.startsWith(vaultRoot) ||
    absolute.startsWith(outputDir) ||
    (skillBase && absolute.startsWith(skillBase));

  if (!allowed) {
    throw new MemossError('EXTRACT_ERROR', `Read not allowed: ${inputPath}`);
  }
  if (!existsSync(absolute)) {
    throw new MemossError('EXTRACT_ERROR', `File not found: ${inputPath}`);
  }
  return absolute;
}

function resolveWritablePath(ctx: ExtractToolContext, inputPath: string): string {
  const outputDir = resolve(ctx.vaultRoot, ctx.outputDir);
  const vaultRoot = resolve(ctx.vaultRoot);

  const absolute = isAbsolute(inputPath)
    ? resolve(inputPath)
    : (() => {
        // Prompts pass vault-relative paths (e.g. sources/extracted/foo.md).
        const vaultRelative = resolve(vaultRoot, inputPath);
        if (vaultRelative.startsWith(outputDir)) {
          return vaultRelative;
        }
        return resolve(outputDir, inputPath);
      })();

  if (!absolute.startsWith(outputDir)) {
    throw new MemossError(
      'EXTRACT_ERROR',
      `Write not allowed outside ${ctx.outputDir}: ${inputPath}`,
    );
  }
  return absolute;
}

function runShellCommand(
  command: string,
  cwd: string,
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, {
      cwd,
      shell: true,
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
        stdout: truncate(stdout, MAX_BASH_OUTPUT),
        stderr: truncate(stderr, MAX_BASH_OUTPUT),
        exitCode: code ?? 1,
      });
    });
  });
}

export function createActivateSkillTool(ctx: ExtractToolContext): Tool {
  return tool({
    description: 'Load full instructions for an extraction skill.',
    inputSchema: activateSkillSchema,
    execute: async ({ name }) => {
      const record = findSkillByName(ctx.skills, name);
      const activated = activateSkill(record);
      ctx.activeSkillBaseDir = activated.record.baseDir;

      return {
        name: activated.record.name,
        description: activated.record.description,
        compatibility: activated.record.compatibility,
        baseDir: activated.record.baseDir,
        resources: activated.resources,
        instructions: activated.body,
      };
    },
  });
}

export function createBashTool(ctx: ExtractToolContext): Tool {
  return tool({
    description: 'Run a non-interactive shell command.',
    inputSchema: bashSchema,
    execute: async ({ command, cwd }) => {
      const workingDir = cwd
        ? resolveReadablePath(ctx, cwd)
        : ctx.activeSkillBaseDir ?? ctx.vaultRoot;

      const result = await runShellCommand(
        command,
        workingDir,
        ctx.config.extraction.bash_timeout_ms,
      );

      if (result.exitCode !== 0) {
        throw new MemossError(
          'EXTRACT_ERROR',
          `Command failed (exit ${result.exitCode}): ${result.stderr || result.stdout}`,
        );
      }

      return result;
    },
  });
}

export function createExtractReadFileTool(ctx: ExtractToolContext): Tool {
  return tool({
    description: 'Read a file from the vault or active skill directory.',
    inputSchema: readFileSchema,
    execute: async ({ path }) => {
      const absolute = resolveReadablePath(ctx, path);
      const content = readFileSync(absolute, 'utf8');
      return {
        path: absolute,
        content: truncate(content, MAX_BASH_OUTPUT),
      };
    },
  });
}

export function createExtractWriteFileTool(ctx: ExtractToolContext): Tool {
  return tool({
    description: 'Write extracted markdown to sources/extracted/.',
    inputSchema: writeFileSchema,
    execute: async ({ path, content }) => {
      const absolute = resolveWritablePath(ctx, path);
      mkdirSync(dirname(absolute), { recursive: true });
      writeFileSync(absolute, content, 'utf8');
      return {
        path: absolute,
        bytes: Buffer.byteLength(content, 'utf8'),
        relativePath: relative(resolve(ctx.vaultRoot), absolute).replace(
          /\\/g,
          '/',
        ),
      };
    },
  });
}

export function createExtractToolRegistry(ctx: ExtractToolContext) {
  return {
    activate_skill: createActivateSkillTool(ctx),
    bash: createBashTool(ctx),
    read_file: createExtractReadFileTool(ctx),
    write_file: createExtractWriteFileTool(ctx),
  };
}

export type ExtractToolRegistry = ReturnType<typeof createExtractToolRegistry>;
