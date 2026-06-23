# Memoss — Product Design Document

**Version:** 0.1 — Draft
**Date:** 2026-06-23

---

## Table of Contents

1. [Product Vision & Positioning](#1-product-vision--positioning)
2. [Core Insights — The Convergence](#2-core-insights--the-convergence)
3. [Three-Layer Open Strategy](#3-three-layer-open-strategy)
4. [Product Architecture](#4-product-architecture)
5. [Core Operations Model](#5-core-operations-model)
6. [Technical Architecture](#6-technical-architecture)
7. [Three-Phase Roadmap](#7-three-phase-roadmap)
8. [Competitive Landscape](#8-competitive-landscape)
9. [Business Model](#9-business-model)
10. [Key Risks & Mitigations](#10-key-risks--mitigations)

---

## 1. Product Vision & Positioning

### One-liner

**Memoss is an AI-native knowledge infrastructure — your file system *is* your knowledge base, and agents do the reading, writing, maintenance, and cross-referencing.**

### Positioning Statement

For AI agent developers, data engineers, and knowledge workers who need their data and documents to be understood by both humans and AI, Memoss is an open knowledge infrastructure that treats **markdown files as the universal knowledge format** and **LLM agents as the maintainers**. Unlike traditional data catalogs (Alation, Collibra) that require manual curation, or wiki tools (Notion, Confluence) where knowledge goes stale, Memoss agents continuously ingest, enrich, cross-link, lint, and refresh knowledge — making it a **living, trustworthy, agent-consumable asset**.

### What We Are NOT

- **NOT a database** — we don't store your data, we store *knowledge about* your data
- **NOT a wiki editor** — humans curate and direct; agents do the writing
- **NOT a vector database** — the file system is the storage layer; search is layered on top when needed
- **NOT Google Cloud only** — vendor-neutral, works with any infrastructure

### The Category We're Defining

"**Agent-Native Knowledge Infrastructure**" — a category that sits at the intersection of:

```
Data Catalogs          Wiki / Knowledge Bases        AI Agent Tools
(Alation, Atlan)       (Notion, Obsidian)            (LangChain, LlamaIndex)
        \                     |                         /
         \                    |                        /
          ┌───────────────────┴──────────────────────┐
          │     Agent-Native Knowledge Infrastructure  │
          │                 (Memoss)                    │
          └──────────────────────────────────────────┘
```

---

## 2. Core Insights — The Convergence

This product design is informed by two independent sources that converged on the same architecture:

### Source A: Google knowledge-catalog

- **Origin:** Google Cloud Platform / Dataplex team
- **Scope:** Enterprise data catalog + metadata management
- **Core Innovations:**
  - **OKF (Open Knowledge Format)** — Markdown + YAML frontmatter as a standardized knowledge representation
  - **Metadata as Code** — Git-native, bi-directional sync with cloud catalog services
  - **Agent-Driven Enrichment** — LLM agents that crawl schemas, web docs, and query logs to auto-generate documentation
  - **MCP-First Architecture** — Catalog operations exposed as MCP tools for any agent framework
  - **Semantic Discovery** — Query decomposition + parallel search + merge/rerank

### Source B: Karpathy's LLM Wiki Pattern

- **Origin:** Andrej Karpathy (independent)
- **Scope:** Personal/universal knowledge management
- **Core Innovations:**
  - **Three-Layer Architecture** — Raw sources (immutable) → Wiki (agent-maintained) → Schema (instructions)
  - **Operations Model** — Ingest (process one source → update N pages) / Query (search + synthesize) / Lint (health check: contradictions, staleness, orphans)
  - **Agent as Author** — "You read it; the LLM writes it"
  - **Query → File back** — Good answers get filed back into the wiki so explorations compound
  - **Schema Co-Evolution** — User and agent refine the maintenance rules together over time

### The Convergence

| Design Element | knowledge-catalog | Karpathy LLM Wiki |
|----------------|-------------------|-------------------|
| Knowledge format | OKF (Markdown + YAML frontmatter) | Markdown wiki files |
| Reserved files | `index.md` + `log.md` | `index.md` + `log.md` |
| Maintainer | AI enrichment agent | LLM agent |
| Cross-linking | Markdown links = knowledge graph | "Links as valuable as documents" |
| Progressive disclosure | Index files for agent navigation | Index-first retrieval |
| Three-layer model | Sources → OKF bundle → catalog.yaml | Raw → Wiki → Schema |
| Core operations | Enrich / Discover / Sync | Ingest / Query / Lint |
| Version control | Git-native | Git |
| Agent interface | MCP server | MCP server (qmd) |
| Visualization | Force-directed graph | Obsidian graph view |

**This is not coincidence.** Two independent efforts — one enterprise, one personal — arrived at the same architecture. The market is not yet defined, but the pattern is validated. Memoss is the productization of this convergent design.

---

## 3. Three-Layer Open Strategy

We pursue a **layered openness** model, where each layer has a different strategy tailored to its role in creating defensibility:

```
┌──────────────────────────────────────────────────────┐
│                                                    │
│           COMMERCIAL CLOUD SERVICE (SaaS)            │
│                                                    │
│   Hosted agents  ·  Team collaboration  ·  RBAC      │
│   Audit logs  ·  SSO  ·  Knowledge Bundle Market     │
│   Advanced AI  ·  Usage analytics  ·  SLA            │
│                                                    │
│   Revenue: subscription (per knowledge base + usage) │
│                                                    │
├──────────────────────────────────────────────────────┤
│                                                    │
│           OPEN-SOURCE ENGINE (Apache 2.0)            │
│                                                    │
│   Agent runtime  ·  Source connectors  ·  CLI         │
│   MCP server  ·  Core ops (ingest/query/lint)        │
│   Index/search  ·  Graph visualization  ·  Sync      │
│                                                    │
│   Revenue: none (community adoption driver)          │
│                                                    │
├──────────────────────────────────────────────────────┤
│                                                    │
│           OPEN FORMAT SPEC (OKF, Public Standard)    │
│                                                    │
│   Markdown + YAML frontmatter conventions             │
│   Bundle structure  ·  Cross-linking  ·  Index/log   │
│   Citation format  ·  Conformance rules              │
│                                                    │
│   Revenue: none (pursue industry standardization)    │
│                                                    │
└──────────────────────────────────────────────────────┘
```

### Layer 1: OKF — Open Format (Pursue Standardization)

- **Goal:** Make OKF the "Markdown of AI knowledge" — universally understood, freely implementable
- **Strategy:** Public specification, no patents, encourage third-party implementations
- **Success metric:** Third-party tools and platforms natively support OKF import/export
- **Danger to avoid:** Trying to own the format. We compete on *best implementation*, not format lock-in

### Layer 2: Open-Source Engine (Build Community)

- **Goal:** Maximum adoption among developers; community-contributed connectors; de facto reference implementation
- **License:** Apache 2.0 (permissive, enterprise-friendly)
- **Strategy:** Make the single-machine workflow excellent. If it works great for one person, it'll spread to teams
- **Success metric:** GitHub stars, community connectors, CLI downloads, Discord members

### Layer 3: Commercial Cloud (Capture Value)

- **Goal:** Revenue from teams/enterprises that want managed infrastructure, collaboration, and advanced AI
- **Strategy:** Compete on convenience, not lock-in. Data is always exportable as OKF files. Cloud adds collaboration, scale, and intelligence
- **Moat:** Not the code — the data flywheel, the knowledge bundle network effects, and the integration depth

---

## 4. Product Architecture

### 4.1 System Overview

```
                          ┌─────────────────────┐
                          │   Consumption Layer   │
                          │                     │
                          │  ┌──────┐ ┌───────┐ │
                          │  │ Web  │ │  IDE  │ │
                          │  │  UI  │ │Plugin │ │
                          │  └──────┘ └───────┘ │
                          │  ┌──────┐ ┌───────┐ │
                          │  │ MCP  │ │ REST  │ │
                          │  │Server│ │  API  │ │
                          │  └──────┘ └───────┘ │
                          └──────────┬──────────┘
                                     │
                          ┌──────────┴──────────┐
                          │    Agent Engine      │
                          │                     │
                          │  Ingest  ·  Query   │
                          │  Lint   ·  Enrich   │
                          │  Sync   ·  Publish  │
                          └──────────┬──────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
              ┌─────┴─────┐  ┌──────┴──────┐  ┌─────┴─────┐
              │  Sources   │  │  Knowledge  │  │   Schema  │
              │ (immutable)│  │    Store    │  │  (config) │
              │            │  │  (OKF files)│  │           │
              └────────────┘  └─────────────┘  └───────────┘
```

### 4.2 Core Components

#### A. Knowledge Store

The heart of the system. A directory tree of OKF markdown files on disk.

```
my-knowledge/
├── index.md                    # Top-level catalog of all pages
├── log.md                      # Chronological activity record
├── .memoss/                    # Agent configuration (schema layer)
│   ├── config.yaml             # Knowledge base metadata + settings
│   ├── instructions.md         # Agent behavior rules (co-evolves)
│   └── connectors.yaml         # Source connector configurations
├── sources/                    # Raw source materials (immutable)
│   └── ...
├── topics/                     # Concept/entity pages
│   ├── index.md
│   ├── customer-360.md
│   └── ...
├── data/                       # Data asset documentation
│   ├── index.md
│   ├── tables/
│   │   ├── index.md
│   │   └── orders.md
│   └── metrics/
│       ├── index.md
│       └── revenue.md
└── references/                 # External reference material
    ├── index.md
    └── ...
```

- Every `.md` file (except `index.md` and `log.md`) has YAML frontmatter with at minimum a `type` field
- Cross-links between concepts create a navigable knowledge graph
- Git provides version history, branching, and collaboration

#### B. Sources Layer

Immutable raw materials that agents read from but never modify.

| Connector Type | Examples |
|----------------|----------|
| Database schemas | BigQuery, Snowflake, PostgreSQL, MySQL |
| Documentation | Web pages, Markdown files, PDFs, Confluence |
| Code | GitHub repos, dbt projects, SQL files |
| Communication | Slack threads, meeting transcripts, emails |
| APIs | REST endpoints, GraphQL schemas, OpenAPI specs |

#### C. Agent Engine

The core runtime that powers all knowledge operations. Model-agnostic (supports Claude, GPT, Gemini, open-source models via LiteLLM or similar).

**Sub-components:**

- **Orchestrator** — Manages agent sessions, tool dispatch, context windows, rate limits
- **Tool Registry** — Pluggable tools: read/write files, search, fetch URLs, query databases, call APIs
- **Source Adapter Framework** — Standardized interface for connecting new data sources
- **Schema Engine** — Parses and applies the user's `instructions.md` rules to guide agent behavior

#### D. Consumption Layer

Multiple interfaces to access and interact with the knowledge base:

| Interface | Purpose |
|-----------|---------|
| **CLI** (`llmi`) | Primary developer interface: `llmi ingest`, `llmi query`, `llmi lint` |
| **MCP Server** | Standard protocol for AI agents to read/write/lint knowledge |
| **Web UI** | Browse knowledge graph, review agent changes, visualize relationships |
| **IDE Plugin** | VS Code / JetBrains integration — knowledge alongside code |
| **REST API** | Programmatic access for custom integrations |

### 4.3 Design Principles

1. **File system is the database.** No proprietary storage. Everything is markdown files. You can `cat`, `grep`, `git diff` your knowledge.
2. **Agent writes, human curates.** The agent does the bookkeeping; the human provides judgment, direction, and verification.
3. **Progressive disclosure.** Index files at every level let agents and humans navigate without loading everything into context.
4. **Links are first-class.** The graph of cross-references is as important as individual documents. Cross-links use **file-relative paths** (`../topics/other.md`) so they resolve correctly on GitHub, local filesystems, and any markdown renderer — not bundle-relative paths (`/topics/other.md`) which break outside of OKF-aware tooling.
5. **Everything is a source.** Data schemas, web pages, code, conversations — all are raw material for knowledge extraction. Sources implement a common `SourceAdapter` interface, enabling community-contributed connectors.
6. **MCP-first.** Every capability is exposed as an MCP tool. If you can't use it from an agent, it doesn't exist.

---

## 5. Core Operations Model

The system supports six core operations. The first three are from Karpathy's pattern; the next three are from knowledge-catalog.

### 5.1 Ingest

> Add a new source, let the agent extract and integrate knowledge.

**Flow:**
```
User drops source → Agent reads source → Agent discusses takeaways with user
→ Agent writes summary page → Agent updates index.md → Agent updates affected pages
(all cross-referenced concepts) → Agent logs the entry in log.md
```

**Key behavior:**
- One source can update 10-15 existing pages (cross-referencing is the value)
- Agent preserves existing content, augments rather than overwrites
- Sources are immutable — the agent reads from them, never modifies them
- Supports batch ingestion and single-source interactive ingestion

**Implementation priority: Phase 1**

### 5.2 Query

> Ask questions against the knowledge base, get cited answers.

**Flow:**
```
User asks question → Agent reads index.md → Agent identifies relevant pages
→ Agent reads those pages → Agent synthesizes answer with citations
→ (Optional) User asks agent to file the answer back as a new page
```

**Key behavior:**
- Index-first retrieval works well up to hundreds of pages (as validated by Karpathy)
- Beyond that, hybrid BM25 + vector search with LLM reranking
- Answers can be filed back as new knowledge pages — "explorations compound"
- Multiple output formats: markdown, comparison tables, slide decks (Marp), charts

**Implementation priority: Phase 1**

### 5.3 Lint

> Proactive knowledge base health checks by the agent.

**Flow:**
```
Agent scans wiki → Finds: contradictions between pages, claims superseded by newer sources,
orphan pages (no inbound links), important concepts missing dedicated pages,
missing cross-references, data gaps → Reports findings → (Optional) Agent fixes them
```

**Key behavior:**
- Periodic (scheduled) or on-demand
- Agent proposes fixes, user approves or rejects
- This is what keeps the knowledge base *alive* — the "zero maintenance cost" property Karpathy describes

**Implementation priority: Phase 1 (basic), Phase 2 (advanced with automated fixes)**

### 5.4 Enrich

> Deep, structured enrichment of specific data assets using multiple sources.

**Flow:**
```
Agent targets a specific data asset (e.g., a BigQuery table) → Agent reads schema,
samples data, searches documentation, finds related code → Agent generates structured
documentation: schema, common queries, join patterns, business context, lineage
```

**Key behavior:**
- Distinct from Ingest — Ingest is general, Enrich is domain-specific and structured
- Two-pass approach: deterministic extraction (schema) → LLM-driven augmentation (context)
- Strict augmentation rules: never overwrite real metadata with hallucinated content
- This is the knowledge-catalog reference agent pattern, generalized

**Implementation priority: Phase 2**

### 5.5 Sync

> Bi-directional synchronization between local OKF files and external systems.

**Flow:**
```
Local OKF files ←→ External System (data catalog, wiki, documentation platform)
  - Pull: download metadata from external system, convert to OKF format
  - Push: publish enriched OKF content back to external system
```

**Key behavior:**
- Based on knowledge-catalog's Metadata as Code pattern
- Configured via `catalog.yaml` (what to sync, what types, what aspects)
- Supports conflict detection and resolution
- Enables CI/CD integration: agent enriches → human reviews PR → merge → auto-push

**Implementation priority: Phase 2 (BigQuery), Phase 3 (multi-system)**

### 5.6 Publish

> Package knowledge into shareable, self-contained bundles.

**Flow:**
```
User selects a subset of the knowledge base → Agent generates a self-contained OKF bundle
→ Bundle includes all cross-referenced concepts, index files, and a self-contained
interactive graph visualization (viz.html)
```

**Key behavior:**
- Produces a portable directory that can be shared, versioned, and consumed independently
- Includes a zero-dependency HTML viewer for non-technical consumers
- Enables a "Knowledge Bundle Market" in Phase 3

**Implementation priority: Phase 2**

---

## 6. Technical Architecture

### 6.1 Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Monorepo** | Nx with TypeScript project references + pnpm workspaces | Industry standard for TS monorepos; generators for package scaffolding; build caching |
| **Agent Engine** | Vercel AI SDK (`ai` + `@ai-sdk/anthropic` + `@ai-sdk/openai`) | Multi-provider, type-safe tool calling, multi-step agent loop via `stopWhen`/`isStepCount` |
| **Tool Schema** | Zod | Type-safe input validation, integrates natively with AI SDK |
| **Markdown** | `marked` + `front-matter` | Parse OKF files (YAML frontmatter + Markdown body) |
| **CLI Framework** | `citty` | Lightweight, TypeScript-native, git-style subcommands |
| **Git** | `simple-git` | Git operations from Node.js |
| **MCP** | `@modelcontextprotocol/sdk` | MCP server implementation |
| **Packages** | - | - |
| **Bundler** | `tsc` (Nx default, per-package) | Build publishable packages; Phase 2 may migrate to `tsup` for speed |
| **Testing** | `vitest` | Vite-native, fast, compatible with Nx |
| **Linting** | `eslint` (Nx default config) | - |

### 6.2 Architecture Decision: AI SDK + eve-Aligned Structure

We evaluated two approaches for the agent engine:

- **Vercel AI SDK** — lower-level toolkit: `generateText` + tools + multi-step loop. Full control over the agent loop.
- **Vercel eve** — higher-level agent framework launched June 2026. "An agent is a directory." Durable execution, MCP connections, channels, sandboxing.

**Decision:** Use AI SDK directly for Phase 1, while aligning Memoss's directory conventions with eve's file structure.

**Rationale:**
- eve is 6 days old (launched June 17, 2026) — API stability unknown, too risky for Phase 1 foundation
- Phase 1 only needs the core agent loop (ingest/query/lint) which AI SDK handles well
- eve's filesystem-first philosophy ("tools are files") is correct and aligned with Memoss's design
- By structuring our tools and instructions following eve conventions, migration path to eve remains open when it matures (Phase 2+)

### 6.3 Package Structure (Nx Monorepo)

- `apps/` — 可部署应用（CLI 入口、Web UI、Desktop 壳）
- `packages/` — 可复用库（核心引擎、MCP 服务端等）

```
memoss/
├── nx.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── package.json                  # root workspace
│
├── apps/
│   ├── cli/                      # @memoss/cli (Phase 1) ✅ created
│   │   ├── src/
│   │   │   ├── commands/        # init, ingest, query, lint, status, view, serve
│   │   │   └── main.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── project.json
│   │
│   ├── web/                      # @memoss/web (Phase 2)
│   │   │                         # Next.js App — Desktop renderer + future hosted platform
│   │   └── ...
│   │
│   └── desktop/                  # @memoss/desktop (Phase 2)
│       │                         # Electron wrapper: main process runs core, renderer runs web
│       └── ...
│
├── packages/
│   ├── core/                     # @memoss/core (Phase 1)
│   │   ├── src/
│   │   │   ├── okf/             # OKFDocument, parse/serialize/validate
│   │   │   ├── engine/          # IngestRunner, QueryRunner, LintRunner
│   │   │   ├── tools/           # Tool definitions (Zod + execute)
│   │   │   ├── interfaces/      # KnowledgeStore, GitAdapter, SourceFetcher
│   │   │   ├── adapters/        # FsStore, SimpleGitAdapter, FetchAdapter
│   │   │   └── index.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── project.json         # Nx project config
│   │
│   └── mcp/                      # @memoss/mcp-server (Phase 1)
│       ├── src/
│       │   ├── server.ts        # MCP server exposing core tools
│       │   └── index.ts
│       ├── package.json
│       ├── tsconfig.json
│       └── project.json
│
├── docs/
│   └── product-design.md
│
└── examples/                     # Example knowledge bases
```

### 6.4 Core Abstractions (Platform-Agnostic)

To support CLI → Desktop → Web without rewriting, `@memoss/core` defines interfaces that each platform implements:

```typescript
interface KnowledgeStore {
  readPage(path: string): Promise<OKFDocument>;
  writePage(path: string, doc: OKFDocument): Promise<void>;
  listPages(dir?: string): Promise<string[]>;
  readIndex(dir?: string): Promise<IndexDocument>;
  writeIndex(dir: string, content: string): Promise<void>;
  readLog(limit?: number): Promise<LogEntry[]>;
  appendLog(entry: LogEntry): Promise<void>;
}

interface GitAdapter {
  commit(message: string): Promise<string>;
  diff(): Promise<string>;
  log(limit?: number): Promise<Commit[]>;
}

interface SourceFetcher {
  fetch(url: string): Promise<SourceDocument>;
  fetchFile(path: string): Promise<SourceDocument>;
}
```

| Platform | `@memoss/core` adapters used |
|----------|------------------------------|
| **CLI** | `FsStore` + `SimpleGitAdapter` + `FetchAdapter` |
| **Desktop (Electron)** | `FsStore` (main process) + `SimpleGitAdapter` + `FetchAdapter` |
| **MCP Server** | `FsStore` + `SimpleGitAdapter` + `FetchAdapter` |
| **Web (local mode)** | `RemoteStore` (connects to local MCP) |
| **Web (hosted, Phase 3)** | `CloudStore` + `CloudGit` + `ServerFetch` |

### 6.5 Desktop Architecture (Phase 2 Preview)

```
┌──────────────────────────────────────────────┐
│              Electron App                     │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │      Renderer Process                 │    │
│  │   @memoss/web (Next.js SPA)           │    │
│  │   Knowledge graph, agent chat,         │    │
│  │   change review, visualization         │    │
│  └─────────────┬────────────────────────┘    │
│                │ contextBridge                │
│  ┌─────────────┴────────────────────────┐    │
│  │       Main Process                    │    │
│  │   @memoss/core                        │    │
│  │   Native fs / git / agent engine      │    │
│  │   System tray / global shortcuts      │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

Desktop is the primary user-facing product. CLI validates the core loop; Desktop delivers the experience.

---

## 7. Three-Phase Roadmap

### Phase 1 (0–6 months): CLI + Core Engine + Single-User Validation

**Goal:** Open-source CLI that individuals adopt for personal and project knowledge management. Validate the core agent loop (ingest/query/lint) with OKF files.

**Deliverables:**

| Item | Description |
|------|-------------|
| **Nx Monorepo** | Initialize workspace with pnpm workspaces, TypeScript project references |
| **`@memoss/core`** | OKF parser/serializer, agent engine (ingest/query/lint runners), tool registry, interfaces + adapters (`FsStore`, `SimpleGitAdapter`, `FetchAdapter`), index generator, graph data generator |
| **`@memoss/cli`** | `init` / `ingest` / `query` / `lint` / `status` / `view` / `serve` commands |
| **`@memoss/mcp-server`** | MCP server exposing all core operations as tools for external agent consumption |
| **OKF Spec v1.0** | Stabilize and publish as standalone document |
| **Source Connectors** | Local files (.md, .pdf, .txt), Web scraping (URL → markdown), GitHub repos |
| **Graph Viewer** | Self-contained `viz.html` (force-directed graph, adapted from knowledge-catalog) |
| **Git Integration** | Every agent operation creates a git commit |
| **Documentation** | Quickstart, CLI reference, connector development guide, OKF spec |

**Key Metrics:**
- GitHub stars
- npm downloads (`npm install -g memoss`)
- Discord community members
- First external community connector

**What we deliberately defer:**
- Web UI and Desktop app
- Multi-user collaboration
- Cloud sync and hosting
- Enterprise features

### Phase 2 (6–18 months): Desktop + Team Adoption

**Goal:** Desktop app for end users, team collaboration features, community connector ecosystem.

**Deliverables:**

| Item | Description |
|------|-------------|
| **`@memoss/web`** | Next.js web UI: knowledge graph browser, agent chat, change review workflow |
| **`@memoss/desktop`** | Electron app: web UI in renderer + core engine in main process |
| **Team Collaboration** | PR-based review workflow (agent proposes changes → human reviews → merge) |
| **Advanced Connectors** | BigQuery, Snowflake, dbt, Notion, Confluence, Slack |
| **Community Connector SDK** | Standard interface + docs for third-party connectors |
| **Enrich & Sync Ops** | Implement enrich and sync operations for enterprise data sources |
| **Scheduled Lint** | Background agent periodically checks knowledge base health |
| **Search** | Hybrid BM25 + vector search for large knowledge bases (> 500 pages) |

**Key Metrics:**
- Desktop downloads
- Weekly active knowledge bases
- Community connector count
- NPS

### Phase 3 (18 months+): Hosted Platform + Category Leadership

**Goal:** Managed cloud service, knowledge bundle marketplace, enterprise features. Become the de facto standard for agent-native knowledge management.

**Deliverables:**

| Item | Description |
|------|-------------|
| **Hosted Platform** | Managed agents, cloud storage, web access from anywhere |
| **Knowledge Bundle Market** | Community-shared OKF bundle templates (e.g., "SaaS Metrics Bundle", "GA4 Bundle") |
| **Enterprise Features** | SSO, RBAC, audit logs, SOC2/ISO compliance, SLA |
| **CI/CD Integration** | GitHub Actions, GitLab CI for automated enrichment pipelines |
| **Multi-System Sync** | Bi-directional sync with Alation, Atlan, Collibra, DataHub |
| **Advanced AI** | Cross-knowledge-base insights, trend detection, anomaly alerts |
| **SDK** | Python and TypeScript SDKs for embedding Memoss in custom applications |

**Key Metrics:**
- Market category recognition (Gartner/Forrester mention)
- Third-party tools with native OKF support
- Revenue

---

## 8. Competitive Landscape

### Direct Competitors

*(None yet — this category is undefined)*

### Adjacent Competitors

| Category | Players | Why We're Different |
|----------|---------|---------------------|
| **Data Catalogs** | Alation, Collibra, Atlan, DataHub, Amundsen | They require manual curation; we use agents. They're data-only; we're universal. They're proprietary; we're git-native and open. |
| **Wiki / Knowledge Bases** | Notion, Confluence, Obsidian, Outline | They're human-authored; we're agent-authored. Their knowledge goes stale; ours is continuously maintained. They're documents; we're a graph. |
| **Vector Databases / RAG** | Pinecone, Weaviate, Chroma | They're storage; we're knowledge. They lose structure; we create it. They focus on retrieval; we focus on *creation* and *maintenance*. Not competitors — complementary. |
| **AI Agent Frameworks** | LangChain, LlamaIndex, CrewAI | They build agents; we provide the knowledge those agents consume. Not competitors — we integrate with them. |
| **Metadata Platforms** | Google Dataplex, AWS Glue, Azure Purview | Cloud-specific. We're multi-cloud, vendor-neutral, and open-format. |
| **"AI Wiki" Tools** | Gitingest, GitIngest, various "chat with your docs" | They ingest code/docs for one-shot Q&A; we build persistent, maintained, cross-referenced knowledge. |

### Our Moat

1. **OKF as a standard** — If OKF becomes the de facto format for agent knowledge, every tool needs to speak it. We're the reference implementation.
2. **Connector ecosystem** — Community-contributed source adapters create a network effect that's hard to replicate.
3. **Data flywheel** — More knowledge bases on our platform → better agent behavior → better enrichment → more value → more knowledge bases.
4. **Integration depth** — MCP-first architecture means we embed into every agent workflow, creating switching costs through integration.
5. **Git-native** — No vendor lock-in. Users always own their data. This paradoxically *increases* loyalty — like GitHub, we earn trust by making exit easy.

---

## 9. Business Model

### Open-Source (Free)
- CLI, MCP server, agent engine, all core operations
- Single-machine usage
- Community connectors
- Self-hosted only

### Cloud — Individual (Free Tier)
- 1 knowledge base, up to 500 pages
- 50 agent operations/month
- Community connectors
- Web UI access

### Cloud — Team ($29/seat/month)
- Unlimited knowledge bases
- Unlimited agent operations
- Team collaboration (review workflow, comments)
- Premium connectors (BigQuery, Snowflake, dbt, Notion, Slack)
- 30-day version history

### Cloud — Enterprise (Custom pricing)
- SSO, RBAC, audit logs
- SOC2 / ISO compliance
- SLA
- Custom connector development
- Dedicated agent compute
- Unlimited version history
- On-premise deployment option

### Why Per-Seat + Usage, Not Just Per-Seat

- Per-seat aligns with team adoption (PLG from individual → team → enterprise)
- Usage-based component (agent operations) aligns cost with value received
- Freemium model enables bottom-up adoption: developers start free, bring to team

---

## 10. Key Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Google launches hosted knowledge-catalog** | Medium | High | Move faster. Focus on multi-cloud neutrality and non-Google use cases. Google's enterprise sales cycle is slow; our PLG motion can win developers first. |
| **Open-source alternative emerges** | High | Medium | Build community gravity (connectors, bundles, integrations). Best implementation wins, not first. Invest in UX and documentation. |
| **LLM hallucinations corrupt knowledge** | Medium | Critical | Human-in-the-loop review workflow. Strict augmentation rules (never overwrite structured metadata). Source citations for every claim. Lint operation catches contradictions. |
| **Format fragmentation** | Medium | High | OKF is intentionally minimal and permissive. Publish spec early. Encourage third-party implementations. Don't over-specify. |
| **Enterprise sales cycle too slow** | Medium | Medium | PLG motion first. Prove value with individual → team bottom-up adoption. Enterprise sales only in Phase 3 when product is mature. |
| **Context window limitations** | Low | Medium | Progressive disclosure via index files. Agent reads index first, drills into relevant pages. Pagination for large pages. This architecture was *designed* for context constraints. |
| **Users don't trust agent-authored content** | Medium | High | Every change is a git commit with attribution. Diff view in review workflow. Human approval gate. Gradual trust building through transparency. |

---

## Appendix A: Name & Branding

**Memoss** — portmanteau of "mem" (memory) + "moss" (苔藓).

The name captures the product's core philosophy: knowledge that grows like moss — naturally, layer by layer, without deliberate maintenance, covering and connecting everything it touches. Agents are the ecosystem; humans are the gardeners.

- **mem** — memory, the fundamental unit of what we store and retrieve
- **moss** — organic, self-sustaining growth; a living system that doesn't need to be "maintained" to stay alive

"A rolling stone gathers no moss" — to grow knowledge, you need a place for it to settle. Memoss is that place.

---

## Appendix B: Key References

- [Google Cloud knowledge-catalog](https://github.com/GoogleCloudPlatform/knowledge-catalog) — OKF spec, reference agent, metadata-as-code tools
- [Karpathy's LLM Wiki Pattern](https://gist.githubusercontent.com/karpathy/442a6bf555914893e9891c11519de94f/raw/ac46de1ad27f92b28ac95459c782c07f6b8c964a/llm-wiki.md) — Three-layer architecture, ingest/query/lint operations
- [OKF Specification](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) — Open Knowledge Format v0.1
- [MCP Protocol](https://modelcontextprotocol.io/) — Model Context Protocol
- [Vannevar Bush — As We May Think (1945)](https://www.theatlantic.com/magazine/archive/1945/07/as-we-may-think/303881/) — The Memex vision
