import { MemossError } from '../errors.js';
import type { SourceRef } from '../okf/types.js';
import type { PoliciesConfig, PolicyAction } from './config.js';
import type { PolicyWarning } from './types.js';

/** Merge source refs by source_id when augmenting a page; append ingest auto-ref when provided. */
export function mergeAugmentSources(
  existing: SourceRef[] | undefined,
  incoming: SourceRef[] | undefined,
  autoSource?: SourceRef,
): SourceRef[] {
  const byId = new Map<string, SourceRef>();

  for (const ref of existing ?? []) {
    byId.set(ref.source_id, ref);
  }
  for (const ref of incoming ?? []) {
    const prior = byId.get(ref.source_id);
    byId.set(ref.source_id, prior ? { ...prior, ...ref } : ref);
  }
  if (autoSource && !byId.has(autoSource.source_id)) {
    byId.set(autoSource.source_id, autoSource);
  }

  return [...byId.values()].sort((left, right) =>
    left.source_id.localeCompare(right.source_id),
  );
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\/+/, '');
}

export interface PolicyViolation {
  code: string;
  message: string;
  action: PolicyAction;
}

function topLevelHeadings(body: string): string[] {
  const headings: string[] = [];
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (/^#\s+/.test(trimmed) && !/^##/.test(trimmed)) {
      headings.push(trimmed.replace(/^#\s+/, '').trim());
    }
  }
  return headings;
}

export class AugmentPolicy {
  private readonly readPaths = new Set<string>();

  constructor(private readonly config: PoliciesConfig['augment']) {}

  reset(): void {
    this.readPaths.clear();
  }

  markRead(path: string): void {
    this.readPaths.add(normalizePath(path));
  }

  assertReadFirst(path: string): void {
    if (!this.config.require_read_before_write) {
      return;
    }
    const normalized = normalizePath(path);
    if (!this.readPaths.has(normalized)) {
      throw new MemossError(
        'POLICY_VIOLATION',
        `read_page must be called before write_page for ${normalized}`,
      );
    }
  }

  checkBodyNotShrunk(oldBody: string, newBody: string): PolicyViolation | undefined {
    if (this.config.body_shrink_action === 'off') {
      return undefined;
    }
    const oldLength = oldBody.trim().length;
    const newLength = newBody.trim().length;
    if (oldLength === 0) {
      return undefined;
    }
    if (newLength < oldLength * this.config.body_shrink_threshold) {
      const ratio = Math.round((newLength / oldLength) * 100);
      return {
        code: 'BODY_SHRUNK',
        message: `Page body shrank to ${ratio}% of the previous length`,
        action: this.config.body_shrink_action,
      };
    }
    return undefined;
  }

  checkHeadingsPreserved(
    oldBody: string,
    newBody: string,
  ): PolicyViolation | undefined {
    if (this.config.preserve_headings === 'off') {
      return undefined;
    }
    const oldHeadings = topLevelHeadings(oldBody);
    if (oldHeadings.length === 0) {
      return undefined;
    }
    const newHeadings = topLevelHeadings(newBody);
    for (let index = 0; index < oldHeadings.length; index++) {
      if (newHeadings[index] !== oldHeadings[index]) {
        return {
          code: 'HEADINGS_NOT_PRESERVED',
          message: `Existing heading "${oldHeadings[index]}" at position ${index + 1} was dropped, renamed, or reordered`,
          action: this.config.preserve_headings,
        };
      }
    }
    return undefined;
  }

  checkResourceUnchanged(
    oldFrontmatter: Record<string, unknown>,
    newFrontmatter: Record<string, unknown>,
  ): PolicyViolation | undefined {
    if (this.config.preserve_resource_field === 'off') {
      return undefined;
    }
    const oldResource = oldFrontmatter.resource;
    if (oldResource === undefined || oldResource === null || oldResource === '') {
      return undefined;
    }
    const newResource = newFrontmatter.resource;
    if (String(newResource) !== String(oldResource)) {
      return {
        code: 'RESOURCE_CHANGED',
        message: `Frontmatter resource must not change during augment (was ${String(oldResource)})`,
        action: this.config.preserve_resource_field,
      };
    }
    return undefined;
  }

  /** @deprecated Use checkBodyNotShrunk returning PolicyViolation */
  legacyShrinkWarning(oldBody: string, newBody: string): PolicyWarning | undefined {
    const violation = this.checkBodyNotShrunk(oldBody, newBody);
    if (!violation) {
      return undefined;
    }
    return { code: violation.code, message: violation.message };
  }
}
