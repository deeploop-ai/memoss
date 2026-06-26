import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExtractMeta, ExtractRoute } from './types.js';
import type { SkillRecord } from './types.js';
import { getSkillMtime } from './discovery.js';

export interface ExtractCacheRecord {
  cache_key: string;
  source_uri: string;
  skill_key: string;
  output_path: string;
  meta_path: string;
  meta: ExtractMeta;
  cached_at: string;
}

function cacheDir(vaultRoot: string): string {
  return join(vaultRoot, '.memoss', 'cache', 'extract');
}

function cacheFilePath(vaultRoot: string, cacheKey: string): string {
  return join(cacheDir(vaultRoot), `${cacheKey}.json`);
}

export function buildExtractCacheKey(input: {
  sourceUri: string;
  route: ExtractRoute;
  skill?: SkillRecord;
}): string {
  const skillKey =
    input.route.mode === 'skill'
      ? input.route.skillName ?? 'skill'
      : input.route.mode;
  const skillMtime = input.skill ? String(getSkillMtime(input.skill)) : '0';
  const raw = `${input.sourceUri}|${skillKey}|${skillMtime}`;
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

export function readExtractCache(
  vaultRoot: string,
  cacheKey: string,
): ExtractCacheRecord | undefined {
  const path = cacheFilePath(vaultRoot, cacheKey);
  if (!existsSync(path)) {
    return undefined;
  }
  try {
    const record = JSON.parse(readFileSync(path, 'utf8')) as ExtractCacheRecord;
    if (!existsSync(record.output_path)) {
      return undefined;
    }
    return record;
  } catch {
    return undefined;
  }
}

export function writeExtractCache(
  vaultRoot: string,
  record: ExtractCacheRecord,
): void {
  const dir = cacheDir(vaultRoot);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    cacheFilePath(vaultRoot, record.cache_key),
    `${JSON.stringify(record, null, 2)}\n`,
    'utf8',
  );
}
