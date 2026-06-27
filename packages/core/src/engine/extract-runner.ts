import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { loadVaultConfig } from '../config/vault-config.js';
import { MemossError } from '../errors.js';
import { buildSkillCatalog } from '../skills/catalog.js';
import { discoverSkills } from '../skills/discovery.js';
import { registerExtractProvenance } from '../provenance/manifest.js';
import {
  buildExtractCacheKey,
  readExtractCache,
  writeExtractCache,
} from '../skills/extract-cache.js';
import { findFastPathScript, runFastPathExtract } from '../skills/fast-path.js';
import { runFallbackExtract } from '../skills/fallback-extract.js';
import {
  filterExtractRelevantSkills,
  hasExtractRelevantSkills,
} from '../skills/extract-relevant.js';
import { resolveExtractRoute } from '../skills/router.js';
import { contentHash, sourceToSlug } from '../skills/slug.js';
import type { ExtractMeta } from '../skills/types.js';
import { createExtractToolRegistry } from '../tools/extract-tools.js';
import type { ExtractToolContext } from '../tools/extract-context.js';
import { buildSystemPrompt, createPromptContext } from './context.js';
import { runAgentLoop } from './orchestrator.js';
import { resolveRunnerModel, vaultExists } from './runner-setup.js';
import { summarizeAgentStep } from './step-summary.js';
import type { ExtractRunOptions, ExtractRunResult } from './types.js';
import type { SourceKind } from '../adapters/types.js';

function buildExtractPrompt(opts: {
  source: string;
  extractKind: string;
  outputPath: string;
  selectedSkill?: string;
  routeSource: string;
}): string {
  const lines = [
    'Extract the following source into markdown.',
    '',
    `Source URI: ${opts.source}`,
    `Extract kind: ${opts.extractKind}`,
    `Output path (relative to vault): ${opts.outputPath}`,
  ];

  if (opts.selectedSkill) {
    lines.push(`Pre-selected skill: ${opts.selectedSkill} (${opts.routeSource})`);
    lines.push('', 'Activate that skill and follow its instructions.');
  } else {
    lines.push('', 'Choose the best skill from the catalog, then extract.');
  }

  lines.push('', 'Write the final markdown to the output path before finishing.');
  return lines.join('\n');
}

function resolveOutputPaths(
  vaultRoot: string,
  outputDir: string,
  source: string,
): { markdownPath: string; metaPath: string; relativeMarkdown: string } {
  const slug = sourceToSlug(source);
  const relativeMarkdown = join(outputDir, `${slug}.md`).replace(/\\/g, '/');
  const relativeMeta = join(outputDir, `${slug}.meta.json`).replace(/\\/g, '/');
  return {
    relativeMarkdown,
    markdownPath: resolve(vaultRoot, relativeMarkdown),
    metaPath: resolve(vaultRoot, relativeMeta),
  };
}

function writeExtractMeta(
  metaPath: string,
  meta: ExtractMeta,
): void {
  mkdirSync(dirname(metaPath), { recursive: true });
  writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
}

function canFallback(extractKind: string): boolean {
  return extractKind === 'web' || extractKind === 'github' || extractKind === 'pdf';
}

function persistExtractOutcome(
  vaultRoot: string,
  config: ReturnType<typeof loadVaultConfig>,
  input: {
    source: string;
    route: ExtractRunResult['route'];
    markdownPath: string;
    metaPath: string;
    relativeMarkdown: string;
    meta: ExtractMeta;
    skills: Map<string, import('../skills/types.js').SkillRecord>;
    noCache?: boolean;
  },
): void {
  writeExtractMeta(input.metaPath, input.meta);

  if (config.provenance.enabled) {
    registerExtractProvenance(vaultRoot, {
      sourceUri: input.source,
      extractedPath: input.markdownPath,
      meta: input.meta,
    });
  }

  if (config.extraction.cache && !input.noCache) {
    const skillRecord =
      input.route.mode === 'skill' && input.route.skillName
        ? input.skills.get(input.route.skillName)
        : undefined;
    const cacheKey = buildExtractCacheKey({
      sourceUri: input.source,
      route: input.route,
      skill: skillRecord,
    });
    writeExtractCache(vaultRoot, {
      cache_key: cacheKey,
      source_uri: input.source,
      skill_key:
        input.route.mode === 'skill'
          ? (input.route.skillName ?? 'skill')
          : input.route.mode,
      output_path: input.markdownPath,
      meta_path: input.metaPath,
      meta: input.meta,
      cached_at: new Date().toISOString(),
    });
  }
}

function buildMetaFromOutput(input: {
  source: string;
  extractKind: ExtractRunResult['extractKind'];
  skillName?: string;
  skillLocation?: string;
  fallback: boolean;
  fastPath?: boolean;
  cached?: boolean;
  markdownPath: string;
}): ExtractMeta {
  const text = readFileSync(input.markdownPath, 'utf8');
  return {
    source_uri: input.source,
    extract_kind: input.extractKind,
    skill: input.skillName,
    skill_location: input.skillLocation,
    extracted_at: new Date().toISOString(),
    content_hash: contentHash(text),
    fallback: input.fallback,
    fast_path: input.fastPath,
    cached: input.cached,
  };
}

export async function runExtract(
  opts: ExtractRunOptions,
): Promise<ExtractRunResult> {
  if (!vaultExists(opts.vaultRoot)) {
    throw new MemossError(
      'VAULT_NOT_FOUND',
      `No vault found at ${opts.vaultRoot}`,
    );
  }

  const config = loadVaultConfig(opts.vaultRoot);
  const { route, extractKind } = resolveExtractRoute({
    source: opts.source,
    sourceKind: opts.kind,
    skillCli: opts.skill,
    config,
  });

  if (route.mode === 'skip') {
    return {
      status: 'skipped',
      source: opts.source,
      outputPath: opts.source,
      extractKind,
      route,
    };
  }

  const outputDir = config.extraction.output_dir;
  const { markdownPath, metaPath, relativeMarkdown } = resolveOutputPaths(
    opts.vaultRoot,
    outputDir,
    opts.source,
  );

  const { skills, warnings } = discoverSkills({
    vaultRoot: opts.vaultRoot,
    trustProjectSkills: config.extraction.trust_project_skills,
  });

  for (const warning of warnings) {
    opts.onWarning?.(warning);
  }

  const skillsForExtract = filterExtractRelevantSkills(skills, config);

  const selectedSkill =
    route.mode === 'skill' ? route.skillName : undefined;
  const skillRecord = selectedSkill ? skills.get(selectedSkill) : undefined;

  if (config.extraction.cache && !opts.noCache) {
    const cacheKey = buildExtractCacheKey({
      sourceUri: opts.source,
      route,
      skill: skillRecord,
    });
    const cached = readExtractCache(opts.vaultRoot, cacheKey);
    if (cached) {
      return {
        status: 'complete',
        source: opts.source,
        outputPath: cached.output_path,
        extractKind,
        route,
        meta: { ...cached.meta, cached: true },
        cached: true,
        text: `Cache hit for ${relativeMarkdown}`,
        steps: [],
        finishReason: 'stop',
        totalSteps: 0,
      };
    }
  }

  const persist = (meta: ExtractMeta) => {
    persistExtractOutcome(opts.vaultRoot, config, {
      source: opts.source,
      route,
      markdownPath,
      metaPath,
      relativeMarkdown,
      meta,
      skills,
      noCache: opts.noCache,
    });
  };

  if (
    route.mode === 'auto' &&
    !hasExtractRelevantSkills(skills, config) &&
    canFallback(extractKind)
  ) {
    opts.onWarning?.(
      'No extraction skills available; using built-in Readability fallback.',
    );
    const fallback = await runFallbackExtract({
      source: opts.source,
      extractKind,
      outputPath: markdownPath,
      metaPath,
    });
    persist(fallback.meta);
    return {
      status: 'complete',
      source: opts.source,
      outputPath: fallback.outputPath,
      extractKind,
      route: { mode: 'fallback', source: 'fallback' },
      meta: fallback.meta,
      text: `Fallback extraction wrote ${relativeMarkdown}`,
      steps: [],
      finishReason: 'stop',
      totalSteps: 0,
    };
  }

  if (route.mode === 'fallback') {
    const fallback = await runFallbackExtract({
      source: opts.source,
      extractKind,
      outputPath: markdownPath,
      metaPath,
    });
    persist(fallback.meta);
    return {
      status: 'complete',
      source: opts.source,
      outputPath: fallback.outputPath,
      extractKind,
      route,
      meta: fallback.meta,
      text: `Fallback extraction wrote ${relativeMarkdown}`,
      steps: [],
      finishReason: 'stop',
      totalSteps: 0,
    };
  }

  if (route.mode === 'skill' && selectedSkill && !skills.has(selectedSkill)) {
    if (canFallback(extractKind)) {
      opts.onWarning?.(
        `Skill "${selectedSkill}" not found; using built-in fallback.`,
      );
      const fallback = await runFallbackExtract({
        source: opts.source,
        extractKind,
        outputPath: markdownPath,
        metaPath,
      });
      persist(fallback.meta);
      return {
        status: 'complete',
        source: opts.source,
        outputPath: fallback.outputPath,
        extractKind,
        route,
        meta: fallback.meta,
        text: `Fallback extraction wrote ${relativeMarkdown}`,
        steps: [],
        finishReason: 'stop',
        totalSteps: 0,
      };
    }
    throw new MemossError('SKILL_ERROR', `Skill not found: ${selectedSkill}`);
  }

  if (
    route.mode === 'skill' &&
    selectedSkill &&
    skillRecord &&
    config.extraction.fast_path
  ) {
    const script = findFastPathScript(skillRecord.baseDir);
    if (script) {
      try {
        await runFastPathExtract({
          scriptPath: script,
          skillBaseDir: skillRecord.baseDir,
          sourceUri: opts.source,
          outputPath: markdownPath,
          vaultRoot: opts.vaultRoot,
          timeoutMs: config.extraction.bash_timeout_ms,
        });
        const meta = buildMetaFromOutput({
          source: opts.source,
          extractKind,
          skillName: skillRecord.name,
          skillLocation: skillRecord.location,
          fallback: false,
          fastPath: true,
          markdownPath,
        });
        persist(meta);
        return {
          status: 'complete',
          source: opts.source,
          outputPath: markdownPath,
          extractKind,
          route,
          meta,
          text: `Fast-path extraction wrote ${relativeMarkdown}`,
          steps: [],
          finishReason: 'stop',
          totalSteps: 0,
        };
      } catch (error) {
        opts.onWarning?.(
          `Fast-path failed (${error instanceof Error ? error.message : 'unknown'}); using Extract Agent.`,
        );
      }
    }
  }

  const catalog = buildSkillCatalog(
    route.mode === 'auto' ? skillsForExtract : skills,
  );
  const promptCtx = createPromptContext(opts.vaultRoot, config);
  const system = buildSystemPrompt({
    ...promptCtx,
    prompt: 'extract',
    extra: {
      source_uri: opts.source,
      extract_kind: extractKind,
      output_path: relativeMarkdown,
      selected_skill: selectedSkill ?? '(none — choose from catalog)',
      skill_instructions: selectedSkill
        ? `Use skill "${selectedSkill}" (pre-selected via ${route.source}).`
        : 'Select the most appropriate skill from the catalog.',
      skill_catalog: catalog.xml,
    },
  });

  const extractCtx: ExtractToolContext = {
    vaultRoot: opts.vaultRoot,
    config,
    skills: route.mode === 'auto' ? skillsForExtract : skills,
    outputDir,
    sourceUri: opts.source,
  };

  const tools = createExtractToolRegistry(extractCtx);
  const model = resolveRunnerModel(
    config,
    'flash',
    opts.model ?? config.extraction.model,
  );

  let agentResult;
  try {
    agentResult = await runAgentLoop({
      model,
      system,
      prompt: buildExtractPrompt({
        source: opts.source,
        extractKind,
        outputPath: relativeMarkdown,
        selectedSkill,
        routeSource: route.source,
      }),
      tools,
      maxSteps: config.extraction.max_steps,
      temperature: config.agent.temperature,
      abortSignal: opts.abortSignal,
      onStepFinish: (step) => {
        opts.onStepFinish?.(summarizeAgentStep(step, 0));
      },
    });
  } catch (error) {
    if (canFallback(extractKind)) {
      opts.onWarning?.(
        `Extract agent failed (${error instanceof Error ? error.message : 'unknown'}); using fallback.`,
      );
      const fallback = await runFallbackExtract({
        source: opts.source,
        extractKind,
        outputPath: markdownPath,
        metaPath,
      });
      persist(fallback.meta);
      return {
        status: 'complete',
        source: opts.source,
        outputPath: fallback.outputPath,
        extractKind,
        route,
        meta: fallback.meta,
        text: `Fallback extraction wrote ${relativeMarkdown}`,
        steps: [],
        finishReason: 'stop',
        totalSteps: 0,
      };
    }
    throw error;
  }

  if (!existsSync(markdownPath)) {
    if (canFallback(extractKind)) {
      opts.onWarning?.('Extract agent did not write output; using fallback.');
      const fallback = await runFallbackExtract({
        source: opts.source,
        extractKind,
        outputPath: markdownPath,
        metaPath,
      });
      persist(fallback.meta);
      return {
        status: 'complete',
        source: opts.source,
        outputPath: fallback.outputPath,
        extractKind,
        route,
        meta: fallback.meta,
        text: agentResult.text,
        steps: agentResult.steps,
        finishReason: agentResult.finishReason,
        totalSteps: agentResult.totalSteps,
      };
    }
    throw new MemossError(
      'EXTRACT_ERROR',
      `Extract agent finished without writing ${relativeMarkdown}`,
    );
  }

  const meta = buildMetaFromOutput({
    source: opts.source,
    extractKind,
    skillName: skillRecord?.name,
    skillLocation: skillRecord?.location,
    fallback: false,
    markdownPath,
  });
  persist(meta);

  return {
    status: agentResult.status === 'complete' ? 'complete' : 'incomplete',
    source: opts.source,
    outputPath: markdownPath,
    extractKind,
    route,
    meta,
    text: agentResult.text,
    steps: agentResult.steps,
    finishReason: agentResult.finishReason,
    totalSteps: agentResult.totalSteps,
  };
}

export async function resolveIngestSource(
  opts: ExtractRunOptions & { extract?: boolean | 'auto' },
): Promise<{
  source: string;
  kind: SourceKind | 'auto';
  extracted: boolean;
  originalSource: string;
  extractMeta?: ExtractMeta;
}> {
  const extractMode = opts.extract ?? 'auto';
  if (extractMode === false) {
    return {
      source: opts.source,
      kind: opts.kind ?? 'auto',
      extracted: false,
      originalSource: opts.source,
    };
  }

  const result = await runExtract(opts);
  if (result.status === 'skipped') {
    return {
      source: opts.source,
      kind: opts.kind ?? 'auto',
      extracted: false,
      originalSource: opts.source,
    };
  }

  return {
    source: result.outputPath,
    kind: 'file',
    extracted: true,
    originalSource: opts.source,
    extractMeta: result.meta,
  };
}
