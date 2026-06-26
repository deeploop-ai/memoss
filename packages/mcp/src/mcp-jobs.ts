import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

function jobsDir(vaultRoot: string): string {
  return join(vaultRoot, '.memoss', 'mcp-jobs');
}

function jobPath(vaultRoot: string, id: string): string {
  return join(jobsDir(vaultRoot), `${id}.json`);
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
  return JSON.parse(readFileSync(path, 'utf8')) as McpIngestJob;
}

export function createMcpIngestJob(
  vaultRoot: string,
  input: McpIngestJobInput,
): McpIngestJob {
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
