---
type: Metric
name: purchase_revenue
---

# purchase_revenue

Total revenue from `purchase` events.

```sql
SELECT
  SUM(ecommerce.purchase_revenue_in_usd) AS purchase_revenue
FROM `project.analytics_123456789.events_*`
WHERE event_name = 'purchase'
  AND _TABLE_SUFFIX BETWEEN @start_date AND @end_date
```
