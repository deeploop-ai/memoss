# Memoss

> **像苔藓一样自然生长的记忆。**
>
> *Your file system is your knowledge base. Agents do the reading, writing, maintenance, and cross-referencing.*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Phase](https://img.shields.io/badge/phase-1-yellow.svg)](docs/phase-1-plan.md)

---

## What is Memoss?

Memoss is an **AI-native knowledge infrastructure** — a system where LLM agents continuously build and maintain a living knowledge base from your raw sources (documents, web pages, data schemas, code, conversations), stored as plain Markdown files on your file system.

Unlike traditional wikis where **humans do the bookkeeping** (and it goes stale), or RAG systems where knowledge is **re-derived from scratch** on every query — in Memoss, **agents do the maintenance**, and knowledge is **compiled once, kept current, and always ready**.

### The Core Idea

```
You drop sources. Agents build knowledge. You ask questions. Agents keep it alive.
```

- **Ingest** — Drop a URL, file, or repo. The agent reads it, extracts knowledge, updates every related page, and commits.
- **Query** — Ask a question. The agent searches the knowledge base, synthesizes an answer with citations, and can file the answer back as a new page.
- **Lint** — The agent proactively checks for contradictions, stale claims, orphan pages, and missing links. Knowledge stays healthy.

### Why Markdown Files?

Because **Markdown is the only format that is readable by humans, parseable by agents, and diffable in git** — all without tooling. Memoss uses the [Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) (OKF) — Markdown + YAML frontmatter — as its knowledge representation. You can `cat` a file, `grep` a concept, `git diff` a change. No proprietary database. No lock-in.

---

## Quickstart (Coming Soon)

```bash
# Install
npm install -g memoss

# Create a knowledge base
memoss init ./my-knowledge

# Ingest your first source
memoss ingest "https://example.com/article" --type web

# Ask a question
memoss query "what does this article say about X?"

# Check knowledge base health
memoss lint

# Start MCP server for other AI agents
memoss serve
```

---

## Architecture

```
apps/
└── cli/              @memoss/cli           CLI (init, ingest, query, lint, serve)

packages/
├── core/             @memoss/core          OKF parser, agent engine, tool registry
└── mcp/              @memoss/mcp-server     MCP server for external agent consumption
```

Phase 2 adds `apps/web/` (Next.js UI) and `apps/desktop/` (Electron wrapper).

Built with:
- **Agent Engine** — Vercel AI SDK (multi-provider, type-safe tool calling)
- **Monorepo** — Nx + pnpm workspaces
- **Format** — OKF (Markdown + YAML frontmatter)
- **Language** — TypeScript

---

## Where This Comes From

Memoss sits at the convergence of two independent designs that arrived at the same architecture:

- **[Google knowledge-catalog](https://github.com/GoogleCloudPlatform/knowledge-catalog)** — OKF format spec, agent-driven metadata enrichment, MCP-first architecture, Metadata as Code. Built by Google's Dataplex team for enterprise data catalogs.
- **[Karpathy's LLM Wiki Pattern](https://gist.githubusercontent.com/karpathy/442a6bf555914893e9891c11519de94f/raw/ac46de1ad27f92b28ac95459c782c07f6b8c964a/llm-wiki.md)** — Three-layer architecture (sources → wiki → schema), ingest/query/lint operations, "the LLM writes, you read it."

One enterprise, one personal. Same architecture. **The pattern is validated. The category is undefined.**

---

## Roadmap

| Phase | Timeline | Focus |
|-------|----------|-------|
| **Phase 1** | 0–6 months | CLI + Core Engine. Open-source single-user validation. |
| **Phase 2** | 6–18 months | Desktop app + team collaboration + connector ecosystem. |
| **Phase 3** | 18+ months | Hosted platform + knowledge bundle marketplace + enterprise. |

Full details: [Product Design Document](docs/product-design.md) · [Phase 1 Plan](docs/phase-1-plan.md)

---

## Contributing

Memoss is in early development. See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines (coming soon).

---

## License

[Apache 2.0](LICENSE)
