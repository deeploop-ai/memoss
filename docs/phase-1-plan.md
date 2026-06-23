# Memoss — Phase 1 Implementation Plan

**Date:** 2026-06-23
**Duration:** 0–6 months
**Goal:** Open-source CLI that developers adopt for personal and project knowledge management. Validate the core agent loop.

---

## 1. Phase 1 Deliverables (Recap)

| Package | npm Name | Content |
|---------|----------|---------|
| `packages/core` | `@memoss/core` | OKF parser, agent engine, tool registry, interfaces + adapters |
| `packages/cli` | `@memoss/cli` | CLI with `init` / `ingest` / `query` / `lint` / `status` / `view` / `serve` |
| `packages/mcp` | `@memoss/mcp-server` | MCP server exposing all core tools |

---

## 2. Milestone Breakdown

### Milestone 0: Project Scaffold

**Goals:** Nx monorepo initialized, packages skeleton generated, CI running.

**Steps:**

1. `pnpm create nx-workspace memoss --template nrwl/typescript-template`
2. Configure root `tsconfig.base.json` with strict mode and path aliases
3. Generate packages:
   ```bash
   nx g @nx/js:lib packages/core --bundler=tsc --unitTestRunner=vitest --linter=eslint
   nx g @nx/js:lib packages/cli --bundler=tsc --unitTestRunner=vitest --linter=eslint
   nx g @nx/js:lib packages/mcp --bundler=tsc --unitTestRunner=vitest --linter=eslint
   ```
4. Set up `@memoss/cli` as a `package` type (publishable) with `bin` entry pointing to `src/main.ts`
5. Configure inter-package dependencies: `cli → core`, `mcp → core`
6. Set up GitHub Actions: lint → test → build on PR

**Exit criteria:**
- [ ] Three packages build successfully with `nx build`
- [ ] `nx test` runs across all packages (even if no tests yet)
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
├── validator.ts      # Validate conformance (required fields, reserved names)
├── index.ts          # Generate index.md from directory listing
└── paths.ts          # Concept ID ↔ file path conversion
```

**Key types:**
```typescript
interface OKFDocument {
  frontmatter: {
    type: string;           // REQUIRED
    title?: string;
    description?: string;
    resource?: string;
    tags?: string[];
    timestamp?: string;     // ISO 8601
    [key: string]: unknown; // extensions
  };
  body: string;             // Markdown content
}

interface IndexDocument {
  sections: Array<{
    heading: string;
    entries: Array<{
      title: string;
      url: string;
      description?: string;
    }>;
  }>;
}
```

**Tests:** Parse round-trip, frontmatter extraction, required field validation, reserved filename detection, edge cases (empty body, missing optional fields).

**Exit criteria:**
- [ ] Parse/serialize/validate passes OKF Spec conformance tests
- [ ] Round-trip test: `serialize(parse(file)) === file`
- [ ] All knowledge-catalog sample bundles parse without errors

---

### Milestone 2: Knowledge Store Adapters

**Goals:** File system abstraction that reads/writes OKF files on disk.

**Location:** `packages/core/src/adapters/`

**Files:**
```
adapters/
├── fs-store.ts      # FsKnowledgeStore implements KnowledgeStore
├── simple-git.ts    # SimpleGitAdapter implements GitAdapter
└── fetch.ts         # FetchAdapter implements SourceFetcher
```

**Interfaces** (in `packages/core/src/interfaces/`):
```typescript
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

interface GitAdapter {
  commit(message: string): Promise<string>;    // returns commit hash
  diff(): Promise<string>;
  log(limit?: number): Promise<Commit[]>;
  isRepo(): Promise<boolean>;
  init(): Promise<void>;
}
```

**Exit criteria:**
- [ ] `FsStore` correctly reads/writes OKF files on disk
- [ ] `SimpleGitAdapter` commits, diffs, reads log
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
├── write_page.ts         # Write an OKF page
├── list_pages.ts         # List pages in knowledge base
├── read_index.ts         # Read index.md at a directory
├── write_index.ts        # Write/replace index.md
├── search_kb.ts          # Full-text search across knowledge base
├── read_log.ts           # Read activity log
├── append_log.ts         # Append to activity log
├── fetch_url.ts          # Fetch URL → markdown
├── read_source.ts        # Read a raw source file
├── list_sources.ts       # List sources/ directory
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

**Exit criteria:**
- [ ] All 15 tools defined with Zod schemas
- [ ] Each tool has unit tests for execution and input validation
- [ ] Tool registry aggregates all tools for injection into agent

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

**Ingest flow:**
```
1. Load source (fetch_url / read_source)
2. Read source content → analyze with agent
3. Agent identifies: what concepts does this source discuss?
4. Agent reads existing KB pages that might be affected (via list_pages + read_page)
5. Agent writes/updates N pages (write_page for each)
6. Agent updates affected index files (write_index)
7. Agent writes log entry (append_log)
8. Agent commits (git_commit)
```

**Query flow:**
```
1. Read root index.md to understand KB structure
2. Identify relevant pages via index entries
3. Read those pages
4. Synthesize answer with citations
5. (Optional) User asks to persist answer → write_page back to KB
```

**Lint flow:**
```
1. List all pages in KB
2. Read all pages (in batches if needed)
3. Cross-reference: find contradictions, stale claims, orphans, missing links
4. Generate lint report (list of issues with severity)
5. (Optional --fix) Agent proposes specific edits to resolve issues
```

**Technology:**
```typescript
import { generateText, isStepCount } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

async function runIngest(sourceUri: string, ctx: AgentContext) {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    system: INGEST_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Ingest: ${sourceUri}` }],
    tools: ctx.tools,  // all registered tools
    stopWhen: isStepCount(50),      // max 50 tool call rounds
  });
  return result;
}
```

**Exit criteria:**
- [ ] Ingest: given a web URL, agent produces meaningful OKF pages in target directory
- [ ] Query: given a question, agent finds relevant pages and answers with citations
- [ ] Lint: given a knowledge base, agent identifies at least contradictions and orphans
- [ ] All runners work with at least Claude and GPT models

---

### Milestone 5: CLI

**Goals:** Full CLI with git-style subcommand structure.

**Location:** `packages/cli/src/`

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
# → Creates directory structure, .memoss/config.yaml, initial index.md + log.md
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

**Exit criteria:**
- [ ] `memoss init` creates a valid knowledge base directory
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

**Exit criteria:**
- [ ] MCP server starts and advertises all tools via `tools/list`
- [ ] External MCP client (e.g., Claude Desktop) can call tools and receive results
- [ ] `memoss serve` works end-to-end

---

### Milestone 7: Graph Viewer + Polish

**Goals:** Self-contained HTML knowledge graph visualization. Documentation and examples.

**Deliverables:**

1. **Graph Viewer** — Port/adapt knowledge-catalog's `viewer/` (Cytoscape.js + marked.js) to generate `viz.html` from any OKF bundle
2. **Documentation:**
   - README.md with quickstart
   - CLI reference (`memoss help` + docs)
   - OKF Spec v1.0 as standalone `docs/okf-spec.md`
   - Connector development guide
3. **Example knowledge bases:**
   - `examples/ga4-ecommerce/` — ported from knowledge-catalog GA4 bundle
   - `examples/research-topic/` — a research/reading use case (Karpathy-style)

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
M2: Store Adapters (Weeks 2-3)
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
| `citra` | latest | CLI framework |
| `@modelcontextprotocol/sdk` | latest | MCP server |
| `vitest` | latest | Testing |
| `typescript` | `^5.6` | Language |

---

## 5. Open Questions

- [ ] **Search implementation for Query runner.** Simple text search (`grep`-like) works for < 500 pages. When do we introduce vector search? Decision: start with simple text search + optional `qmd` integration for hybrid BM25/vector.
- [ ] **Model pricing / default model.** Which model is the default? Recommendation: Claude Haiku 4.5 for lightweight ops (lint, simple query), Claude Sonnet 4.6 for heavy ops (ingest). User can override.
- [ ] **Agent operation costs.** A single ingest of one web page might use 20-50 tool call rounds. At Sonnet pricing, that's roughly $0.50–$2.00 per ingest. Need to communicate this clearly in CLI output.
