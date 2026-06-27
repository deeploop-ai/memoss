import type { VaultConfig } from '../config/vault-config.js';
import type { SkillRecord } from '../skills/types.js';

export interface ExtractToolContext {
  vaultRoot: string;
  config: VaultConfig;
  skills: Map<string, SkillRecord>;
  outputDir: string;
  sourceUri: string;
  expectedOutputPath?: string;
  writtenMarkdownPaths?: string[];
  activeSkillBaseDir?: string;
}
