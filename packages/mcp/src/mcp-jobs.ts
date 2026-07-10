import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import type { IngestRunResult, runIngestSchema } from '@memoss/core';
import type { z } from 'zod';

export type McpJobStatus = 'pending' | 'running' | 'complete' | 'failed';

export type McpIngestJobInput = z.infer<typeof runIngestSchema>;

export interface McpIngestJob {
  id: string;
  type: 'ingest';
  status: McpJobStatus;
  createdAt: string;
  updatedAt: string;
  input: McpIngestJobInput;
  result?: IngestRunResult;
  error?: string;
}

const MAX_CONCURRENT_PER_VAULT = 2;
const MAX_STORED_JOBS = 50;
const runningByVault = new Map<string, number>();

function jobsDir(vaultRoot: string): string {
  return join(vaultRoot, '.memoss', 'mcp-jobs');
}

function jobPath(vaultRoot: string, id: string): string {
  return join(jobsDir(vaultRoot), `${id}.json`);
}

export function canStartMcpJob(vaultRoot: string): boolean {
  return (runningByVault.get(vaultRoot) ?? 0) < MAX_CONCURRENT_PER_VAULT;
}

export function markMcpJobRunning(vaultRoot: string): void {
  runningByVault.set(vaultRoot, (runningByVault.get(vaultRoot) ?? 0) + 1);
}

export function markMcpJobFinished(vaultRoot: string): void {
  const next = (runningByVault.get(vaultRoot) ?? 1) - 1;
  if (next <= 0) {
    runningByVault.delete(vaultRoot);
  } else {
    runningByVault.set(vaultRoot, next);
  }
}

export function purgeOldMcpJobs(vaultRoot: string, keep = MAX_STORED_JOBS): void {
  const dir = jobsDir(vaultRoot);
  if (!existsSync(dir)) {
    return;
  }

  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const path = join(dir, name);
      let updatedAt = '';
      try {
        const job = JSON.parse(readFileSync(path, 'utf8')) as McpIngestJob;
        updatedAt = job.updatedAt;
      } catch {
        updatedAt = '';
      }
      return { path, updatedAt };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  for (const entry of files.slice(keep)) {
    try {
      unlinkSync(entry.path);
    } catch {
      // Best-effort cleanup.
    }
  }
}

export function writeMcpJob(vaultRoot: string, job: McpIngestJob): void {
  mkdirSync(jobsDir(vaultRoot), { recursive: true });
  writeFileSync(jobPath(vaultRoot, job.id), `${JSON.stringify(job, null, 2)}\n`, 'utf8');
}

export function readMcpJob(
  vaultRoot: string,
  id: string,
): McpIngestJob | undefined {
  const path = jobPath(vaultRoot, id);
  if (!existsSync(path)) {
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as McpIngestJob;
  } catch {
    return undefined;
  }
}

export function createMcpIngestJob(
  vaultRoot: string,
  input: McpIngestJobInput,
): McpIngestJob {
  purgeOldMcpJobs(vaultRoot);
  const now = new Date().toISOString();
  const job: McpIngestJob = {
    id: randomUUID(),
    type: 'ingest',
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    input,
  };
  writeMcpJob(vaultRoot, job);
  return job;
}

export function updateMcpJob(
  vaultRoot: string,
  id: string,
  patch: Partial<Omit<McpIngestJob, 'id' | 'type'>>,
): McpIngestJob | undefined {
  const job = readMcpJob(vaultRoot, id);
  if (!job) {
    return undefined;
  }
  const updated: McpIngestJob = {
    ...job,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeMcpJob(vaultRoot, updated);
  return updated;
}
