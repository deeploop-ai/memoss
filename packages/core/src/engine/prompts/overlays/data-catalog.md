## Schema pack overlay: data-catalog

- Table/dataset docs: preserve `# Schema` from structured metadata — never shrink field listings during augment.
- **Metrics** with SQL: mint `references/metrics/<slug>.md` (definition + fenced SQL); link from table docs without duplicating SQL.
- **Join paths**: mint `references/joins/<a>__<b>.md` with ON clause; link from both table docs.
- **Dimensions**: extend owning table `# Schema` or add `# Dimensions` — do not invent columns.
