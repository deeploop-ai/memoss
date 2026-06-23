# Memoss — Product Design Document

**Version:** 0.2
**Date:** 2026-06-23

---

## Table of Contents

1. [Product Vision & Positioning](#1-product-vision--positioning)
2. [Core Insights — The Convergence](#2-core-insights--the-convergence)
3. [Three-Layer Open Strategy](#3-three-layer-open-strategy)
4. [Product Architecture](#4-product-architecture)
5. [Dual-Track Knowledge Model](#5-dual-track-knowledge-model)
6. [Core Operations Model](#6-core-operations-model)
7. [Agent Runtime & Trust Model](#7-agent-runtime--trust-model)
8. [Technical Architecture](#8-technical-architecture)
9. [Three-Phase Roadmap](#9-three-phase-roadmap)
10. [Competitive Landscape](#10-competitive-landscape)
11. [Business Model](#11-business-model)
12. [Key Risks & Mitigations](#12-key-risks--mitigations)

---

## 1. Product Vision & Positioning

### One-liner

**Memoss is an agent-native knowledge runtime — your file system *is* your knowledge base, and agents compile, maintain, and cross-reference it continuously.**

### Positioning Statement

For AI agent developers, data engineers, and knowledge workers who need their data and documents to be understood by both humans and AI, Memoss is an open knowledge runtime that treats **markdown files as the universal knowledge format** and **LLM agents as the maintainers**. Unlike traditional data catalogs (Alation, Collibra) that require manual curation, RAG systems that re-derive knowledge on every query, or wiki tools (Notion, Confluence) where knowledge goes stale, Memoss agents continuously **ingest, enrich, discover, cross-link, lint, and sync** knowledge — making it a **living, compounding, agent-consumable asset**.

### The Core Law

> Knowledge should not be rediscovered from raw documents on every question. It should be **compiled once, kept current, and ready to cite**.

This is the difference between RAG and a compound wiki:

| Mode | Per query | Knowledge shape | Maintenance |
|------|-----------|-----------------|-------------|
| RAG | Re-retrieve + stitch chunks | Unstructured fragments | Low (no accumulation) |
| **Memoss** | Read compiled wiki pages | Cross-linked markdown graph | Agents (near-zero human bookkeeping) |

### What We Are NOT

- **NOT a database** — we don't store your data, we store *knowledge about* your data
- **NOT a wiki editor** — humans curate and direct; agents do the writing
- **NOT a vector database** — the file system is the storage layer; search is layered on when needed
- **NOT Google Cloud only** — vendor-neutral; Catalog sync is one connector among many
- **NOT a chat-with-docs tool** — explorations compound into persistent pages, not chat history

### The Category We're Defining

"**Agent-Native Knowledge Runtime**" — a category at the intersection of:

```
Data Catalogs          Wiki / Knowledge Bases        AI Agent Tools
(Alation, Atlan)       (Notion, Obsidian)            (LangChain, LlamaIndex)
        \                     |                         /
         \                    |                        /
          ┌───────────────────┴──────────────────────┐
          │        Agent-Native Knowledge Runtime       │
          │                 (Memoss)                    │
          └──────────────────────────────────────────┘
```

---

## 2. Core Insights — The Convergence

This product design is informed by two independent sources that converged on the same architecture:

### Source A: Google knowledge-catalog

- **Origin:** Google Cloud Platform / Knowledge Catalog (Dataplex) team
- **Scope:** Enterprise data catalog + metadata management
- **Core Innovations:**
  - **OKF (Open Knowledge Format)** — Markdown + YAML frontmatter as a standardized knowledge representation
  - **Metadata as Code (MaC)** — Git-native, bi-directional sync with catalog services via `catalog.yaml`
  - **Dual disk layouts** — Standard (YAML + markdown sidecars) and Documents (markdown-first KB layout)
  - **Agent-Driven Enrichment** — LLM agents that crawl schemas, web docs, and query logs to auto-generate documentation
  - **Specialized agents** — Separate enrich, web-crawl, and discovery agents with strict tool boundaries
  - **MCP-First Architecture** — Catalog operations exposed as MCP tools for any agent framework
  - **Semantic Discovery** — Query decomposition + parallel search + merge/rerank
  - **Context versioning** — Git-native context for A/B tests and evals

### Source B: Karpathy's LLM Wiki Pattern

- **Origin:** Andrej Karpathy (independent)
- **Scope:** Personal/universal knowledge management
- **Core Innovations:**
  - **Three-Layer Architecture** — Raw sources (immutable) → Wiki (agent-maintained) → Schema (instructions)
  - **Operations Model** — Ingest / Query / Lint
  - **Agent as Author** — "You read it; the LLM writes it"
  - **Interactive ingest** — Discuss takeaways with the agent before filing
  - **Query → File back** — Good answers get filed back into the wiki so explorations compound
  - **Schema Co-Evolution** — User and agent refine maintenance rules together over time
  - **Obsidian as reader** — Graph view, Dataview, Web Clipper workflow
  - **Index-first retrieval** — Works well to hundreds of pages without embedding infrastructure

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
| Human loop | Git PR review | Interactive ingest + browse |

**This is not coincidence.** Two independent efforts — one enterprise, one personal — arrived at the same architecture. Memoss productizes the **union** of both: a wiki runtime *and* a catalog bridge.

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
│   MCP server  ·  Core ops (ingest/query/lint/…)      │
│   Catalog bridge  ·  Index/search  ·  Graph viz       │
│                                                    │
│   Revenue: none (community adoption driver)          │
│                                                    │
├──────────────────────────────────────────────────────┤
│                                                    │
│           OPEN FORMAT SPEC (OKF + MaC, Public)       │
│                                                    │
│   Markdown + YAML frontmatter conventions             │
│   Bundle structure  ·  Cross-linking  ·  Index/log   │
│   catalog.yaml manifest  ·  Conformance rules        │
│                                                    │
│   Revenue: none (pursue industry standardization)    │
│                                                    │
└──────────────────────────────────────────────────────┘
```

### Layer 1: Open Formats (Pursue Standardization)

- **OKF** — wiki/knowledge bundle interchange format
- **MaC** — catalog snapshot manifest (`catalog.yaml`) and entry layouts, compatible with knowledge-catalog's mdcode tooling
- **Goal:** Make OKF the "Markdown of AI knowledge" and MaC the "Terraform of catalog metadata"
- **Danger to avoid:** Trying to own the format. We compete on *best implementation*, not format lock-in

### Layer 2: Open-Source Engine (Build Community)

- **Goal:** Maximum adoption among developers; community-contributed connectors; de facto reference implementation
- **License:** Apache 2.0 (permissive, enterprise-friendly)
- **Strategy:** Make the single-machine workflow excellent. If it works great for one person, it'll spread to teams
- **Success metric:** GitHub stars, community connectors, CLI downloads, Discord members

### Layer 3: Commercial Cloud (Capture Value)

- **Goal:** Revenue from teams/enterprises that want managed infrastructure, collaboration, and advanced AI
- **Strategy:** Compete on convenience, not lock-in. Data is always exportable as OKF files or MaC snapshots
- **Moat:** Not the code — the data flywheel, the knowledge bundle network effects, and the integration depth

---

## 4. Product Architecture

### 4.1 Four-Layer System Overview

```
┌─────────────────────────────────────────────────────────┐
│  Experience Layer                                        │
│  CLI · Desktop/Obsidian Vault · Web · IDE Plugin · MCP   │
├─────────────────────────────────────────────────────────┤
│  Agent Runtime                                           │
│  Orchestrator · Schema Packs · Specialized Agents        │
│  Operations: Ingest · Query · Lint · Enrich · Discover   │
│              Sync · Publish · Bridge                     │
├─────────────────────────────────────────────────────────┤
│  Knowledge Layer (Dual-Track)                            │
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │ OKF Vault (Wiki)     │  │ Catalog Snapshot (MaC)   │  │
│  │ concepts + graph     │  │ catalog.yaml + entries   │  │
│  │ index/log navigation │  │ Standard / Documents     │  │
│  └──────────┬──────────┘  └────────────┬─────────────┘  │
│             └──────── Bridge ──────────┘                  │
├─────────────────────────────────────────────────────────┤
│  Source Layer (immutable)                                │
│  files · web · git · db schema · comms · catalog API     │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Core Components

#### A. OKF Vault (Wiki Track)

The heart of the personal/team knowledge experience. A directory tree of OKF markdown files on disk.

```
my-knowledge/
├── index.md                    # Top-level catalog of all pages
├── log.md                      # Chronological activity record (root scope)
├── .memoss/                    # Schema layer
│   ├── config.yaml             # KB metadata, mode, schema pack, search settings
│   ├── instructions.md         # Agent behavior rules (co-evolves with user)
│   ├── connectors.yaml         # Source connector configurations
│   └── provenance.yaml         # Source fingerprint → page mapping (optional)
├── sources/                    # Raw source materials (immutable)
│   ├── manifest.yaml           # Source registry with content hashes
│   └── ...
├── topics/                     # Concept/entity pages
│   ├── index.md
│   └── ...
├── references/                 # Named definitions (metrics, enums, glossaries)
│   ├── index.md
│   └── ...
├── data/                       # Data asset documentation
│   ├── index.md
│   ├── tables/
│   └── metrics/
└── notes/                      # Query file-backs and exploration artifacts
    └── ...
```

- Every `.md` file (except `index.md` and `log.md`) has YAML frontmatter with at minimum a `type` field
- Cross-links between concepts create a navigable knowledge graph
- Git provides version history, branching, and collaboration
- **Obsidian-compatible** — vault can be opened directly in Obsidian for reading and graph view

#### B. Catalog Snapshot (Catalog Track)

Enterprise metadata-as-code representation, compatible with knowledge-catalog's mdcode tooling.

```
catalog-workspace/
├── catalog.yaml                # Manifest: scope, snapshot, publishing, aliases
├── .catalog.state              # Tool state: checksums (separate from user content)
└── catalog/                    # Entry files (layout auto-selected by scope)
    ├── <entry>.yaml            # Standard layout: structured metadata
    ├── <entry>.overview.md     # Standard layout: unstructured aspect sidecar
    └── <entry>.md              # Documents layout: frontmatter + body
```

Scopes determine layout automatically:
- `bq-dataset` / `entryGroup` → **Standard Layout** (YAML + sidecars)
- `kb` → **Documents Layout** (markdown-first)

#### C. Sources Layer

Immutable raw materials that agents read from but never modify.

| Connector Type | Examples |
|----------------|----------|
| Database schemas | BigQuery, Snowflake, PostgreSQL, MySQL |
| Documentation | Web pages, Markdown files, PDFs, Confluence |
| Code | GitHub repos, dbt projects, SQL files |
| Communication | Slack threads, meeting transcripts, emails |
| APIs | REST endpoints, GraphQL schemas, OpenAPI specs |
| Catalog services | Knowledge Catalog / Dataplex EntryGroups |

Each ingested source is registered in `sources/manifest.yaml` with a content hash for staleness detection during lint.

#### D. Agent Runtime

Model-agnostic runtime (Claude, GPT, Gemini, open-source via LiteLLM or similar).

**Sub-components:**

- **Orchestrator** — Session management, tool dispatch, context windows, draft-branch workflow
- **Specialized Agents** — Ingest, WebCrawl, Enrich, Query, Lint, Discover (each with dedicated prompt + tool set)
- **Tool Registry** — Pluggable tools: read/write files, search, fetch URLs, query databases, call APIs
- **Schema Packs** — Domain templates (`personal`, `research`, `data-catalog`) for cold-start conventions
- **Policy Engine** — Read-before-write, citation-required, reference-mint rules

#### E. Consumption Layer

| Interface | Purpose |
|-----------|---------|
| **CLI** (`memoss`) | Primary developer interface |
| **MCP Server** | Standard protocol for AI agents to read/write/lint knowledge |
| **Desktop** | Obsidian-compatible vault + embedded agent chat + diff review |
| **Web UI** | Browse knowledge graph, review agent changes, visualize relationships |
| **IDE Plugin** | VS Code / JetBrains integration — knowledge alongside code |
| **REST API** | Programmatic access for custom integrations (Phase 3) |

### 4.3 Design Principles

1. **File system is the database.** No proprietary storage. Everything is markdown/YAML files. You can `cat`, `grep`, `git diff` your knowledge.
2. **Agent writes, human curates.** The agent does the bookkeeping; the human provides judgment, direction, and verification.
3. **Progressive disclosure.** Index files at every level let agents and humans navigate without loading everything into context.
4. **Links are first-class.** The graph of cross-references is as important as individual documents. Cross-links use **file-relative paths** (`../topics/other.md`) so they resolve on GitHub, local filesystems, Obsidian, and any markdown renderer.
5. **Sources are immutable.** Agents read sources; they never modify them. Provenance links pages back to source versions.
6. **Explorations compound.** Query answers, comparisons, and analyses can be filed back as new knowledge pages.
7. **Schema co-evolves.** `.memoss/instructions.md` is a living contract between user and agent, refined over time.
8. **MCP-first.** Every capability is exposed as an MCP tool. If you can't use it from an agent, it doesn't exist.
9. **Draft by default.** Agent writes go to a draft branch or worktree until human approval — trust is earned through transparency.

---

## 5. Dual-Track Knowledge Model

Memoss serves two knowledge tracks that can be used independently or together.

### 5.1 Wiki Track (OKF Vault)

**Best for:** Personal research, reading notes, team wikis, competitive analysis, any domain where knowledge compounds over time.

**Exchange format:** OKF bundle (git repo of markdown files).

**Primary operations:** Ingest, Query, Lint.

### 5.2 Catalog Track (MaC Snapshot)

**Best for:** Data asset documentation, enterprise catalog enrichment, CI/CD metadata pipelines.

**Exchange format:** MaC snapshot (`catalog.yaml` + entry files + `.catalog.state`).

**Primary operations:** Enrich, Sync, Discover (with external catalog).

### 5.3 Bridge

OKF and MaC are **not the same format**. The Bridge layer converts between them:

| Direction | Use case |
|-----------|----------|
| **MaC → OKF** | Pull catalog snapshot, convert entries to OKF concepts for agent consumption and wiki-style browsing |
| **OKF → MaC** | Push enriched OKF/MaC aspects back to catalog service (constrained by `publishing` config) |
| **OKF subset → Bundle** | Publish portable OKF bundle with closure over cross-referenced concepts |

Bridge respects:
- `publishing` subset in `catalog.yaml` (only listed types/aspects are pushed)
- Checksum conflict detection (fail-fast; require pull before push)
- Layout auto-selection (Standard vs Documents)

Implementation: `@memoss/catalog-bridge` package, compatible with knowledge-catalog's `toolbox/mdcode` semantics.

### 5.4 Schema Packs

Pre-built domain conventions to solve the cold-start problem (Karpathy's "co-evolve the schema" pattern):

| Pack | Directory layout | Typical `type` values | Interaction style |
|------|------------------|----------------------|-------------------|
| `personal` | topics/ + journal/ | Entity, Goal, Note | Interactive ingest |
| `research` | topics/ + papers/ | Thesis, Paper, Claim | Contradiction tracking |
| `data-catalog` | data/ + references/ | BigQuery Table, Metric, Reference | Enrich + Sync |

Selected via `.memoss/config.yaml` → `schema_pack: research`.

### 5.5 Extended Frontmatter (Trust & Lint)

OKF allows extension keys. Memoss recommends these optional fields for agent-authored pages:

```yaml
---
type: Topic
title: Customer 360
description: Unified view of customer interactions across channels.
sources:                          # Provenance back to raw sources
  - source_id: mbr-playbook-2026
    section: "Section 3"
verified_at: 2026-06-23           # Last verified against sources (lint uses for staleness)
supersedes: topics/old-customer-360  # Replacement chain
confidence: high                  # Agent self-assessment for review prioritization
---
```

---

## 6. Core Operations Model

The system supports **seven core operations** plus **Bridge** as a format operation.

### 6.1 Ingest

> Add a new source; let the agent extract and integrate knowledge across the wiki.

**Source:** Karpathy + knowledge-catalog web ingestion agent.

**Flow:**
```
User drops source → Agent reads source → (Interactive) Agent discusses takeaways
→ Agent writes/augments pages on draft branch → Updates index.md at affected levels
→ Updates cross-referenced concept pages → Registers provenance in manifest
→ Appends log.md → User reviews diff → Approve merges to main
```

**Key behavior:**
- One source can update 10–15 existing pages (cross-referencing is the value)
- Agent preserves existing content; augments rather than overwrites
- Sources are immutable — agent reads, never modifies
- **Interactive mode (default):** agent summarizes key points; user guides emphasis before write
- **Web crawl mode:** seed URLs + `max_pages` budget + `allowed_hosts` filter; agent follows links with judgment (knowledge-catalog web agent pattern)
- **Reference minting rules:** new pages under `references/` only when four conditions hold (topic shape, not meta-page, citation test, reuse test) — see §7.3

**CLI:** `memoss ingest <source> [--interactive] [--crawl --seeds <urls> --max-pages N]`

**Priority:** Phase 1a (single source); Phase 1b (crawl + interactive + draft branch)

### 6.2 Query

> Ask questions against the knowledge base; get cited answers; optionally file back.

**Source:** Karpathy.

**Flow:**
```
User asks question → Agent reads index.md → Identifies relevant pages (+ search if large)
→ Reads pages → Synthesizes answer with citations
→ (Optional --save) Writes answer to notes/ with bidirectional cross-links
```

**Key behavior:**
- Index-first retrieval works well up to ~200 pages (Karpathy-validated)
- Beyond that: grep/BM25 (Phase 1) → hybrid + vector rerank (Phase 2)
- `--save` writes to `notes/` as `type: Note`; duplicate slugs trigger augment-not-overwrite
- Output formats: markdown (default), comparison tables; Marp slides and charts in Phase 2

**CLI:** `memoss query "<question>" [--save] [--format md|marp]`

**Priority:** Phase 1a

### 6.3 Lint

> Proactive knowledge base health checks.

**Source:** Karpathy + OKF conventions.

**Flow:**
```
Agent scans vault → Checks contradictions, stale claims, orphans, missing links,
index gaps, missing citations on factual claims, deprecation candidates
→ Generates report + health score → (Optional --fix) Agent proposes edits on draft branch
```

**Lint checks:**

| Check | Severity | Auto-fix |
|-------|----------|----------|
| Contradictory claims across pages | error | Propose annotation; human required |
| `verified_at` older than source `content_hash` change | warning | Propose re-ingest |
| Zero inbound links (orphan) | warning | Propose cross-links |
| Concept mentioned but not linked | info | `--fix` may add links |
| Page missing from any `index.md` | info | Rebuild index |
| Factual claim without `# Citations` | error | No auto-fix |
| Concept buried in wrong page | info | Propose split |

**Output:** Human-readable report + `lint-report.json` + **health_score (0–100)**.

**CLI:** `memoss lint [--fix]`

**Priority:** Phase 1a (basic); Phase 1b (provenance-aware staleness)

### 6.4 Enrich

> Deep, structured enrichment of a single data asset using multiple sources.

**Source:** knowledge-catalog enrichment agent.

**Flow:**
```
Agent targets one concept/entry → Reads structured metadata (schema, partitioning)
→ Optionally samples rows → Calls pluggable MCP tool sources (org docs, wikis)
→ Generates structured doc: schema, query patterns, business context, citations
→ Exactly one write per invocation
```

**Key behavior:**
- **One concept per invocation** — strict termination (reference agent pattern)
- Distinct from Ingest: Enrich is vertical (one asset), Ingest is horizontal (one source → many pages)
- Two-pass: deterministic extraction (schema) → LLM augmentation (context)
- **Never overwrite real metadata** with hallucinated content
- Pluggable external sources via MCP (`--tools-path`)

**CLI:** `memoss enrich --target <concept-id|entry-id> [--tools <path>]`

**Priority:** Phase 2a

### 6.5 Discover

> Semantic search across local knowledge and external catalogs.

**Source:** knowledge-catalog discovery agent.

**Flow:**
```
User question → Semantic decomposition (entities, metrics, constraints)
→ Generate up to 3 distinct search variations + baseline (verbatim query)
→ Parallel search (local KB and/or external catalog API)
→ Deduplicate → LLM rerank → Return ranked concept/entry list
→ (Optional) Chain into Query for synthesized answer
```

**Local Discover (no external catalog):** uses `search_kb` with decomposition + rerank.

**Remote Discover:** `CatalogSearchAdapter` with predicate extraction (type, system, projectid, parent, etc.) per knowledge-catalog discovery SKILL.

**CLI:** `memoss discover "<question>" [--catalog <connector>]`

**Priority:** Phase 2b

### 6.6 Sync

> Bi-directional synchronization between local MaC snapshot and external catalog.

**Source:** knowledge-catalog mdcode.

**Flow:**
```
memoss sync pull   → Download metadata from catalog → convert to local files
memoss sync push   → Validate → push publishing subset → fail-fast on conflict
memoss sync status → Compare local checksums vs .catalog.state
memoss sync validate → Pre-push validation against live type definitions
```

**Key behavior:**
- `catalog.yaml` defines scope, snapshot subset, publishing subset, aliases
- `.catalog.state` stores checksums separately from user content
- Conflict: remote drift → abort push, require pull
- Intent-to-delete: missing file in publishing scope = delete intent (skipped for managed entries)
- CI/CD: enrich → human reviews PR → merge → auto-push

**Priority:** Phase 2a

### 6.7 Publish

> Package knowledge into a shareable, self-contained OKF bundle.

**Flow:**
```
User selects subtree or tag filter → Bridge computes closure over cross-references
→ Generates self-contained directory + all index files + viz.html
```

**Key behavior:**
- Portable directory shareable via git, tarball, or Bundle Market (Phase 3)
- Zero-dependency HTML viewer (Cytoscape.js graph, adapted from knowledge-catalog)
- Auto-synthesized directory descriptions in index files (LLM one-liner per section)

**CLI:** `memoss publish --scope <path|tag> --output <dir>`

**Priority:** Phase 2a

### 6.8 Bridge

> Convert between OKF Vault and MaC Catalog Snapshot.

**CLI:**
```bash
memoss bridge mac-to-okf --catalog-path . --vault-path ./wiki
memoss bridge okf-to-mac --vault-path ./wiki --catalog-path .
```

**Priority:** Phase 2a

---

## 7. Agent Runtime & Trust Model

### 7.1 Specialized Agents

Each operation maps to a specialized agent with a dedicated system prompt and restricted tool set:

| Agent | Tools | Termination rule |
|-------|-------|------------------|
| **IngestAgent** | read/write pages, list, index, log, read source | All affected pages updated + log appended |
| **WebCrawlAgent** | + fetch_url (budget-enforced) | Budget exhausted or diminishing returns |
| **EnrichAgent** | read raw metadata, sample rows, MCP sources, write one page | Exactly one `write_page` |
| **QueryAgent** | read pages, search, index (+ write if --save) | Answer synthesized |
| **LintAgent** | read all pages, list, search (+ write if --fix) | Report generated |
| **DiscoverAgent** | search (local + catalog connector) | Ranked results returned |

Prompt structure (proven in knowledge-catalog reference agent):

```
1. Role
2. Workflow (step-by-step tool sequence)
3. Frontmatter conventions
4. Body conventions (required sections, heading order)
5. Cross-linking rules (file-relative paths only)
6. Style rules (concrete over generic, no invented facts)
```

### 7.2 Write Safety Policies

1. **Read-before-write** — mandatory for any augmentation
2. **Augment, don't rewrite** — preserve existing `# Heading` structure
3. **Citation-required** — factual claims must have traceable sources in `# Citations`
4. **Complete frontmatter on write** — `write_page` replaces full frontmatter dict; all existing keys must be preserved when augmenting
5. **Draft branch default** — agent writes to `memoss/draft/<operation>-<timestamp>`; `memoss approve` merges to main

### 7.3 Reference Page Minting Rules

New pages under `references/` are created only when **all four** conditions hold (from knowledge-catalog web ingestion agent):

1. **Topic shape** — defines something referenceable by name (entity, metric, enum, field glossary, convention)
2. **Not bundle-level meta** — not overview, intro, quickstart, changelog, FAQ, marketing
3. **Citation test** — a primary concept doc can write: `See the [X reference](../references/x.md) for …`
4. **Reuse test** — at least two existing concepts would cite it, OR one concept needs it as load-bearing background

When in doubt, **skip**. Zero reference pages is fine; noisy reference pages are not.

### 7.4 Provenance Model

`sources/manifest.yaml` registers every ingested source:

```yaml
sources:
  - id: data-architecture-blog
    uri: https://example.com/data-architecture
    fetched_at: 2026-06-23T10:00:00Z
    content_hash: sha256:abc123...
    ingested_at: 2026-06-23T10:05:00Z
    affects:
      - topics/data-pipeline.md
      - topics/event-sourcing.md
```

Page frontmatter `sources` array links back. Lint compares `verified_at` against source hash changes to flag stale pages.

### 7.5 Search Strategy (Scale-Adaptive)

| Vault size | Strategy |
|------------|----------|
| < ~200 pages | Index-first (read `index.md`, drill down) |
| 200–2000 pages | Index + grep/BM25 local search |
| > 2000 pages | Hybrid BM25 + vector + LLM rerank (qmd-compatible; CLI + MCP) |
| External catalog | Discover operation via CatalogSearchAdapter |

Configured in `.memoss/config.yaml` → `search.strategy: auto`.

### 7.6 Obsidian Integration

Karpathy's workflow is a product requirement, not an afterthought:

- Vault layout is valid Obsidian vault (wikilinks compatible via relative paths)
- Frontmatter fields support Dataview queries (`tags`, `type`, `verified_at`)
- Web Clipper → `sources/inbox/` → `memoss ingest sources/inbox/`
- Graph view in Obsidian complements `memoss view` (Cytoscape HTML)
- Desktop app (Phase 2) embeds agent chat alongside Obsidian-compatible viewer

---

## 8. Technical Architecture

### 8.1 Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Monorepo** | Nx + TypeScript + pnpm workspaces | Industry standard; build caching |
| **Agent Engine** | Vercel AI SDK (`ai` + provider packages) | Multi-provider, type-safe tool calling |
| **Tool Schema** | Zod | Type-safe validation; AI SDK native |
| **Markdown** | `marked` + `front-matter` | OKF parse/serialize |
| **CLI** | `citty` | Lightweight, TypeScript-native |
| **Git** | `simple-git` | Branch, commit, diff, merge for draft workflow |
| **MCP** | `@modelcontextprotocol/sdk` | Agent integration |
| **Testing** | `vitest` | Fast, Nx-compatible |
| **Bundler** | `tsc` (Nx default) | Phase 2 may migrate to `tsup` |

### 8.2 Agent Engine Decision

Use AI SDK directly for Phase 1. Align directory conventions with Vercel eve ("an agent is a directory") for future migration when eve matures.

### 8.3 Package Structure

```
memoss/
├── apps/
│   ├── cli/                      # @memoss/cli
│   ├── web/                      # @memoss/web (Phase 2)
│   └── desktop/                  # @memoss/desktop (Phase 2)
│
├── packages/
│   ├── core/                     # @memoss/core — OKF, agents, tools, policies
│   ├── catalog-bridge/           # @memoss/catalog-bridge — MaC sync (Phase 2)
│   ├── search/                   # @memoss/search — grep → hybrid (Phase 2)
│   └── mcp/                      # @memoss/mcp-server
│
├── schema-packs/                 # personal, research, data-catalog templates
│
├── docs/
│   ├── product-design.md
│   ├── phase-1-plan.md
│   ├── okf-spec.md               # Canonical OKF reference
│   └── mac-bridge.md             # MaC interop spec (Phase 2)
│
└── examples/
    ├── research-topic/           # Karpathy-style wiki
    └── ga4-ecommerce/            # knowledge-catalog data catalog demo
```

### 8.4 Core Abstractions

```typescript
interface KnowledgeStore {
  readPage(path: string): Promise<OKFDocument>;
  writePage(path: string, doc: OKFDocument): Promise<void>;
  listPages(dir?: string): Promise<string[]>;
  readIndex(dir?: string): Promise<IndexDocument | null>;
  writeIndex(dir: string, content: string): Promise<void>;
  readLog(limit?: number): Promise<LogEntry[]>;
  appendLog(entry: LogEntry): Promise<void>;
}

interface GitAdapter {
  commit(message: string): Promise<string>;
  diff(): Promise<string>;
  log(limit?: number): Promise<Commit[]>;
  createBranch(name: string): Promise<void>;
  merge(branch: string): Promise<void>;
  isRepo(): Promise<boolean>;
  init(): Promise<void>;
}

interface SourceAdapter {
  readonly sourceUri: string;
  listItems(): Promise<SourceItem[]>;
  readItem(id: string): Promise<SourceContent>;
}

interface CatalogBridge {
  pull(): Promise<SyncResult>;
  push(options?: { force?: boolean; validateOnly?: boolean }): Promise<SyncResult>;
  toOKF(vaultPath: string): Promise<void>;
  fromOKF(vaultPath: string): Promise<void>;
}
```

| Platform | Adapters |
|----------|----------|
| **CLI** | `FsStore` + `SimpleGitAdapter` + `SourceAdapter` |
| **MCP** | Same as CLI |
| **Desktop** | `FsStore` in main process; renderer uses web UI |
| **Cloud (Phase 3)** | `CloudStore` + `CloudGit` |

### 8.5 Desktop Architecture (Phase 2)

```
┌──────────────────────────────────────────────┐
│              Electron App                     │
│  ┌──────────────────────────────────────┐    │
│  │  Renderer: @memoss/web                │    │
│  │  Vault browser · Agent chat · Diff    │    │
│  └─────────────┬────────────────────────┘    │
│                │ contextBridge                │
│  ┌─────────────┴────────────────────────┐    │
│  │  Main: @memoss/core + native fs/git   │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

---

## 9. Three-Phase Roadmap

### Phase 1a (Months 0–4): Core Loop Validation

**Goal:** Open-source CLI; validate ingest/query/lint with OKF; establish trust primitives.

| Item | Description |
|------|-------------|
| `@memoss/core` | OKF parser/serializer/validator, ingest/query/lint agents, tool registry, policies |
| `@memoss/cli` | `init` / `ingest` / `query` / `lint` / `status` / `view` / `serve` / `approve` |
| `@memoss/mcp-server` | All core tools + operation runners |
| **OKF Spec** | Publish `docs/okf-spec.md` |
| **Schema Packs** | `personal`, `research` templates |
| **Source Connectors** | Local files, single URL, GitHub repos |
| **Graph Viewer** | Self-contained `viz.html` |
| **Git Integration** | One commit per approved operation |
| **Draft branch** | Agent writes to draft; `memoss approve` merges |

**Validation scenario:** Karpathy-style research wiki from web articles and PDFs.

### Phase 1b (Months 4–6): Crawl, Provenance, Quality

**Goal:** knowledge-catalog-grade web ingestion; provenance-aware lint.

| Item | Description |
|------|-------------|
| **Web crawl ingest** | Seeds, max-pages budget, allowed_hosts, reference minting rules |
| **Interactive ingest** | Discuss-then-write UX in CLI |
| **`sources/manifest.yaml`** | Content hashes, page mapping |
| **Provenance frontmatter** | `sources`, `verified_at` on agent writes |
| **Lint health score** | `lint-report.json` + 0–100 score |
| **Examples** | `examples/research-topic/`, port GA4 bundle skeleton |

**Validation scenario:** Enrich a data documentation bundle from seed URLs (knowledge-catalog GA4 pattern).

### Phase 2a (Months 6–12): Catalog Bridge & Enrich

**Goal:** Enterprise data catalog workflow; team-ready git review.

| Item | Description |
|------|-------------|
| `@memoss/catalog-bridge` | MaC pull/push/status/validate; OKF ↔ MaC conversion |
| **Enrich operation** | Single-target enrichment with MCP tool sources |
| **Publish operation** | Bundle closure + viz.html |
| **`schema-packs/data-catalog`** | BigQuery table/metric conventions |
| **Connectors** | BigQuery schema, dbt, Notion, Confluence |
| **PR review workflow** | GitHub/GitLab integration for agent PRs |

**Validation scenario:** knowledge-catalog ecommerce BQ demo end-to-end.

### Phase 2b (Months 12–18): Discover, Desktop, Search

**Goal:** End-user product; local + remote discovery.

| Item | Description |
|------|-------------|
| `@memoss/web` + `@memoss/desktop` | Vault browser, agent chat, diff review, Obsidian-compatible |
| **Discover operation** | Local decomposition search + catalog connector |
| `@memoss/search` | Hybrid BM25 + vector for large vaults |
| **Scheduled lint** | Background health checks |
| **Query formats** | Marp slides, chart generation |
| **Community Connector SDK** | Documented `SourceAdapter` + MCP enrich tools |

### Phase 3 (18+ months): Platform & Category Leadership

| Item | Description |
|------|-------------|
| **Hosted Platform** | Managed agents, cloud storage, web access |
| **Knowledge Bundle Market** | Community OKF bundle templates |
| **Enterprise** | SSO, RBAC, audit logs, SOC2, SLA |
| **CI/CD** | GitHub Actions for enrich → review → push pipelines |
| **Multi-System Sync** | Alation, Atlan, Collibra, DataHub connectors |
| **SDK** | Python and TypeScript embedding SDKs |

---

## 10. Competitive Landscape

### Direct Competitors

*(None yet — this category is undefined)*

### Adjacent Competitors

| Category | Players | Why We're Different |
|----------|---------|---------------------|
| **Data Catalogs** | Alation, Collibra, Atlan, DataHub | Manual curation vs agents; data-only vs universal; proprietary vs git-native |
| **Wiki / Knowledge Bases** | Notion, Confluence, Obsidian | Human-authored vs agent-authored; stale vs continuously maintained |
| **Vector DB / RAG** | Pinecone, Weaviate, Chroma | Storage vs knowledge creation; complementary, not competitive |
| **AI Agent Frameworks** | LangChain, LlamaIndex, CrewAI | They build agents; we provide the knowledge those agents consume |
| **Metadata Platforms** | Google Knowledge Catalog, AWS Glue, Azure Purview | Cloud-specific; we're multi-cloud and open-format |
| **Chat-with-docs** | Gitingest, NotebookLM | One-shot Q&A vs persistent compounded knowledge |

### Our Moat

1. **OKF + MaC as standards** — reference implementation for both wiki and catalog tracks
2. **Connector ecosystem** — community source adapters and enrich MCP tools
3. **Data flywheel** — more vaults → better agent behavior → better enrichment → more value
4. **MCP embedding depth** — integrates into every agent workflow
5. **Git-native trust** — exit is easy; loyalty is earned (GitHub model)

---

## 11. Business Model

### Open-Source (Free)
- CLI, MCP server, agent runtime, all core operations
- Single-machine usage; community connectors; self-hosted

### Cloud — Individual (Free Tier)
- 1 vault, up to 500 pages; 50 agent operations/month; web UI

### Cloud — Team ($29/seat/month)
- Unlimited vaults and operations; team review workflow; premium connectors; 30-day history

### Cloud — Enterprise (Custom)
- SSO, RBAC, audit logs, SOC2, SLA, on-premise option, unlimited history

---

## 12. Key Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Google launches hosted knowledge-catalog** | Medium | High | Move faster; multi-cloud neutrality; PLG wins developers first |
| **Open-source alternative emerges** | High | Medium | Community gravity: connectors, bundles, best UX |
| **LLM hallucinations corrupt knowledge** | Medium | Critical | Draft branch + human approve; citation-required; enrich never overwrites schema; lint catches contradictions |
| **OKF / MaC format fragmentation** | Medium | High | Publish specs early; Bridge package; permissive consumption |
| **Users don't trust agent-authored content** | Medium | High | Git attribution; diff review; gradual trust via transparency |
| **Context window limits** | Low | Medium | Progressive disclosure; index-first; designed for this constraint |
| **Wiki vs catalog positioning confusion** | Medium | Medium | Dual-track model with clear mode selection in `config.yaml` |

---

## Appendix A: Traceability Matrix

| Capability | Karpathy | knowledge-catalog | Memoss v0.2 |
|------------|----------|-------------------|-------------|
| Three-layer model | ✓ | partial | ✓ + Catalog track |
| Ingest | ✓ | web agent | ✓ + interactive + crawl |
| Query + file-back | ✓ | — | ✓ + multi-format (Phase 2) |
| Lint | ✓ | — | ✓ + health score + provenance |
| Enrich | — | ✓ | ✓ + MCP sources |
| Discover | — | ✓ | ✓ |
| Sync | — | ✓ | ✓ via catalog-bridge |
| Publish / bundle | git | viz.html | ✓ |
| index / log | ✓ | ✓ | ✓ + multi-level log |
| MCP | qmd (suggested) | kcmd | ✓ |
| Obsidian workflow | ✓ core | — | ✓ compatible |
| Human review | interactive ingest | git PR | ✓ draft branch + approve |
| Immutable sources | ✓ | pull snapshot | ✓ + manifest |
| Reference minting rules | — | ✓ | ✓ |
| Context versioning | — | ✓ | Phase 3 |
| Schema packs | co-evolve | — | ✓ |

---

## Appendix B: Name & Branding

**Memoss** — portmanteau of "mem" (memory) + "moss" (苔藓).

Knowledge that grows like moss — naturally, layer by layer, without deliberate maintenance. Agents are the ecosystem; humans are the gardeners.

"A rolling stone gathers no moss" — to grow knowledge, you need a place for it to settle. Memoss is that place.

---

## Appendix C: Key References

- [Google Cloud knowledge-catalog](https://github.com/GoogleCloudPlatform/knowledge-catalog) — OKF spec, reference agents, mdcode sync, enrichment, discovery
- [Karpathy's LLM Wiki Pattern](https://gist.githubusercontent.com/karpathy/442a6bf555914893e9891c11519de94f/raw/ac46de1ad27f92b28ac95459c782c07f6b8c964a/llm-wiki.md) — Three-layer architecture, ingest/query/lint
- [OKF Specification](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) — Open Knowledge Format v0.1
- [MCP Protocol](https://modelcontextprotocol.io/) — Model Context Protocol
- [Vannevar Bush — As We May Think (1945)](https://www.theatlantic.com/magazine/archive/1945/07/as-we-may-think/303881/) — The Memex vision
