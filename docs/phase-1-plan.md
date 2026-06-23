# Memoss — Phase 1 Implementation Plan

**Date:** 2026-06-23
**Duration:** 0–6 months
**Goal:** Open-source CLI that developers adopt for personal and project knowledge management. Validate the core agent loop.

---

## 1. Phase 1 Deliverables (Recap)

| Package | npm Name | Content |
|---------|----------|---------|
| `packages/core` | `@memoss/core` | OKF parser, agent engine, tool registry, interfaces + adapters |
| `apps/cli` | `@memoss/cli` | CLI with `init` / `ingest` / `query` / `lint` / `status` / `view` / `serve` |
| `packages/mcp` | `@memoss/mcp-server` | MCP server exposing all core tools |

> **Note:** CLI lives in `apps/` (deployable application), not `packages/`. Core engine and MCP server are publishable libraries in `packages/`.

---

## 2. Milestone Breakdown

### Milestone 0: Project Scaffold

**Goals:** Nx monorepo initialized, packages skeleton generated, CI running.

**Steps:**

1. `pnpm create nx-workspace memoss --template nrwl/typescript-template`
2. Configure root `tsconfig.base.json` with strict mode and path aliases
3. Generate projects:
   ```bash
   nx g @nx/js:lib packages/core --bundler=tsc --unitTestRunner=vitest --linter=eslint
   nx g @nx/js:lib packages/mcp --bundler=tsc --unitTestRunner=vitest --linter=eslint
   nx g @nx/js:app apps/cli --bundler=tsc --unitTestRunner=vitest --linter=eslint
   ```
4. Set up `@memoss/cli` as an `application` type with `bin` entry pointing to `src/main.ts`
5. Configure inter-project dependencies: `cli → core`, `mcp → core`
6. Set up GitHub Actions: lint → test → build on PR

**Exit criteria:**
- [ ] All projects build successfully with `pnpm nx build`
- [ ] `pnpm nx test` runs across all projects (even if no tests yet)
- [ ] CI pipeline green on `main`

---

### Milestone 1: OKF Document Model

**Goals:** Core OKF types, parser, serializer, validator conforming to OKF Spec v1.0.

**Location:** `packages/core/src/okf/`

**Files:**
```
okf/
├── types.ts          # OKFDocument, IndexDocument, LogEntry, ConceptRef types
├── parser.ts         # Parse markdown string → OKFDocument
├── serializer.ts     # OKFDocument → markdown string
├── validator.ts      # Validate conformance (dual-mode: read vs write)
├── index.ts          # Generate index.md from directory listing
└── paths.ts          # Concept ID ↔ file path conversion
```

**Key types:**

```typescript
interface OKFDocument {
  frontmatter: {
    type: string;           // REQUIRED (both modes)
    title?: string;         // REQUIRED for agent writes, optional for reads
    description?: string;   // REQUIRED for agent writes, optional for reads
    resource?: string;      // Canonical URI (if the concept describes an asset)
    tags?: string[];        // Cross-cutting categorization
    timestamp?: string;     // ISO 8601, auto-filled on write
    [key: string]: unknown; // Extensions — preserved on round-trip
  };
  body: string;             // Markdown content
}

interface IndexDocument {
  sections: Array<{
    heading: string;        // Typically the concept type (e.g. "Reference", "BigQuery Table")
    entries: Array<{
      title: string;
      url: string;          // Relative path to the concept .md file
      description?: string; // From frontmatter, or fallback
    }>;
  }>;
}

interface LogEntry {
  date: string;             // ISO 8601 YYYY-MM-DD
  action: string;           // e.g. "Ingest", "Lint", "Creation", "Update"
  description: string;      // Free-form prose
  affectedPaths?: string[]; // Paths touched by this entry
}
```

**Validation strategy — dual-mode:**

The validator has two strictness levels, reflecting the reality that OKF Spec v0.1 requires _only_ `type`, but agent-authored documents should be more complete:

| Mode | Required Fields | Use Case |
|------|----------------|----------|
| **Read** (parse) | `type` only | Consuming existing bundles, third-party OKF content, partial docs |
| **Write** (agent output) | `type` + `title` + `description` | Agent-authored documents — ensures index.md generation quality |

```typescript
// validator.ts
export function validateForRead(doc: OKFDocument): ValidationResult { ... }
export function validateForWrite(doc: OKFDocument): ValidationResult { ... }
```

This matches the reference agent's `REQUIRED_FRONTMATTER_KEYS = ("type", "title", "description", "timestamp")` but keeps the read path permissive per the OKF Spec's "MUST NOT reject" rule for missing optional fields.

**Cross-linking format choice:**

| OKF Spec recommends | Reference agent actually uses | Memoss Phase 1 choice |
|---------------------|-------------------------------|----------------------|
| Bundle-relative (`/tables/orders.md`) | File-relative (`../tables/orders.md`) | **File-relative** |

**Rationale:** Bundle-relative links (starting with `/`) break GitHub rendering and local file browsing — the two primary consumption modes for Phase 1. File-relative links work everywhere. We follow the reference agent's practice, not the Spec's recommendation.

The `paths.ts` module handles resolution of both forms for consumption, but the agent is instructed to **write file-relative links only**.

**Tests:** Parse round-trip, frontmatter extraction, dual-mode validation (read-permissive / write-strict), reserved filename detection, edge cases (empty body, missing optional fields, unknown frontmatter keys preserved).

**Exit criteria:**
- [ ] Parse/serialize/validate passes OKF Spec conformance tests
- [ ] Round-trip test: `serialize(parse(file)) === file`
- [ ] Unknown frontmatter keys preserved across round-trip
- [ ] All knowledge-catalog sample bundles parse without errors
- [ ] Validator rejects agent writes missing `title` or `description`

---

### Milestone 2: Knowledge Store + Source Adapters

**Goals:** File system abstraction for reading/writing OKF files on disk. Source abstraction for reading content from files, URLs, and GitHub repos.

**Location:** `packages/core/src/adapters/`

**Files:**
```
adapters/
├── fs-store.ts            # FsKnowledgeStore implements KnowledgeStore
├── simple-git.ts          # SimpleGitAdapter implements GitAdapter
├── source-file.ts         # FileSourceAdapter — reads local .md/.txt/.pdf files
├── source-web.ts          # WebSourceAdapter — fetches URL → markdown
├── source-github.ts       # GitHubSourceAdapter — clones/reads repo files
└── fetch.ts               # FetchAdapter — raw HTTP fetch utility
```

**Interfaces** (in `packages/core/src/interfaces/`):

```typescript
// === Knowledge Store ===

interface KnowledgeStore {
  readPage(path: string): Promise<OKFDocument>;
  writePage(path: string, doc: OKFDocument): Promise<void>;
  deletePage(path: string): Promise<void>;
  listPages(dir?: string): Promise<string[]>;
  readIndex(dir?: string): Promise<IndexDocument | null>;
  writeIndex(dir: string, content: string): Promise<void>;
  readLog(limit?: number): Promise<LogEntry[]>;
  appendLog(entry: LogEntry): Promise<void>;
}

// === Git ===

interface GitAdapter {
  commit(message: string): Promise<string>;    // returns commit hash
  diff(): Promise<string>;
  log(limit?: number): Promise<Commit[]>;
  isRepo(): Promise<boolean>;
  init(): Promise<void>;
}

// === Source (Phase 1 — Karpathy-style document sources) ===

interface SourceAdapter {
  /** Unique identifier for this source instance (e.g. file path, URL, repo slug). */
  readonly sourceUri: string;

  /** List all ingestible items from this source. */
  listItems(): Promise<SourceItem[]>;

  /** Read a single item's full content (already converted to markdown text). */
  readItem(id: string): Promise<SourceContent>;
}

interface SourceItem {
  id: string;              // Unique within this source
  title?: string;          // Derived from filename / page title / commit message
  type: 'file' | 'web' | 'github';
  mimeType?: string;       // 'text/markdown' | 'application/pdf' | 'text/plain' | etc.
}

interface SourceContent {
  text: string;            // Markdown body (pdf/txt converted to markdown where possible)
  metadata: {
    sourceUri: string;     // Canonical source URI
    fetchedAt: string;     // ISO 8601
    [key: string]: unknown;
  };
}
```

**Source adapter implementations for Phase 1:**

| Adapter | `sourceUri` pattern | `listItems()` behavior |
|---------|---------------------|----------------------|
| `FileSourceAdapter` | `./path/to/file.md` or `./path/to/dir/` | Lists all .md/.txt/.pdf files in path |
| `WebSourceAdapter` | `https://example.com/article` | Single item (the URL itself) |
| `GitHubSourceAdapter` | `owner/repo` or `owner/repo/sub/path` | Lists all .md files in the repo |

**Exit criteria:**
- [ ] `FsStore` correctly reads/writes/deletes OKF files on disk
- [ ] `SimpleGitAdapter` commits, diffs, reads log
- [ ] Three source adapters list and read items
- [ ] Graceful handling of missing files, empty directories, non-git directories

---

### Milestone 3: Tool Registry

**Goals:** Define all agent tools with Zod schemas and implementations. Align with eve tool conventions (one file per tool, `defineTool` pattern).

**Location:** `packages/core/src/tools/`

**Tool inventory:**

```
tools/
├── define-tool.ts        # Tool definition helper (eve-compatible shape)
├── read_page.ts          # Read an OKF page by path
├── write_page.ts         # Write/create an OKF page (with read-before-write guard)
├── list_pages.ts         # List all pages in the knowledge base
├── read_index.ts         # Read index.md at a directory
├── write_index.ts        # Write/replace index.md
├── search_kb.ts          # Full-text search across knowledge base (grep-based for Phase 1)
├── read_log.ts           # Read activity log
├── append_log.ts         # Append to activity log
├── fetch_url.ts          # Fetch URL → markdown
├── read_source.ts        # Read a raw source item via SourceAdapter
├── list_sources.ts       # List items in a source
├── git_commit.ts         # Commit all changes
├── git_diff.ts           # Show uncommitted changes
└── git_log.ts            # Show commit history
```

**Design pattern (eve-aligned):**

```typescript
// tools/read_page.ts
import { defineTool } from './define-tool';
import { z } from 'zod';

export default defineTool({
  description: 'Read an OKF knowledge page from the knowledge base.',
  inputSchema: z.object({
    path: z.string().describe('Path to the .md file, relative to knowledge base root.'),
  }),
  async execute({ path }, ctx) {
    const doc = await ctx.store.readPage(path);
    return { frontmatter: doc.frontmatter, body: doc.body };
  },
});
```

**Read-before-write guard in `write_page.ts`:**

```typescript
// write_page.ts — key safety logic
async execute({ conceptId, frontmatter, body }, ctx) {
  const path = conceptIdToFilePath(conceptId);
  const existing = await ctx.store.readPage(path).catch(() => null);

  // If augmenting an existing page, validate (Phase 1 soft checks)
  if (existing) {
    // Preserve existing frontmatter keys not explicitly changed
    const merged = { ...existing.frontmatter, ...frontmatter };
    // Warn if body is substantially shorter (possible accidental overwrite)
    if (body.length < existing.body.length * 0.3) {
      return { warning: 'New body is significantly shorter than existing. Verify this is intentional.' };
    }
  }

  const doc = { frontmatter: applyTimestamp(merged ?? frontmatter), body };
  validateForWrite(doc); // throws on missing required fields for agent writes
  await ctx.store.writePage(path, doc);
  return { path, bytes: Buffer.byteLength(JSON.stringify(doc), 'utf-8') };
}
```

**Exit criteria:**
- [ ] All 15 tools defined with Zod schemas
- [ ] Each tool has unit tests for execution and input validation
- [ ] Tool registry aggregates all tools for injection into agent
- [ ] `write_page` read-before-write guard tested

---

### Milestone 4: Agent Engine

**Goals:** Three agent runners (ingest, query, lint) powered by Vercel AI SDK.

**Location:** `packages/core/src/engine/`

**Files:**
```
engine/
├── agent-config.ts     # Model selection, provider config
├── context.ts          # System prompt builder, context assembly
├── ingest-runner.ts    # Ingest: source → read → analyze → write N pages
├── query-runner.ts     # Query: question → search → read → synthesize
├── lint-runner.ts      # Lint: scan all → compare → report issues
└── prompts/            # System prompts for each operation
    ├── ingest.md
    ├── query.md
    └── lint.md
```

**Ingest flow (refined — Karpathy pattern + reference agent learnings):**

```
1. Read source content (fetch_url / read_source)
2. Call list_pages to get global view of existing KB
3. Analyze source with agent → identify: what concepts does this source discuss?
4. For each potentially affected page:
   a. Call read_page to get existing content ← CRITICAL: read before write
   b. Compose augmented document (preserve headings, extend prose)
   c. Call write_page with merged frontmatter + augmented body
5. For new concepts discovered in source:
   a. Call write_page with new frontmatter (type + title + description required)
6. Update affected index files (write_index)
7. Append log entry (append_log)
8. Commit (git_commit)
```

Key behavioral rules (baked into the ingest system prompt):

- **Augment, don't rewrite.** Preserve all existing `# Heading` structure. Add new content under or alongside existing sections.
- **Cite sources.** Every claim in the body must be traceable to the source. Add URLs to `# Citations` section.
- **File-relative links only.** Cross-links use relative paths (`../topics/other.md`), never bundle-absolute (`/topics/other.md`). Rationale: works on GitHub and local filesystem.
- **Skip low-signal pages.** For web sources, skip nav pages, login pages, marketing pages, cookie notices, and anything with `overview`/`intro`/`quickstart`/`changelog`/`faq` in the slug.
- **One concept per page.** Don't dump unrelated topics into one file.
- **Concrete over generic.** Use actual names, values, and examples from the source. Don't hand-wave.

**Query flow:**

```
1. Read root index.md to understand KB structure
2. Identify relevant pages via index entries + optional text search
3. Read those pages
4. Synthesize answer with citations (links back to source pages)
5. (Optional --save) Write answer back to KB as a new page
```

**Query `--save` semantics:**

| Field | Value |
|-------|-------|
| Directory | `topics/` (configurable) |
| `type` | `Note` |
| Filename | Slugified question, deduped |
| Body | Answer text + `# Citations` section linking to source pages used |
| Cross-links | Agent adds links from each cited source page back to this note |

Duplicate detection: if a page with the same slug already exists, agent augments rather than overwrites.

**Lint flow:**

```
1. List all pages in KB
2. Read all pages (batched if > 50 pages)
3. Cross-reference check:
   - Contradictions: two pages make conflicting claims about the same concept
   - Stale claims: timestamp older than source's last update
   - Orphan pages: zero inbound links from other KB pages
   - Missing cross-references: concept mentioned but not linked
   - Index gaps: pages not listed in any index.md
4. Generate lint report (list of issues with severity: error / warning / info)
5. (Optional --fix) Agent proposes specific edits via write_page calls
```

**System prompt design (follows reference agent pattern):**

Each prompt follows this structure:
```
1. Role ("You are an ingest/query/lint agent...")
2. Workflow (step-by-step tool call sequence)
3. Frontmatter conventions (what to put in each field)
4. Body conventions (required sections, heading order)
5. Cross-linking rules (relative paths, link targets from list_pages)
6. Style rules (concrete over generic, no invented facts, valid markdown body)
```

**Model configuration:**

```typescript
// agent-config.ts
interface AgentConfig {
  defaultModel: string;         // e.g. 'claude-sonnet-4-6'
  lightweightModel: string;     // e.g. 'claude-haiku-4-5' — for lint, simple queries
  maxSteps: number;             // max tool-call rounds per operation (default: 50)
  temperature: number;          // default: 0.3
  provider: 'anthropic' | 'openai' | 'gemini';
}

// Default model assignments:
// Ingest → defaultModel (heavy — writes many pages)
// Query  → lightweightModel (reads only, unless --save)
// Lint   → lightweightModel (reads many pages, reports)
```

API keys are read from environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.) — consistent with AI SDK conventions.

**Technology:**

```typescript
import { generateText, isStepCount } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

async function runIngest(sourceUri: string, ctx: AgentContext) {
  const result = await generateText({
    model: anthropic(ctx.config.defaultModel),
    system: INGEST_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Ingest source: ${sourceUri}` }],
    tools: ctx.tools,  // all registered tools
    stopWhen: isStepCount(ctx.config.maxSteps),
  });
  return result;
}
```

**Exit criteria:**
- [ ] Ingest: given a web URL, agent produces meaningful OKF pages in target directory
- [ ] Ingest: agent augments existing pages without destroying existing content
- [ ] Query: given a question, agent finds relevant pages and answers with citations
- [ ] Query: `--save` writes answer back as a `Note` with bidirectional cross-links
- [ ] Lint: given a knowledge base, agent identifies at least contradictions and orphans
- [ ] All runners work with at least Claude and GPT models

---

### Milestone 5: CLI

**Goals:** Full CLI with git-style subcommand structure.

**Location:** `apps/cli/src/`

**Files:**
```
cli/src/
├── main.ts            # Entry point, command registration
└── commands/
    ├── init.ts        # memoss init [path]
    ├── ingest.ts      # memoss ingest <source> [--type web|file|github]
    ├── query.ts       # memoss query "<question>" [--save]
    ├── lint.ts        # memoss lint [--fix]
    ├── status.ts      # memoss status
    ├── view.ts        # memoss view
    └── serve.ts       # memoss serve [--port]
```

**Command behaviors:**

```bash
# Initialize a new knowledge base
memoss init ./my-knowledge
# → Creates directory structure:
#   .memoss/config.yaml    — KB name, model prefs, settings
#   .memoss/instructions.md — Empty template for agent behavior rules
#   index.md               — Empty root index (sections filled as pages are added)
#   log.md                 — Initialized with creation entry
#   sources/               — Empty directory for raw source materials
#   topics/                — Empty directory for concept pages
# → git init if not already a repo

# Ingest a source
memoss ingest "https://blog.example.com/data-architecture"
memoss ingest ./raw-docs/ --type files
memoss ingest owner/repo --type github
# → Agent reads source, creates/updates KB pages, commits

# Query the knowledge base
memoss query "what's our data pipeline architecture?"
memoss query "compare Snowflake vs BigQuery pricing" --save
# → Agent searches KB, synthesizes answer. --save persists answer back to KB

# Lint for health issues
memoss lint
memoss lint --fix
# → Agent scans KB, reports issues. --fix attempts to auto-resolve

# Show KB statistics
memoss status
# → Page count, link count, last ingest, last lint, git status

# Generate and open knowledge graph visualization
memoss view
# → Generates self-contained viz.html and opens in browser

# Start MCP server
memoss serve
# → Starts MCP server on stdio, other agents can connect
```

**log.md format (adopted from OKF Spec + Karpathy, parsable):**

```markdown
# Knowledge Base Activity Log

## 2026-06-23
* **Ingest**: [Data Architecture at Scale](https://example.com) — Updated [data-pipeline](/topics/data-pipeline.md), [event-sourcing](/topics/event-sourcing.md). Created [cqrs-pattern](/topics/cqrs-pattern.md).
* **Lint**: Found 2 orphan pages, 1 stale claim in [customer-360](/topics/customer-360.md).

## 2026-06-20
* **Creation**: Initialized knowledge base.
```

Format rules:
- Date headings: `## YYYY-MM-DD` (ISO 8601)
- Entries: `* **Action**: Description — Affected [Page Title](relative-path)`
- Action words: `Ingest`, `Query`, `Lint`, `Creation`, `Update`, `Deprecation`
- This format is both human-readable and `grep`-parseable

**`.memoss/config.yaml` initial schema:**

```yaml
# Memoss Knowledge Base Configuration
name: my-knowledge            # Display name
description: ""               # Optional one-liner
okf_version: "0.1"            # OKF spec version targeted

# Agent configuration
agent:
  default_model: claude-sonnet-4-6
  lightweight_model: claude-haiku-4-5
  max_steps: 50               # Max tool-call rounds per operation
  temperature: 0.3

# Git integration
git:
  enabled: true
  auto_commit: true           # Commit after each agent operation
  commit_message_template: "[memoss] {action}: {summary}"
```

**Exit criteria:**
- [ ] `memoss init` creates a valid knowledge base directory with all template files
- [ ] `memoss ingest` successfully processes a web URL end-to-end
- [ ] `memoss query` returns cited answers from existing KB
- [ ] `memoss lint` produces actionable health report
- [ ] `memoss serve` starts MCP server that external clients can connect to

---

### Milestone 6: MCP Server

**Goals:** Expose all core tools as MCP tools for consumption by external AI agents.

**Location:** `packages/mcp/src/`

**Files:**
```
mcp/src/
├── server.ts        # MCP server setup, tool registration
└── index.ts         # Entry point, server start
```

**Design:**
- stdio transport (default for `memoss serve`)
- Registers all core tools with their Zod schemas as MCP tool definitions
- Each MCP tool call delegates to the corresponding core tool implementation
- Knowledge base path is configured at server start (not exposed to clients)
- Tools exposed: all 15 core tools (read_page, write_page, list_pages, search_kb, read_index, write_index, read_log, append_log, fetch_url, read_source, list_sources, git_commit, git_diff, git_log) plus the query and lint runners

**Exit criteria:**
- [ ] MCP server starts and advertises all tools via `tools/list`
- [ ] External MCP client (e.g., Claude Desktop) can call tools and receive results
- [ ] `memoss serve` works end-to-end

---

### Milestone 7: Graph Viewer + Polish

**Goals:** Self-contained HTML knowledge graph visualization. Documentation and examples.

**Deliverables:**

1. **Graph Viewer** — Port knowledge-catalog's `viewer/` approach:
   - Walk bundle → parse all `.md` (skip `index.md`/`log.md`) → extract frontmatter + body + cross-links
   - Build `{nodes: [...], edges: [...], bodies: {...}, types: [...], palette: {...}}` data model
   - Inject into a single self-contained `viz.html` (Cytoscape.js for graph, marked.js for markdown rendering, all CSS/JS inlined)
   - Node colors mapped by `type` field, with a configurable palette per knowledge base
   - Search/filter by title, type, or tag
   - Layout options: cose (force-directed), concentric, breadthfirst, circle, grid
2. **Documentation:**
   - README.md with quickstart
   - CLI reference (`memoss help` + docs)
   - OKF Spec v1.0 as standalone `docs/okf-spec.md` (referencing the canonical spec from knowledge-catalog)
   - Connector development guide
3. **Example knowledge bases:**
   - `examples/ga4-ecommerce/` — ported from knowledge-catalog GA4 bundle (illustrates data asset documentation pattern)
   - `examples/research-topic/` — a research/reading use case (Karpathy-style ingest → wiki → lint)

**Exit criteria:**
- [ ] `memoss view` generates and opens interactive graph in browser
- [ ] Quickstart guide gets a new user from zero to first ingest in < 5 minutes
- [ ] Two example knowledge bases in the repo

---

## 3. Milestone Sequence

```
M0: Scaffold      (Week 1)
    │
M1: OKF Model     (Weeks 1-2)
    │
M2: Store + Source Adapters (Weeks 2-3)
    │
M3: Tool Registry  (Weeks 3-4)
    │
M4: Agent Engine   (Weeks 4-8)    ← longest milestone, core R&D
    │
M5: CLI            (Weeks 8-10)
    │
M6: MCP Server     (Weeks 10-11)
    │
M7: Viewer + Docs  (Weeks 11-12)
```

M1-M3 can partially overlap (they're independent). M4 depends on M1-M3 completion. M5-M7 depend on M4.

---

## 4. Technology Dependencies

| Dependency | Version | Purpose |
|-----------|---------|---------|
| `ai` | `^6` | AI SDK core (generateText, streamText, tools) |
| `@ai-sdk/anthropic` | latest | Claude provider |
| `@ai-sdk/openai` | latest | GPT provider |
| `zod` | `^3` | Tool input validation |
| `marked` | latest | Markdown rendering (viewer) |
| `front-matter` | latest | YAML frontmatter parsing |
| `simple-git` | latest | Git operations |
| `citty` | latest | CLI framework (lightweight, TypeScript-native) |
| `@modelcontextprotocol/sdk` | latest | MCP server |
| `vitest` | latest | Testing |
| `typescript` | `^5.6` | Language |

---

## 5. Design Decisions (Resolved)

These were open questions; now resolved based on analysis of the OKF Spec, knowledge-catalog reference implementation, and Karpathy's LLM Wiki pattern.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **OKF validation mode** | Dual-mode: parse permissive, write strict | OKF Spec requires only `type`; agent-authored docs benefit from requiring `title` + `description` |
| **Cross-link format** | File-relative (`../topics/other.md`) | Works on GitHub and local filesystem; matches reference agent practice |
| **log.md format** | OKF Spec date-grouped with action tags | Human-readable + grep-parseable; simpler than Karpathy's bracket format |
| **Query `--save` type** | `type: Note` in `topics/` | Generic concept type; avoids over-engineering before real usage patterns emerge |
| **Default model** | Sonnet for ingest, Haiku for query/lint | Heavy writes need stronger model; reads and scans can use lighter model |
| **Search (Phase 1)** | Index-first + simple grep | Works up to ~500 pages (Karpathy-validated); defer vector search to Phase 2 |
| **CLI framework** | `citty` (not `citra`) | `citty` is the actual npm package; `citra` was a typo in early drafts |
| **Agent prompt structure** | Role → Workflow → Frontmatter → Body → Links → Style | Matches reference agent prompt pattern; proven effective in knowledge-catalog |
| **Source abstraction** | `SourceAdapter` interface with three Phase 1 implementations | Decouples ingest from source type; enables community connectors in Phase 2 |
| **API key management** | Environment variables (`ANTHROPIC_API_KEY`, etc.) | Standard AI SDK convention; no custom config |
| **Git commit strategy** | One commit per agent operation, all files squashed | Single coherent changeset per operation; template: `[memoss] {action}: {summary}` |

---

## 6. Key References

- [OKF Spec v0.1](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) — Canonical format specification
- [knowledge-catalog reference agent](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf/src/reference_agent) — Reference implementation patterns
- [Karpathy's LLM Wiki Pattern](https://gist.githubusercontent.com/karpathy/442a6bf555914893e9891c11519de94f/raw/ac46de1ad27f92b28ac95459c782c07f6b8c964a/llm-wiki.md) — Three-layer architecture, ingest/query/lint operations
- [MCP Protocol](https://modelcontextprotocol.io/) — Model Context Protocol
- [Vercel AI SDK](https://sdk.vercel.ai/) — Agent engine foundation
