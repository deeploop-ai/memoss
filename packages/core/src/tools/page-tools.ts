import { z } from 'zod';
import { MemossError } from '../errors.js';
import { validateForWrite } from '../okf/validator.js';
import type { ToolContext } from './context.js';
import { defineTool } from './define-tool.js';
import { mergeFrontmatter, normalizeToolPath, toolResult } from './utils.js';

const pathSchema = z.object({
  path: z.string().describe('Vault-relative path to the OKF page'),
});

export function createReadPageTool(ctx: ToolContext) {
  return defineTool(ctx, {
    description: 'Read an OKF page from the vault.',
    inputSchema: pathSchema,
    execute: async ({ path }) => {
      const normalized = normalizeToolPath(path);
      ctx.policies.augment.markRead(normalized);

      if (!(await ctx.store.exists(normalized))) {
        return { path: normalized, exists: false, frontmatter: {}, body: '' };
      }

      const doc = await ctx.store.readPage(normalized);
      return {
        path: normalized,
        exists: true,
        frontmatter: doc.frontmatter,
        body: doc.body,
      };
    },
  });
}

const writePageSchema = z.object({
  path: z.string(),
  frontmatter: z.record(z.string(), z.unknown()),
  body: z.string(),
});

export function createWritePageTool(ctx: ToolContext) {
  return defineTool(ctx, {
    description: 'Write or update an OKF page in the vault.',
    inputSchema: writePageSchema,
    execute: async ({ path, frontmatter, body }) => {
      const normalized = normalizeToolPath(path);
      const warnings = [];

      ctx.policies.augment.assertReadFirst(normalized);

      const exists = await ctx.store.exists(normalized);
      const existing = exists ? await ctx.store.readPage(normalized) : null;
      const mergedFrontmatter = existing
        ? mergeFrontmatter(existing.frontmatter, frontmatter)
        : frontmatter;

      if (existing) {
        const shrinkWarning = ctx.policies.augment.checkBodyNotShrunk(
          existing.body,
          body,
        );
        if (shrinkWarning) {
          warnings.push(shrinkWarning);
        }
      }

      validateForWrite({ frontmatter: mergedFrontmatter, body }, normalized);

      const citationWarning = ctx.policies.citation.check(body);
      if (citationWarning) {
        warnings.push(citationWarning);
      }

      await ctx.store.writePage(normalized, {
        frontmatter: mergedFrontmatter,
        body,
      });

      return toolResult({ path: normalized, written: true }, warnings);
    },
  });
}

export function createListPagesTool(ctx: ToolContext) {
  return defineTool(ctx, {
    description: 'List OKF pages in the vault, optionally scoped to a directory.',
    inputSchema: z.object({
      dir: z.string().optional(),
    }),
    execute: async ({ dir }) => ({
      pages: await ctx.store.listPages(dir ? normalizeToolPath(dir) : undefined),
    }),
  });
}

export function createDeletePageTool(ctx: ToolContext) {
  return defineTool(ctx, {
    description: 'Delete an OKF page from the vault.',
    inputSchema: pathSchema,
    execute: async ({ path }) => {
      const normalized = normalizeToolPath(path);
      await ctx.store.deletePage(normalized);
      return { path: normalized, deleted: true };
    },
  });
}

export function createReadIndexTool(ctx: ToolContext) {
  return defineTool(ctx, {
    description: 'Read an index.md file from the vault.',
    inputSchema: z.object({
      dir: z.string().optional(),
    }),
    execute: async ({ dir }) => ({
      dir: dir ?? '',
      content: await ctx.store.readIndex(dir ? normalizeToolPath(dir) : undefined),
    }),
  });
}

export function createWriteIndexTool(ctx: ToolContext) {
  return defineTool(ctx, {
    description: 'Write an index.md file in the vault.',
    inputSchema: z.object({
      dir: z.string(),
      content: z.string(),
    }),
    execute: async ({ dir, content }) => {
      const normalized = normalizeToolPath(dir);
      await ctx.store.writeIndex(normalized, content);
      return { dir: normalized, written: true };
    },
  });
}

export function createReadLogTool(ctx: ToolContext) {
  return defineTool(ctx, {
    description: 'Read the vault activity log.',
    inputSchema: z.object({}),
    execute: async () => ({ content: await ctx.store.readLog() }),
  });
}

export function createAppendLogTool(ctx: ToolContext) {
  return defineTool(ctx, {
    description: 'Append a line to the vault activity log.',
    inputSchema: z.object({
      line: z.string(),
      date: z.string().optional(),
    }),
    execute: async ({ line, date }) => {
      await ctx.store.appendLog(line, date);
      return { appended: true };
    },
  });
}

export function createSearchKbTool(ctx: ToolContext) {
  return defineTool(ctx, {
    description: 'Search the knowledge base using grep-style matching.',
    inputSchema: z.object({
      query: z.string(),
    }),
    execute: async ({ query }) => ({
      results: await import('./search-kb.js').then((mod) =>
        mod.searchKb(ctx.store, query),
      ),
    }),
  });
}

export function createFetchUrlTool(ctx: ToolContext) {
  return defineTool(ctx, {
    description: 'Fetch a URL and return markdown text.',
    inputSchema: z.object({
      url: z.string().url(),
    }),
    execute: async ({ url }) => {
      const { fetchUrl } = await import('../adapters/fetch.js');
      const result = await fetchUrl(url);
      return {
        url: result.url,
        title: result.title,
        mime: result.mime,
        text: result.text,
        links: result.links,
      };
    },
  });
}

export function createListSourcesTool(ctx: ToolContext) {
  return defineTool(ctx, {
    description: 'List items available from the active source adapter.',
    inputSchema: z.object({}),
    execute: async () => {
      if (!ctx.source) {
        throw new MemossError('SOURCE_ERROR', 'No source adapter configured');
      }
      return { items: await ctx.source.listItems() };
    },
  });
}

export function createReadSourceTool(ctx: ToolContext) {
  return defineTool(ctx, {
    description: 'Read one item from the active source adapter.',
    inputSchema: z.object({
      id: z.string(),
    }),
    execute: async ({ id }) => {
      if (!ctx.source) {
        throw new MemossError('SOURCE_ERROR', 'No source adapter configured');
      }
      return await ctx.source.readItem(id);
    },
  });
}

function requireGit(ctx: ToolContext) {
  if (!ctx.config.git.enabled) {
    throw new MemossError('GIT_ERROR', 'Git is disabled for this vault');
  }
}

export function createGitCommitTool(ctx: ToolContext) {
  return defineTool(ctx, {
    description: 'Stage all changes and create a git commit.',
    inputSchema: z.object({
      message: z.string(),
    }),
    execute: async ({ message }) => {
      requireGit(ctx);
      const hash = await ctx.git.commit(message);
      return { hash };
    },
  });
}

export function createGitDiffTool(ctx: ToolContext) {
  return defineTool(ctx, {
    description: 'Show the current git diff.',
    inputSchema: z.object({
      ref: z.string().optional(),
    }),
    execute: async ({ ref }) => {
      requireGit(ctx);
      return { diff: await ctx.git.diff(ref) };
    },
  });
}

export function createGitLogTool(ctx: ToolContext) {
  return defineTool(ctx, {
    description: 'Show recent git commits.',
    inputSchema: z.object({
      limit: z.number().int().positive().optional(),
    }),
    execute: async ({ limit }) => {
      requireGit(ctx);
      return { commits: await ctx.git.log(limit) };
    },
  });
}

export function createGitCreateBranchTool(ctx: ToolContext) {
  return defineTool(ctx, {
    description: 'Create and checkout a git branch.',
    inputSchema: z.object({
      name: z.string(),
    }),
    execute: async ({ name }) => {
      requireGit(ctx);
      await ctx.git.createBranch(name);
      return { branch: name };
    },
  });
}

export function createGitMergeTool(ctx: ToolContext) {
  return defineTool(ctx, {
    description: 'Merge a git branch into the current branch.',
    inputSchema: z.object({
      branch: z.string(),
      ffOnly: z.boolean().optional(),
    }),
    execute: async ({ branch, ffOnly }) => {
      requireGit(ctx);
      await ctx.git.merge(branch, { ffOnly });
      return { merged: branch };
    },
  });
}
