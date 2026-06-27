# GA4 Ecommerce — Memoss data-catalog example

Skeleton bundle demonstrating `data/` tables, `references/metrics/`, and `references/joins/` layout aligned with [Google knowledge-catalog](https://github.com/GoogleCloudPlatform/knowledge-catalog) GA4 patterns.

## Layout

```
data/tables/events.md          — BigQuery table doc with # Schema
references/metrics/purchase_revenue.md
references/joins/events__items.md
```

## Try it

```bash
memoss init ./ga4-vault --pack data-catalog --name "GA4 Ecommerce"
cp -r examples/ga4-ecommerce/* ./ga4-vault/
memoss lint -C ./ga4-vault
```

Expected: deterministic lint passes; metric/join SQL blocks are present.
