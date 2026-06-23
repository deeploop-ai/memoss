# Memoss — Phase 1 Implementation Plan

**Date:** 2026-06-23
**Duration:** 0–6 months (Phase 1a: 0–4 months · Phase 1b: 4–6 months)
**Goal:** Open-source CLI that developers adopt for personal and project knowledge management. Validate the core agent loop with trust primitives.

> See [Product Design v0.2](product-design.md) for full architecture context.  
> See [Phase 1 Technical Design](phase-1-technical-design.md) for locked stack choices, module APIs, and build/CI details.

---

## 1. Phase 1 Deliverables

### Phase 1a (Months 0–4) — Core Loop

| Package | npm Name | Content |
|---------|----------|---------|
| `packages/core` | `@memoss/core` | OKF parser, ingest/query/lint agents, tool registry, policies, interfaces + adapters |
| `apps/cli` | `@memoss/cli` | CLI: `init` / `ingest` / `query` / `lint` / `status` / `view` / `serve` / `approve` |
| `packages/mcp` | `@memoss/mcp-server` | MCP server exposing all core tools + operation runners |
| `schema-packs/` | — | `personal`, `research` templates |

### Phase 1b (Months 4–6) — Crawl, Provenance, Quality

| Addition | Content |
|----------|---------|
| `packages/core` | WebCrawlAgent, provenance module, lint health score, reference-mint policy |
| `apps/cli` | `ingest --crawl`, `ingest --interactive`, enhanced `lint` report |
| `examples/` | `research-topic/`, GA4 bundle skeleton |

> **Note:** CLI lives in `apps/` (deployable application). Core and MCP are publishable libraries in `packages/`.

---

## 2. Milestone Breakdown

### Milestone 0: Project Scaffold

**Goals:** Nx monorepo initialized, packages skeleton generated, CI running.

**Steps:**

1. Configure Nx workspace with pnpm workspaces and TypeScript project references
2. Generate projects:
   ```bash
   pnpm nx g @nx/js:lib packages/core --bundler=tsc --unitTestRunner=vitest --linter=eslint
   pnpm nx g @nx/js:lib packages/mcp --bundler=tsc --unitTestRunner=vitest --linter=eslint
   pnpm nx g @nx/js:app apps/cli --bundler=tsc --unitTestRunner=vitest --linter=eslint
   ```
3. Set up `@memoss/cli` with `bin` entry pointing to `src/main.ts`
4. Configure dependencies: `cli → core`, `mcp → core`
5. Set up GitHub Actions: lint → test → build on PR

**Exit criteria:**
- [ ] All projects build with `pnpm nx build`
- [ ] `pnpm nx test` runs across all projects
- [ ] CI pipeline green on `main`

---

### Milestone 1: OKF Document Model

**Goals:** Core OKF types, parser, serializer, validator conforming to OKF Spec v0.1.

**Location:** `packages/core/src/okf/`

**Files:**
```
okf/
├── types.ts          # OKFDocument, IndexDocument, LogEntry, ConceptRef
├── parser.ts         # Parse markdown string → OKFDocument
├── serializer.ts     # OKFDocument → markdown string
├── validator.ts      # Dual-mode: validateForRead / validateForWrite
├── index.ts          # Generate index.md from directory listing
└── paths.ts          # Concept ID ↔ file path; resolve both link forms
```

**Key types:**

```typescript
interface OKFDocument {
  frontmatter: {
    type: string;           // REQUIRED (both modes)
    title?: string;         // REQUIRED for agent writes
    description?: string;   // REQUIRED for agent writes
    resource?: string;
    tags?: string[];
    timestamp?: string;
    sources?: Array<{ source_id: string; section?: string }>;  // Phase 1b
    verified_at?: string;   // Phase 1b
    supersedes?: string;    // Phase 1b
    confidence?: 'high' | 'medium' | 'low';  // Phase 1b
    [key: string]: unknown;
  };
  body: string;
}
```

**Validation — dual-mode:**

| Mode | Required Fields | Use Case |
|------|----------------|----------|
| **Read** | `type` only | Third-party bundles, partial docs |
| **Write** | `type` + `title` + `description` | Agent-authored documents |

**Cross-link format:** **File-relative** (`../topics/other.md`) — works on GitHub, local FS, and Obsidian. Agent writes file-relative only; `paths.ts` resolves bundle-relative on read.

**Tests:** Round-trip, dual-mode validation, reserved filenames, unknown frontmatter preserved, knowledge-catalog sample bundles parse cleanly.

**Exit criteria:**
- [ ] Parse/serialize/validate passes OKF conformance
- [ ] All knowledge-catalog sample bundles parse without errors
- [ ] Validator rejects agent writes missing `title` or `description`

---

### Milestone 2: Knowledge Store + Source Adapters

**Goals:** File system abstraction for OKF files. Source abstraction for ingest.

**Location:** `packages/core/src/adapters/`

**Files:**
```
adapters/
├── fs-store.ts            # FsKnowledgeStore
├── simple-git.ts          # SimpleGitAdapter (branch, merge, commit, diff)
├── source-file.ts         # Local .md/.txt/.pdf
├── source-web.ts          # Single URL fetch → markdown
├── source-github.ts       # GitHub repo .md files
└── fetch.ts               # Raw HTTP utility
```

**GitAdapter extensions for draft workflow:**

```typescript
interface GitAdapter {
  commit(message: string): Promise<string>;
  diff(): Promise<string>;
  log(limit?: number): Promise<Commit[]>;
  isRepo(): Promise<boolean>;
  init(): Promise<void>;
  createBranch(name: string): Promise<void>;   // draft branch support
  checkout(branch: string): Promise<void>;
  merge(branch: string): Promise<void>;        // memoss approve
  deleteBranch(name: string): Promise<void>;
}
```

**Exit criteria:**
- [ ] `FsStore` reads/writes/deletes OKF files
- [ ] `SimpleGitAdapter` supports draft branch create/merge
- [ ] Three source adapters list and read items
- [ ] Graceful handling of missing files, non-git directories

---

### Milestone 3: Tool Registry + Policies

**Goals:** Agent tools with Zod schemas. Write safety policies.

**Location:** `packages/core/src/tools/` and `packages/core/src/policies/`

**Tool inventory:**
```
tools/
├── define-tool.ts
├── read_page.ts / write_page.ts / list_pages.ts / delete_page.ts
├── read_index.ts / write_index.ts
├── search_kb.ts           # grep-based Phase 1
├── read_log.ts / append_log.ts
├── fetch_url.ts           # single URL; crawl budget in Phase 1b
├── read_source.ts / list_sources.ts
├── git_commit.ts / git_diff.ts / git_log.ts
├── git_create_branch.ts / git_merge.ts   # draft workflow
└── registry.ts

policies/
├── augment.ts             # read-before-write guard
├── citation.ts            # factual claims require Citations section
└── reference-mint.ts      # four-condition Reference page rules (Phase 1b)
```

**`write_page` guard:**
- Read existing page before write
- Merge frontmatter (preserve unknown keys)
- Warn if new body < 30% length of existing
- `validateForWrite` before persist
- Write to draft branch when `draft_branch: true` in config

**Exit criteria:**
- [ ] All tools defined with Zod schemas and unit tests
- [ ] `write_page` read-before-write guard tested
- [ ] Tool registry aggregates for agent injection

---

### Milestone 4: Agent Engine (Phase 1a)

**Goals:** Ingest, Query, Lint runners with specialized prompts.

**Location:** `packages/core/src/engine/`

**Files:**
```
engine/
├── agent-config.ts
├── context.ts             # System prompt builder, tool context
├── ingest-runner.ts
├── query-runner.ts
├── lint-runner.ts
└── prompts/
    ├── ingest.md
    ├── query.md
    └── lint.md
```

**Ingest flow:**
```
1. Create/checkout draft branch
2. Read source (fetch_url / read_source)
3. list_pages → global KB view
4. Analyze → identify affected concepts
5. For each affected page: read_page → augment → write_page
6. For new concepts: write_page with required frontmatter
7. write_index at affected directories
8. append_log
9. git_commit on draft branch
10. Print diff summary; user runs memoss approve
```

**Ingest prompt rules:**
- Augment, don't rewrite
- Cite sources in `# Citations`
- File-relative links only
- Skip low-signal web pages (nav, login, marketing, changelog slugs)
- One concept per page
- Concrete over generic

**Query flow:**
```
1. read_index (root) → identify relevant pages + search_kb if needed
2. read_page for candidates
3. Synthesize with citations
4. (--save) write to notes/ as type: Note; add bidirectional links
```

**Lint flow (Phase 1a — basic):**
```
1. list_pages → read all (batched if > 50)
2. Check: contradictions, orphans, missing cross-refs, index gaps
3. Generate report (error / warning / info)
4. (--fix) propose edits on draft branch
```

**Model config:**
- Ingest → `agent.default_model`（`provider` + `model`）
- Query / Lint → `agent.lightweight_model`
- `provider`: `anthropic` | `openai`；`openai` 可配 `base_url` 对接第三方 OpenAI-compatible API
- API keys 通过 `api_key_env` 或 provider 默认 env 读取

**Exit criteria:**
- [ ] Ingest: web URL → meaningful OKF pages on draft branch
- [ ] Ingest: augments existing pages without destroying content
- [ ] Query: cited answers from existing KB
- [ ] Query `--save`: writes Note with bidirectional links
- [ ] Lint: identifies contradictions and orphans
- [ ] Works with Claude and GPT

---

### Milestone 5: CLI (Phase 1a)

**Goals:** Full CLI with git-style subcommands and draft approval workflow.

**Location:** `apps/cli/src/`

**Commands:**
```bash
memoss init [path]                    # Create vault from schema pack
memoss ingest <source> [--type web|file|github]
memoss query "<question>" [--save]
memoss lint [--fix]
memoss approve                        # Merge draft branch to main
memoss reject [--branch <name>]       # Discard draft branch
memoss status                         # Page count, links, last ops, git state
memoss view                           # Generate and open viz.html
memoss serve [--port]                 # MCP server on stdio
```

**`memoss init` creates:**
```
.memoss/config.yaml
.memoss/instructions.md       # From schema pack template
index.md
log.md
sources/
topics/
references/
notes/
```

**`.memoss/config.yaml`:**
```yaml
name: my-knowledge
description: ""
mode: wiki                     # wiki | catalog | hybrid (catalog in Phase 2)
okf_version: "0.1"
schema_pack: research          # 默认；personal | research | data-catalog

agent:
  default_model:
    provider: anthropic        # anthropic | openai
    model: claude-sonnet-4-6
  lightweight_model:
    provider: anthropic
    model: claude-haiku-4-5
  max_steps: 50
  temperature: 0.3

git:
  enabled: true
  auto_commit: true
  draft_branch: true           # Agent writes to draft; approve merges

search:
  strategy: auto               # index | grep | hybrid
  hybrid_threshold_pages: 200

provenance:
  enabled: false               # Enable in Phase 1b
  track_source_hash: false
```

**`log.md` format:**
```markdown
# Knowledge Base Activity Log

## 2026-06-23
* **Ingest**: [Data Architecture](https://example.com) — Updated [data-pipeline](topics/data-pipeline.md). Created [cqrs-pattern](topics/cqrs-pattern.md).
* **Lint**: Found 2 orphan pages.

## 2026-06-20
* **Creation**: Initialized knowledge base.
```

**Exit criteria:**
- [ ] `memoss init` creates valid vault from schema pack
- [ ] `memoss ingest` end-to-end on web URL with draft branch
- [ ] `memoss approve` merges draft to main
- [ ] `memoss query --save` persists answer
- [ ] `memoss lint` produces actionable report
- [ ] `memoss serve` starts MCP server

---

### Milestone 6: MCP Server

**Goals:** Expose core tools and operation runners via MCP.

**Location:** `packages/mcp/src/`

- stdio transport (default for `memoss serve`)
- All core tools + `run_ingest`, `run_query`, `run_lint` runners
- Vault path configured at server start

**Exit criteria:**
- [ ] MCP `tools/list` advertises all tools
- [ ] Claude Desktop (or equivalent) can call tools end-to-end

---

### Milestone 7: Graph Viewer + Docs (Phase 1a)

**Goals:** Self-contained graph visualization. Quickstart documentation.

**Deliverables:**
1. **Graph Viewer** — Port knowledge-catalog `viewer/` approach:
   - Walk vault → parse `.md` (skip `index.md`/`log.md`) → extract frontmatter + links
   - Build `{nodes, edges, bodies, types, palette}` → inject into `viz.html`
   - Cytoscape.js + marked.js inlined; node colors by `type`
2. **Documentation:**
   - README quickstart
   - CLI reference
   - `docs/okf-spec.md` (canonical OKF reference)
3. **Schema packs:** `schema-packs/personal/`, `schema-packs/research/`

**Exit criteria:**
- [ ] `memoss view` opens interactive graph
- [ ] Quickstart: zero to first ingest in < 5 minutes
- [ ] Two schema packs available

---

### Milestone 8: Web Crawl + Interactive Ingest (Phase 1b)

**Goals:** knowledge-catalog-grade web ingestion. Karpathy interactive workflow.

**Location:** `packages/core/src/engine/`

**New files:**
```
engine/
├── web-crawl-runner.ts
└── prompts/
    └── web-crawl.md          # Port web_ingestion_instruction.md rules

policies/
└── reference-mint.ts         # Four-condition Reference creation
```

**Web crawl ingest:**
```bash
memoss ingest --crawl --seeds "https://docs.example.com" --max-pages 20 [--hosts docs.example.com]
```

- `fetch_url` enforces `max_pages` budget
- Agent follows links with judgment filter (skip nav, marketing, meta pages)
- Reference minting via `reference-mint.ts` policy

**Interactive ingest:**
```bash
memoss ingest <source> --interactive
```
- Agent presents key takeaways before writing
- User can steer emphasis in follow-up messages
- Then proceeds to draft-branch write flow

**Exit criteria:**
- [ ] Crawl from seed URLs enriches existing concepts without noise reference pages
- [ ] Interactive mode shows summary before write
- [ ] Reference pages created only when four conditions met

---

### Milestone 9: Provenance + Lint Health Score (Phase 1b)

**Goals:** Source registry, page-level provenance, staleness-aware lint.

**Location:** `packages/core/src/provenance/`

**Files:**
```
provenance/
├── manifest.ts              # sources/manifest.yaml read/write
├── hash.ts                  # content_hash computation
└── registry.ts              # source_id → affects pages mapping
```

**`sources/manifest.yaml`:**
```yaml
sources:
  - id: data-architecture-blog
    uri: https://example.com/data-architecture
    fetched_at: 2026-06-23T10:00:00Z
    content_hash: sha256:abc123
    ingested_at: 2026-06-23T10:05:00Z
    affects:
      - topics/data-pipeline.md
```

**Lint extensions:**
- Stale: `verified_at` older than source `content_hash` change → warning
- Missing citations on factual claims → error
- Output `lint-report.json` + `health_score` (0–100)

**Config:** `provenance.enabled: true` in `.memoss/config.yaml`

**Exit criteria:**
- [ ] Ingest updates manifest with content hash
- [ ] Agent writes `sources` + `verified_at` in frontmatter
- [ ] Lint detects stale pages when source re-ingested with new hash
- [ ] `health_score` computed and displayed in `memoss lint` output

---

### Milestone 10: Examples + Polish (Phase 1b)

**Goals:** Reference knowledge bases demonstrating both source patterns.

**Deliverables:**
1. `examples/research-topic/` — Karpathy-style wiki (ingest articles → query → lint)
2. `examples/ga4-ecommerce/` — Skeleton ported from knowledge-catalog GA4 bundle
3. `docs/mac-bridge.md` — Stub pointing to Phase 2 catalog-bridge work

**Exit criteria:**
- [ ] Both examples ingest and query successfully
- [ ] GA4 example demonstrates data/ + references/ layout

---

## 3. Milestone Sequence

```
Phase 1a (Months 0–4)
─────────────────────
M0: Scaffold           (Week 1)
M1: OKF Model          (Weeks 1–2)
M2: Store + Adapters   (Weeks 2–3)
M3: Tools + Policies   (Weeks 3–4)
M4: Agent Engine       (Weeks 4–8)    ← core R&D
M5: CLI                (Weeks 8–10)
M6: MCP Server         (Weeks 10–11)
M7: Viewer + Docs      (Weeks 11–14)

Phase 1b (Months 4–6)
─────────────────────
M8: Web Crawl + Interactive Ingest  (Weeks 14–18)
M9: Provenance + Lint Health      (Weeks 18–22)
M10: Examples + Polish            (Weeks 22–24)
```

M1–M3 can partially overlap. M4 depends on M1–M3. M5–M7 depend on M4. M8–M10 depend on M7.

---

## 4. Technology Dependencies

> Full rationale, rejected alternatives, and version pins: [Phase 1 Technical Design §12](phase-1-technical-design.md#12-dependency-manifest).

| Dependency | Version | Purpose |
|-----------|---------|---------|
| `ai` | `^6` | AI SDK core |
| `@ai-sdk/anthropic` | `^2` | Claude provider |
| `@ai-sdk/openai` | `^2` | GPT provider |
| `zod` | `^3.24` | Tool input validation |
| `yaml` | `^2.8` | OKF frontmatter + config (custom parser) |
| `simple-git` | `^3.27` | Git operations including branches |
| `linkedom` + `@mozilla/readability` + `turndown` | latest | HTML → Markdown pipeline |
| `pdf-parse` | `^1.1` | PDF text extraction |
| `@octokit/rest` | `^21` | GitHub source adapter |
| `fast-glob` | `^3.3` | KB grep search |
| `citty` + `consola` | latest | CLI framework + logging |
| `@clack/prompts` | `^0.9` | Interactive ingest (Phase 1b) |
| `@modelcontextprotocol/sdk` | `^1.12` | MCP server |
| `vitest` | `^4.1` | Testing |
| `typescript` | `^5.9` | Language |

---

## 5. Design Decisions (Resolved)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **OKF validation** | Dual-mode: read permissive, write strict | OKF Spec requires only `type`; agent docs need `title` + `description` |
| **Cross-link format** | File-relative | GitHub, local FS, Obsidian compatible; matches reference agent |
| **log.md format** | OKF Spec date-grouped with action tags | Human-readable + grep-parseable |
| **Query `--save`** | `type: Note` in `notes/` | Generic; explorations compound without over-typing |
| **Default models** | Sonnet ingest, Haiku query/lint; explicit `provider` per model | 支持第三方 OpenAI-compatible API；禁止从模型名猜测 provider |
| **Default schema pack** | `research` | 与 quickstart、技术文章 ingest 场景一致 |
| **Search Phase 1** | Index-first + grep | Karpathy-validated to ~200 pages |
| **Draft workflow** | Agent writes draft branch; `memoss approve` merges | Trust primitive from day one |
| **Reference pages** | Four-condition minting (Phase 1b) | knowledge-catalog web agent proven rules |
| **Provenance** | `sources/manifest.yaml` + frontmatter (Phase 1b) | Enables staleness-aware lint |
| **Git commit** | One commit per approved operation | Coherent changeset per action |
| **Agent structure** | Specialized runners + dedicated prompts | knowledge-catalog reference agent pattern |
| **Schema packs** | `personal`, `research` in Phase 1a | Solves Karpathy cold-start problem |

---

## 6. Explicitly Deferred to Phase 2

| Item | Phase |
|------|-------|
| `@memoss/catalog-bridge` (MaC sync) | 2a |
| `memoss enrich` | 2a |
| `memoss discover` | 2b |
| `memoss publish` / `memoss bridge` | 2a |
| `memoss sync` | 2a |
| Hybrid vector search (`@memoss/search`) | 2b |
| Desktop / Web UI | 2b |
| BigQuery, Snowflake, dbt connectors | 2a |
| Query `--format marp` | 2b |

---

## 7. Key References

- [Product Design v0.2](product-design.md)
- [OKF Spec v0.1](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
- [knowledge-catalog reference agent](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf/src/reference_agent)
- [knowledge-catalog web ingestion prompt](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/src/reference_agent/prompts/web_ingestion_instruction.md)
- [knowledge-catalog mdcode](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/toolbox/mdcode)
- [Karpathy LLM Wiki Pattern](https://gist.githubusercontent.com/karpathy/442a6bf555914893e9891c11519de94f/raw/ac46de1ad27f92b28ac95459c782c07f6b8c964a/llm-wiki.md)
- [MCP Protocol](https://modelcontextprotocol.io/)
- [Vercel AI SDK](https://sdk.vercel.ai/)
