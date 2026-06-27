---
name: web-crawl
description: Multi-page web crawl into a directory of markdown files with URL sidecars.
compatibility: Requires crawl4ai or firecrawl CLI on PATH
---

# Web Crawl

Use for **site-wide** extraction when the user asks to crawl, spider, or scrape multiple pages.

## Output contract

1. Create a directory under the vault extract output dir named after the source slug.
2. Write one `.md` file per fetched page.
3. For each page, write `<page>.url.txt` beside the markdown with the canonical URL.
4. Respect `max_pages` and `allowed_hosts` from the extract prompt.
5. Do not merge pages into a single file — the ingest agent expects a directory.

## Suggested CLI

```bash
# crawl4ai (example)
crawl4ai crawl <seed-url> --max-pages N --output-dir <dir>

# firecrawl (example)
firecrawl crawl <seed-url> --limit N
```

After crawling, ensure the parent `.meta.json` can list all pages via the pages array.
