# Memoss 知识库质量 — 待办与延后项

> 本文档记录 v2 质量方案中 **暂未实现** 或 **仅部分实现** 的优化项。  
> P0 已实现项见各模块代码与 `docs/product-design.md`。

**状态图例：** `[ ]` 未开始 · `[~]` 部分 · `[x]` 已完成

---

## P1 — 体验与领域扩展

### Schema Pack：`data-catalog`

- [x] `references/metrics/<slug>.md` 结构化提取（SQL 公式独立成页）
- [x] `references/joins/<a>__<b>.md` join path 参考页
- [x] 主概念页 `# Metrics` / `# Joins` 节模板与 lint 检查
- [x] GA4 ecommerce 示例 bundle（`examples/ga4-ecommerce/`）

### Query 复利增强

- [ ] `--format marp` 幻灯片输出
- [x] comparison table 专用模板（`--format comparison` / Shell 对比意图）
- [x] query 会话内「自动 save 高价值回答」启发式（`suggestSave`）

### Lint 进阶

- [x] provenance 过时检测接入 lint runner（config 已有 `stale_check_on_lint`）
- [~] 跨页矛盾检测（LLM 批处理，非确定性 — lint prompt 已引导）
- [~] `lint --fix` 对 orphan 页自动补链（prompt 已写，需更多 E2E 验证）
- [x] CI 门禁：`health_score < N` 时 exit non-zero（`--min-score` / exit 6）
- [x] `lint --report lint-report.json`

### Shell / TUI

- [~] 流式输出（query step 文本 delta；非 token 级）
- [x] 会话持久化到 `~/.memoss/sessions/<vault-hash>.json`（跨进程恢复）
- [x] Obsidian / 浏览器一键打开引用页
- [ ] 图片附件 ingest（Karpathy 本地下载图片工作流）
- [ ] 语音输入适配

### Extract / Crawl Skills

- [x] `extract_kind: web-crawl` 多页输出契约（`.meta.json` pages 数组）
- [x] 官方 crawl skill 示例（`schema-packs/data-catalog/.agents/skills/web-crawl/`）
- [x] TUI 自然语言解析 `max_pages` / `allowed_hosts`

---

## P2 — 企业级与发现

### Enrich Agent

- [ ] 单概念垂直 enrichment（schema 采样 + MCP 外部源）
- [ ] `memoss enrich --target <concept-id>`

### Discover Agent

- [ ] 语义分解 + 并行搜索 + rerank
- [ ] 外部 catalog connector（Dataplex 等）
- [ ] `memoss discover "<question>"`

### Bridge / Sync / Publish

- [ ] `memoss bridge mac-to-okf` / `okf-to-mac`
- [ ] mdcode 兼容 sync pull/push
- [ ] `memoss publish` 闭包打包 + viz.html

### 搜索

- [ ] 混合 BM25 + vector（>200 页自动切换）
- [ ] qmd 或内置 search index 集成

---

## P3 — 平台

- [ ] Context versioning（git-native A/B eval）
- [ ] Knowledge Bundle Market
- [ ] 团队 RBAC / audit log（SaaS）
- [ ] Hosted agents

---

## 技术债 / 重构

- [ ] `lightweight_model` 别名移除（major 版本）
- [ ] Shell Agent 工具集暴露为 MCP tools（与 CLI 同构）
- [ ] Policy 违规写入 structured lint-report
- [ ] Ingest 后自动 `instructions.md` 共演化提案（TUI「写入 schema？」）
- [ ] E2E 测试：mock model 全链路 ingest → approve → query

---

## 参考

- [product-design.md](./product-design.md)
- [Karpathy LLM Wiki Pattern](https://gist.githubusercontent.com/karpathy/442a6bf555914893e9891c11519de94f/raw/ac46de1ad27f92b28ac95459c782c07f6b8c964a/llm-wiki.md)
- [Google knowledge-catalog](https://github.com/GoogleCloudPlatform/knowledge-catalog)
