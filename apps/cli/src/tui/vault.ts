import {
  computeHealthScore,
  FsKnowledgeStore,
  loadVaultConfig,
  runDeterministicLint,
} from '@memoss/core';
import { resolveVaultRoot } from '../utils/vault.js';
import type { VaultHeader } from './types.js';

export async function resolveShellVault(vaultArg?: string): Promise<string> {
  if (vaultArg) {
    return vaultArg;
  }
  try {
    return resolveVaultRoot({});
  } catch {
    throw new Error('No vault found. Run memoss init or use -C <vault>.');
  }
}

export async function loadVaultHeader(vaultRoot: string): Promise<VaultHeader> {
  const config = loadVaultConfig(vaultRoot);
  const store = new FsKnowledgeStore(vaultRoot);
  const pages = await store.listPages();
  const lint = await runDeterministicLint(store);
  const healthScore = computeHealthScore(lint.issues, lint.pageCount);
  return {
    name: config.name,
    pageCount: pages.length,
    healthScore,
  };
}
