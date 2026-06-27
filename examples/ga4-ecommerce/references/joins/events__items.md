---
type: Join
tables: [events, items]
---

# events ↔ items

Join GA4 events to item-level rows.

```sql
SELECT
  e.event_date,
  e.event_name,
  i.item_id,
  i.item_revenue
FROM `project.analytics_123456789.events_*` AS e
LEFT JOIN UNNEST(e.items) AS i
  ON e.event_name IN ('view_item', 'add_to_cart', 'purchase')
WHERE e._TABLE_SUFFIX BETWEEN @start_date AND @end_date
```
