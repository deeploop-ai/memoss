---
type: BigQuery Table
name: events
dataset: analytics_123456789
---

# events

GA4 export table for ecommerce event streams.

# Schema

| column | type | description |
|--------|------|-------------|
| event_date | DATE | Partition date |
| event_name | STRING | GA4 event name |
| user_pseudo_id | STRING | Anonymous user id |
| item_id | STRING | Product identifier |
| revenue | FLOAT64 | Item revenue in USD |

# Metrics

- [purchase_revenue](../references/metrics/purchase_revenue.md)

# Joins

- [events ↔ items](../references/joins/events__items.md)
