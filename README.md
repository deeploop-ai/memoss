# Memoss

> **Memory that grows naturally, like moss.**
>
> *Your file system is your knowledge base. Agents compile, maintain, and cross-reference it continuously.*

[中文文档](README_ZH.md)

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Phase](https://img.shields.io/badge/phase-1a-yellow.svg)](docs/phase-1-plan.md)
[![Design](https://img.shields.io/badge/design-v0.2-blue.svg)](docs/product-design.md)

---

## What is Memoss?

Memoss is an **agent-native knowledge runtime** — a system where LLM agents continuously build and maintain a living knowledge base from your raw sources (documents, web pages, data schemas, code, conversations), stored as plain Markdown files on your file system.

Unlike traditional wikis where **humans do the bookkeeping** (and it goes stale), or RAG systems where knowledge is **re-derived from scratch** on every query — in Memoss, **agents do the maintenance**, and knowledge is **compiled once, kept current, and always ready**.

### The Core Idea

```
You drop sources. Agents build knowledge. You ask questions. Agents keep it alive.
```

**Phase 1 operations:**

- **Ingest** — Drop a URL, file, or repo. The agent reads it, extracts knowledge, updates every related page, and commits (to a draft branch for your review).
- **Query** — Ask a question. The agent searches the knowledge base, synthesizes an answer with citations, and can file the answer back as a new page.
- **Lint** — The agent checks for contradictions, stale claims, orphan pages, and missing links. Knowledge stays healthy.
- **Extract** — Convert a source to Markdown under `sources/extracted/` using [skills.sh](https://skills.sh) skills (used automatically during ingest, or standalone via `memoss extract`).

**Coming in Phase 2:** Enrich · Discover · Sync · Publish · Bridge (OKF ↔ enterprise catalog)

### Dual-Track Knowledge

Memoss serves two tracks that can be used independently or together:

| Track | Format | Best for |
|-------|--------|----------|
| **Wiki** | [OKF](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) vault (Markdown + YAML frontmatter) | Personal research, team wikis, reading notes |
| **Catalog** | Metadata-as-Code snapshot (`catalog.yaml` + entries) | Data asset documentation, enterprise catalog sync |

The **Bridge** layer converts between them — compatible with [Google knowledge-catalog](https://github.com/GoogleCloudPlatform/knowledge-catalog) mdcode tooling.

### Why Markdown Files?

Because **Markdown is the only format that is readable by humans, parseable by agents, and diffable in git** — all without tooling. You can `cat` a file, `grep` a concept, `git diff` a change, and open the vault in **Obsidian** for graph view. No proprietary database. No lock-in.

---

## Quickstart

### From source (development)

```bash
git clone https://github.com/deeploop-ai/memoss.git
cd memoss
pnpm install
pnpm nx build core cli mcp-server

# Set your LLM API key
export ANTHROPIC_API_KEY=sk-ant-...

# Create a knowledge base (default: ~/.memoss-vault)
node apps/cli/dist/main.js init --pack research

# Or specify a path
node apps/cli/dist/main.js init ./my-knowledge --pack research
cd ./my-knowledge

# Ingest your first source (writes to draft branch)
node apps/cli/dist/main.js ingest "https://example.com/article" --type web

# Review and merge agent changes
node apps/cli/dist/main.js approve

# Ask a question
node apps/cli/dist/main.js query "what does this article say about X?"

# File the answer back into the knowledge base
node apps/cli/dist/main.js query "compare X and Y" --save

# Check knowledge base health
node apps/cli/dist/main.js lint

# Visualize the knowledge graph
node apps/cli/dist/main.js graph

# Start MCP server for other AI agents (agent tools only by default)
node apps/cli/dist/main.js mcp serve
node apps/cli/dist/main.js mcp serve --capabilities agent,read
node apps/cli/dist/main.js mcp serve --capabilities full
```

### Global install

```bash
npm install -g @memoss/cli
memoss --version

# Default vault at ~/.memoss-vault
memoss init
memoss ingest "https://example.com/article" --type web
memoss approve
memoss query "what does this article say about X?"
memoss graph
memoss mcp serve
```

### Configuration

| Path | Purpose |
|------|---------|
| `~/.memoss-vault` | Default vault when none is specified |
| `~/.memoss/config.yaml` | User-level shared config (model defaults, merged into vault config) |
| `MEMOSS_VAULT_PATH` | Override vault location |
| `MEMOSS_MCP_CAPABILITIES` | MCP tool levels: `agent`, `read`, `write`, or `full` |

Vault discovery order: `--vault` / `-C` → `MEMOSS_VAULT_PATH` → walk up from cwd → `~/.memoss-vault`.

### MCP in Cherry Studio

Use **STDIO** transport. Put the executable in **Command** and subcommands in **Arguments**:

| Field | Value |
|-------|-------|
| Command | `memoss` |
| Arguments | `mcp` / `serve` |
| Environment | `MEMOSS_VAULT_PATH=/path/to/vault` |

#### Agent tools (default)

By default, MCP exposes **agent** runners only:

| Tool | Use when |
|------|----------|
| `run_ingest` | Add a URL, file, or source to the knowledge base (extract + analyze + update pages). **Prefer this** when the user wants to ingest or save content. |
| `run_ingest_status` | Poll an async `run_ingest` job by `jobId`. |
| `run_extract` | Extract-only: write Markdown to `sources/extracted/`. Does **not** update the wiki. Use only when extraction alone is requested. |
| `run_query` | Ask questions against the knowledge base. Prefer this over calling `search_kb` directly. |
| `run_lint` | Check knowledge base health (contradictions, stale pages, broken links). |

`run_ingest` runs extract automatically when needed (`extract: auto`). For requests like *“add this URL to my knowledge base”*, the client should call **`run_ingest`**, not `run_extract`.

To expose low-level read/write tools:

```bash
memoss mcp serve --capabilities agent,read
memoss mcp serve --capabilities full
```

Full command reference: [docs/cli-reference.md](docs/cli-reference.md) · OKF format: [docs/okf-spec.md](docs/okf-spec.md)

---

## Architecture

```
apps/
└── cli/                    @memoss/cli     init · ingest · query · lint · approve · graph · mcp

packages/
├── core/                   @memoss/core    OKF · agents · tools · policies
├── mcp/                    @memoss/mcp-server
├── catalog-bridge/         @memoss/catalog-bridge   (Phase 2a — MaC sync)
└── search/                 @memoss/search           (Phase 2b — hybrid retrieval)

schema-packs/               personal · research · data-catalog templates
```

Phase 2 adds `apps/web/` (Next.js UI) and `apps/desktop/` (Obsidian-compatible vault + agent chat).

Built with:
- **Agent Engine** — Vercel AI SDK (multi-provider, type-safe tool calling)
- **Monorepo** — Nx + pnpm workspaces
- **Formats** — OKF (wiki) + MaC (catalog)
- **Language** — TypeScript

---

## Where This Comes From

Memoss productizes the convergence of two independent designs:

- **[Google knowledge-catalog](https://github.com/GoogleCloudPlatform/knowledge-catalog)** — OKF format, Metadata-as-Code sync, enrichment/discovery agents, MCP-first architecture.
- **[Karpathy's LLM Wiki Pattern](https://gist.githubusercontent.com/karpathy/442a6bf555914893e9891c11519de94f/raw/ac46de1ad27f92b28ac95459c782c07f6b8c964a/llm-wiki.md)** — Three-layer model (sources → wiki → schema), ingest/query/lint, interactive curation, Obsidian workflow.

One enterprise, one personal. Same architecture. **The pattern is validated. The category is undefined.**

---

## Roadmap

| Phase | Timeline | Focus |
|-------|----------|-------|
| **Phase 1a** | 0–4 months | CLI + core loop (ingest/query/lint), draft review, MCP, graph viewer |
| **Phase 1b** | 4–6 months | Web crawl ingest, provenance, lint health score, examples |
| **Phase 2a** | 6–12 months | Catalog bridge, enrich, sync, publish, data connectors |
| **Phase 2b** | 12–18 months | Discover, Desktop app, hybrid search, team PR workflow |
| **Phase 3** | 18+ months | Hosted platform, bundle marketplace, enterprise |

Full details: [Product Design v0.2](docs/product-design.md) · [Phase 1 Plan](docs/phase-1-plan.md) · [Phase 1 Technical Design](docs/phase-1-technical-design.md) · [CLI Reference](docs/cli-reference.md) · [OKF Spec](docs/okf-spec.md)

---

## Contributing

Memoss is in early development. See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines (coming soon).

---

## License

Memoss is open source under the [Apache License 2.0](LICENSE).
