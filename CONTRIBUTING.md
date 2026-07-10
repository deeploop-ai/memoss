# Contributing to Memoss

Thank you for your interest in contributing to Memoss.

## Development setup

```bash
git clone https://github.com/deeploop-ai/memoss.git
cd memoss
pnpm install
pnpm nx build core cli mcp-server
```

Set an LLM API key for agent flows:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

## Common tasks

```bash
# Run all checks (lint, test, build, typecheck)
pnpm nx run-many -t lint test build typecheck

# Run core tests only
pnpm nx test core

# Run E2E tests
pnpm nx test core -- test/e2e/

# Build CLI
pnpm nx build cli
```

## Project structure

- `packages/core` — OKF model, agent engine, tools, policies, adapters
- `packages/mcp` — MCP server exposing core tools and agent runners
- `apps/cli` — `memoss` CLI and TUI shell
- `schema-packs/` — vault templates (personal, research, data-catalog)
- `docs/` — design docs and CLI reference

## Code guidelines

- Keep business logic in `@memoss/core`; CLI and MCP should be thin I/O layers.
- Match existing TypeScript style: strict mode, ESM, colocated `*.spec.ts` tests.
- Prefer minimal, focused diffs. Do not refactor unrelated code in the same PR.
- Run `pnpm nx format:check` before submitting.

## Pull requests

1. Fork and create a feature branch from `main`.
2. Add or update tests for behavior changes.
3. Ensure CI passes locally (`pnpm nx run-many -t lint test build typecheck`).
4. Describe what changed and why in the PR body.

## Reporting issues

Include: Memoss version (`memoss --version`), Node version, vault schema pack, reproduction steps, and expected vs actual behavior.

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
