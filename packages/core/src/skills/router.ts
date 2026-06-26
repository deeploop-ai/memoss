import type { VaultConfig } from '../config/vault-config.js';
import { resolveSkillOverride } from './glob-match.js';
import {
  inferExtractKind,
  shouldSkipExtract,
} from './infer-extract-kind.js';
import type { ExtractKind, ExtractRoute } from './types.js';
import type { SourceKind } from '../adapters/types.js';

export interface ResolveExtractRouteInput {
  source: string;
  sourceKind?: SourceKind | 'auto';
  skillCli?: string;
  config: VaultConfig;
}

export function resolveExtractRoute(input: ResolveExtractRouteInput): {
  route: ExtractRoute;
  extractKind: ExtractKind;
} {
  const extractKind = inferExtractKind(input.source, input.sourceKind ?? 'auto');

  if (input.skillCli) {
    return {
      extractKind,
      route: {
        mode: 'skill',
        skillName: input.skillCli,
        source: 'cli',
      },
    };
  }

  if (shouldSkipExtract(extractKind)) {
    return {
      extractKind,
      route: { mode: 'skip', source: 'skip' },
    };
  }

  if (!input.config.extraction.enabled) {
    return {
      extractKind,
      route: { mode: 'fallback', source: 'fallback' },
    };
  }

  const mappedSkill = input.config.extraction.skills[extractKind];
  if (mappedSkill) {
    return {
      extractKind,
      route: {
        mode: 'skill',
        skillName: mappedSkill,
        source: 'config',
      },
    };
  }

  const overrideSkill = resolveSkillOverride(
    input.source,
    input.config.extraction.skill_overrides,
  );
  if (overrideSkill) {
    return {
      extractKind,
      route: {
        mode: 'skill',
        skillName: overrideSkill,
        source: 'override',
      },
    };
  }

  if (input.config.extraction.auto_select) {
    return {
      extractKind,
      route: { mode: 'auto', source: 'auto' },
    };
  }

  return {
    extractKind,
    route: { mode: 'fallback', source: 'fallback' },
  };
}
