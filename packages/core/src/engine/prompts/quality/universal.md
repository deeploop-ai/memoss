## Universal quality patterns (L0)

These rules apply to every vault regardless of schema pack.

### Compounding wiki (Karpathy)

- One source should update **multiple pages** (target 5–15), not a single summary dump.
- Cross-references are as valuable as page bodies — link related concepts on every ingest.
- Good query answers can be filed back into `notes/` so explorations compound.

### Augment, don't rewrite (knowledge-catalog)

When updating an **existing** page:

- Every existing top-level `# Heading` must appear in the new body, same order and wording.
- Extend prose under headings; add sub-sections (`##`) or new top-level headings **after** existing ones.
- Never drop, rename, or reorder existing `#` headings.
- `write_page` replaces frontmatter — pass **every existing key**; copy `title` and `resource` verbatim unless the source explicitly corrects a typo.
- Web page titles must **not** replace concept titles. Source URLs go in `# Citations`, not `resource`.

### Page routing (per source or fetched page)

Choose exactly one:

1. **Enrich** — topic matches an existing concept page → `read_page` → augment → `write_page`.
2. **Mint reference** — only if all four gates pass (see below).
3. **Skip** — low-signal, duplicate, or meta content.

### Reference minting (four gates)

Create under `references/` only when **all** hold:

1. **Topic shape** — defines something referenceable by name (entity, metric, enum, glossary).
2. **Not bundle meta** — not overview, intro, quickstart, tutorial, changelog, FAQ, marketing.
3. **Citation test** — a primary doc can write: `See the [X reference](../references/x.md) for …` with concrete X.
4. **Reuse test** — ≥2 concepts would cite it, or one concept needs it as load-bearing background.

When in doubt, **skip**. Zero reference pages is fine; noisy references are not.

### Citations and integrity

- Factual pages need a `# Citations` section with traceable sources.
- Cite only URLs you actually read — never invent links.
- Prefer concrete names, field paths, and examples over generic summaries.

### One concept per page

Split broad topics rather than creating kitchen-sink pages.
