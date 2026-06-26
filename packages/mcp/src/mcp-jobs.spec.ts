import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createMcpIngestJob,
  readMcpJob,
  updateMcpJob,
} from './mcp-jobs.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createVault(): string {
  const root = mkdtempSync(join(tmpdir(), 'memoss-mcp-job-'));
  tempDirs.push(root);
  mkdirSync(join(root, '.memoss'), { recursive: true });
  return root;
}

describe('mcp-jobs', () => {
  it('creates and updates ingest jobs on disk', () => {
    const vaultRoot = createVault();
    const job = createMcpIngestJob(vaultRoot, {
      source: 'https://example.com',
      kind: 'web',
      noDraft: true,
    });

    expect(job.status).toBe('pending');
    expect(readMcpJob(vaultRoot, job.id)?.id).toBe(job.id);

    const updated = updateMcpJob(vaultRoot, job.id, { status: 'running' });
    expect(updated?.status).toBe('running');
    expect(readMcpJob(vaultRoot, job.id)?.status).toBe('running');
  });
});
