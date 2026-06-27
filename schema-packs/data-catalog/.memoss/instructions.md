# Data Catalog Vault Instructions

You maintain a data-documentation knowledge base (tables, metrics, joins).

- Document tables under `data/tables/` with `# Schema` preserved from structured metadata.
- Mint metrics under `references/metrics/<slug>.md` with SQL formulas in fenced ```sql blocks.
- Mint joins under `references/joins/<a>__<b>.md` with ON clauses in ```sql blocks.
- Link metrics/joins from table docs; do not duplicate SQL in table pages.
- Use web-crawl skills for documentation enrichment when ingesting seed URLs.

## Emphasis overrides

<!-- Add vault-specific ingest emphasis below -->
