import { discoverVaultPath } from '@memoss/core';

export interface VaultFlagContext {
  vault?: string;
}

export function resolveVaultRoot(ctx: VaultFlagContext): string {
  return discoverVaultPath({ vaultPath: ctx.vault });
}
