# Memoss CLI Reference

Command-line interface for the Memoss knowledge runtime (`@memoss/cli`).

---

## Installation

From the monorepo (development):

```bash
pnpm install
pnpm nx build cli
```

Run via:

```bash
node apps/cli/dist/main.js <command>
# or after linking:
pnpm nx run cli:build && node apps/cli/dist/main.js status
```

Global install:

```bash
npm install -g @memoss/cli
memoss --version
```

The npm package is `@memoss/cli`; the executable on your PATH is still `memoss`.

---

## Vault discovery

Commands that operate on a vault resolve its root in this order:

1. `--vault` / `-C` flag
2. `MEMOSS_VAULT_PATH` environment variable
3. Walk up from the current directory looking for `.memoss/config.yaml`

---

## Commands

### `memoss init [path]`

Create a new vault from a schema pack.

| Flag | Default | Description |
|------|---------|-------------|
| `--pack` | `research` | `personal` or `research` |
| `--name` | directory name | Vault name in config |
| `--description` | `""` | Vault description |

```bash
memoss init ./my-knowledge --pack research
```

Creates `.memoss/config.yaml`, directory skeleton, `index.md`, `log.md`, and initializes git when available.

---

### `memoss ingest <source>`

Run the ingest agent on a source. Writes to a draft branch when `git.draft_branch` is enabled.

| Flag | Default | Description |
|------|---------|-------------|
| `--type` | `auto` | `auto`, `file`, `web`, or `github` |
| `--no-draft` | false | Write directly to the current branch |
| `--vault` / `-C` | auto | Vault root |

```bash
memoss ingest "https://example.com/article" --type web
memoss ingest ./paper.pdf --type file
memoss approve   # merge draft branch after review
```

Requires API keys configured in `.memoss/config.yaml` (`agent.default_model`).

---

### `memoss query <question>`

Search the knowledge base and synthesize a cited answer.

| Flag | Default | Description |
|------|---------|-------------|
| `--save` | false | Write answer as `type: Note` in `notes/` |
| `--model` | config | Override as `provider/model` |
| `--base-url` | — | OpenAI-compatible base URL override |

```bash
memoss query "What is the data pipeline architecture?"
memoss query "Compare batch vs streaming" --save
```

Uses `agent.lightweight_model` by default.

---

### `memoss lint`

Check vault health: contradictions, orphans, missing cross-refs, index gaps, provenance coverage.

| Flag | Default | Description |
|------|---------|-------------|
| `--fix` | false | Propose fixes on a draft branch |
| `--json` | false | JSON output (when supported) |
| `--report` | — | Write `lint-report.json` (see [lint-report schema](lint-report-schema.json)) |
| `--min-score` | — | Exit non-zero when `health_score` is below N |

The report JSON includes `provenance_coverage` (`sources_pct`, `verified_at_pct`) for M11 provenance tracking.

```bash
memoss lint
memoss lint --report lint-report.json
memoss lint --fix && memoss approve
```

Exit code `4` when error-level issues are found.

---

### `memoss approve`

Merge the active draft branch into the main branch (fast-forward when possible).

```bash
memoss approve
```

---

### `memoss reject`

Discard the draft branch without merging.

| Flag | Description |
|------|-------------|
| `--branch` | Specific draft branch name |

```bash
memoss reject
```

---

### `memoss status`

Show vault summary: page count, links, recent activity, git state.

| Flag | Description |
|------|-------------|
| `--json` | Machine-readable output |
| `--vault` / `-C` | Vault root |

```bash
memoss status
```

---

### `memoss view`

Generate an interactive knowledge graph and open it in the default browser.

| Flag | Default | Description |
|------|---------|-------------|
| `--no-open` | false | Generate HTML without opening browser |
| `--output` | `.memoss/viz.html` | Output path |
| `--vault` / `-C` | auto | Vault root |

```bash
memoss view
memoss view --no-open --output ./graph.html
```

Uses Cytoscape.js (CDN) for layout. Works offline for the vault data; CDN scripts require network on first load.

---

### `memoss serve`

Start the MCP server on stdio. Exposes all core tools plus `run_ingest`, `run_query`, and `run_lint`.

| Flag | Description |
|------|-------------|
| `--vault` / `-C` | Vault root |

**Claude Desktop example** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "memoss": {
      "command": "node",
      "args": ["/path/to/memoss/apps/cli/dist/main.js", "serve", "--vault", "/path/to/my-knowledge"]
    }
  }
}
```

---

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | User error (invalid args, vault not found) |
| 2 | Runtime error (API, I/O) |
| 3 | Agent did not complete (max steps) |
| 4 | Lint found error-level issues |

---

## Configuration

See `.memoss/config.yaml` created by `memoss init`. Key sections:

```yaml
name: my-knowledge
schema_pack: research

agent:
  default_model:
    provider: anthropic    # anthropic | openai
    model: claude-sonnet-4-6
  lightweight_model:
    provider: anthropic
    model: claude-haiku-4-5
  max_steps: 50

git:
  enabled: true
  draft_branch: true

search:
  strategy: auto
```

API keys are read from environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) or `api_key_env` in the model spec.

---

## Publishing (maintainers)

```bash
npm login
# Create the @memoss org on npmjs.com if publishing scoped libraries

pnpm publish:libs   # @memoss/core, @memoss/mcp-server
pnpm publish:cli    # @memoss/cli (bin: memoss; pulls @memoss/core + @memoss/mcp-server from npm)
```


- [Quickstart](../README.md#quickstart)
- [OKF Spec](okf-spec.md)
- [Phase 1 Plan](phase-1-plan.md)
