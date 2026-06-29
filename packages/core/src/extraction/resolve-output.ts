import { copyFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import fg from 'fast-glob';

/**
 * Locate markdown the agent wrote when it missed the canonical output path
 * (e.g. wrote via bash with the wrong working directory).
 */
export function resolveExtractMarkdownOutput(
  vaultRoot: string,
  outputDir: string,
  expectedMarkdownPath: string,
): string | undefined {
  if (existsSync(expectedMarkdownPath)) {
    return expectedMarkdownPath;
  }

  const expectedName = basename(expectedMarkdownPath);
  const outputRoot = resolve(vaultRoot, outputDir);

  const direct = join(outputRoot, expectedName);
  if (existsSync(direct)) {
    return direct;
  }

  const matches = fg.sync(`**/${expectedName}`, {
    cwd: outputRoot,
    onlyFiles: true,
    absolute: true,
  });

  if (matches.length === 1) {
    return resolve(matches[0]!);
  }

  if (matches.length > 1) {
    const shortest = [...matches].sort(
      (left, right) => left.length - right.length,
    )[0];
    return shortest ? resolve(shortest) : undefined;
  }

  const slugPrefix = expectedName.replace(/\.md$/i, '');
  const slugMatches = fg.sync(`**/${slugPrefix}.md`, {
    cwd: outputRoot,
    onlyFiles: true,
    absolute: true,
  });

  if (slugMatches.length === 1) {
    return resolve(slugMatches[0]!);
  }

  return undefined;
}

/**
 * Recover markdown the agent wrote under the active skill directory instead of
 * the vault (common when bash cwd is the skill baseDir).
 */
export function resolveSkillLocalExtractOutput(
  skillBaseDir: string | undefined,
  expectedMarkdownPath: string,
): string | undefined {
  if (!skillBaseDir) {
    return undefined;
  }

  const expectedName = basename(expectedMarkdownPath);
  const skillRoot = resolve(skillBaseDir);

  const misplacedVaultRelative = join(
    skillRoot,
    'sources',
    'extracted',
    expectedName,
  );
  if (existsSync(misplacedVaultRelative)) {
    return resolve(misplacedVaultRelative);
  }

  const firecrawlDir = join(skillRoot, '.firecrawl');
  if (existsSync(firecrawlDir)) {
    const matches = fg.sync('**/*.md', {
      cwd: firecrawlDir,
      onlyFiles: true,
      absolute: true,
    });
    if (matches.length === 1) {
      return resolve(matches[0]!);
    }
  }

  return undefined;
}

export function normalizeExtractOutputPath(
  expectedMarkdownPath: string,
  discoveredPath: string,
): string {
  if (resolve(discoveredPath) === resolve(expectedMarkdownPath)) {
    return expectedMarkdownPath;
  }

  mkdirSync(dirname(expectedMarkdownPath), { recursive: true });
  try {
    renameSync(discoveredPath, expectedMarkdownPath);
  } catch {
    copyFileSync(discoveredPath, expectedMarkdownPath);
    try {
      unlinkSync(discoveredPath);
    } catch {
      // Best-effort cleanup of the discovered copy.
    }
  }
  return expectedMarkdownPath;
}
