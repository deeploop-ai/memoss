# Memoss 文档状态索引

**最后核对：** 2026-06-30  
**代码基准：** `main` + M11 交付（Provenance 写回 + E2E）

> 本文档是各设计/计划文档的**单一事实来源（SSOT）** for 完成度与过期标记。  
> 实现细节以代码与测试为准；路线图冲突时 **以 [phase-2-plan.md](phase-2-plan.md) 为准**（2026-06-30 个人/小团队定位）。

**图例：** ✅ 已完成 · 🚧 进行中 · 📋 已规划 · ⚠️ 过期/被取代 · 📝 设计稿（未实现）

---

## 1. 文档清单

| 文档 | 角色 | 状态 | 说明 |
|------|------|------|------|
| [phase-1-plan.md](phase-1-plan.md) | Phase 1 实施计划 | ✅ **归档** | M0–M10 已全部交付；保留作历史与验收对照 |
| [phase-1-technical-design.md](phase-1-technical-design.md) | Phase 1 技术规格 | ✅ **有效** | 栈与模块 API 仍适用；部分 Phase 2 扩展见 phase-2-plan |
| [phase-2-plan.md](phase-2-plan.md) | Phase 2 实施计划（SSOT） | 🚧 **活跃** | M11 ✅；当前焦点 M12–M15 |
| [product-design.md](product-design.md) | 产品设计 v0.2 | ⚠️ **部分过期** | §9 Phase 2a 企业/catalog 叙事已被 phase-2-plan 取代 |
| [serial-read-design.md](serial-read-design.md) | Serial Read 设计 | 📝 **设计稿** | 实现未开始；对应 M12–M14 |
| [extraction-skills-design.md](extraction-skills-design.md) | Skills 提取设计 | ✅ **大部分已实现** | 核心 discovery/router/cache 已落地 |
| [quality-todo.md](quality-todo.md) | 质量待办 | 🚧 **活跃** | 跟踪 P1–P3 未完成项 |
| [review-20260627.md](review-20260627.md) | 静态评审报告 | ⚠️ **历史快照** | P0/P1 多数已在 M11 前/中修复；见 §12 跟进 |
| [cli-reference.md](cli-reference.md) | CLI 参考 | ✅ **有效** | 已含 `--report` / lint-report schema 链接 |
| [lint-report-schema.json](lint-report-schema.json) | lint-report JSON Schema | ✅ **有效** | M11.2.3 |
| [okf-spec.md](okf-spec.md) | OKF 规范摘要 | ✅ **有效** | — |

---

## 2. 里程碑完成度

### Phase 1（M0–M10）— ✅ 全部完成

| 里程碑 | 状态 |
|--------|------|
| M0 Scaffold | ✅ |
| M1 OKF Model | ✅ |
| M2 Store + Adapters | ✅ |
| M3 Tools + Policies | ✅ |
| M4 Agent Engine | ✅ |
| M5 CLI | ✅ |
| M6 MCP Server | ✅ |
| M7 Viewer + Docs | ✅ |
| M8 Web Crawl + Interactive | ✅ |
| M9 Provenance + Health Score | ✅（M11 增强 frontmatter 写回） |
| M10 Examples + Polish | ✅（`examples/ga4-ecommerce/`；research-topic 示例待确认） |

### Phase 2a

| 里程碑 | 状态 | 备注 |
|--------|------|------|
| **M11** Provenance + E2E | ✅ | 2026-06-30 关闭 |
| M12 Works 基础设施 | 📋 | `packages/core/src/works/` 未创建 |
| M13 Serial Read 编排 | 📋 | 依赖 M12 |
| M14 `memoss read` + MCP | 📋 | 依赖 M13 |
| M15 图片 ingest + 收尾 | 📋 | — |

### Phase 2b / 2c — 📋 未开始

M16–M20、Phase 2c 按需项均未实现。详见 [phase-2-plan.md](phase-2-plan.md)。

---

## 3. M11 任务核对（2026-06-30）

| ID | 状态 | 验证 |
|----|------|------|
| 11.1.1 ingest.md + frontmatter 示例 | ✅ | `packages/core/src/engine/prompts/ingest.md` |
| 11.1.2 augment `mergeAugmentSources` | ✅ | `policies/augment.ts` + `augment.spec.ts` |
| 11.1.3 write_page `verified_at` | ✅ | `tools/page-tools.ts` + `page-tools.spec.ts` |
| 11.1.4 ingestSourceId | ✅ | `ingest-runner.ts` + `tools/context.ts` |
| 11.1.5 data-catalog overlay | ✅ | `prompts/overlays/data-catalog.md` |
| 11.2.1 MISSING_SOURCES lint info | ✅ | `lint/checks.ts` |
| 11.2.2 lint --fix orphan E2E | ✅ | `test/e2e/lint-fix-orphan.spec.ts` + fixture |
| 11.2.3 provenance_coverage + schema | ✅ | `lint/report.ts` + `docs/lint-report-schema.json` |
| 11.3.1 mock-model | ✅ | `test/e2e/mock-model.ts` |
| 11.3.2 core-loop E2E | ✅ | `test/e2e/core-loop.spec.ts` |
| 11.3.3 provenance-stale E2E | ✅ | `test/e2e/provenance-stale.spec.ts` |
| 11.3.4 CI e2e job | ✅ | `.github/workflows/ci.yml` |
| 11.x provenance writeback 覆盖率 | ✅ | `test/e2e/provenance-writeback.spec.ts` |

**M11 退出标准：** 三项均已满足（见 phase-2-plan § M11）。

---

## 4. 评审报告跟进（review-20260627 → 2026-06-30）

| 原 P0/P1 项 | 状态 |
|-------------|------|
| E2E 全链路测试 | ✅ M11 |
| `parseModelOverride` 错误码 | ✅ `INVALID_ARGUMENT` |
| `runAgentLoop` 异常捕获 | ✅ `orchestrator.ts` |
| ESLint CLI→MCP | ✅ `eslint.config.mjs` 允许 `scope:mcp` |
| `search_kb` 结果上限 | ✅ `DEFAULT_MAX_RESULTS=50` |
| CONTRIBUTING.md | 📋 仍缺 |
| 废弃 API 清理 | 📋 `lightweight_model` / `legacyShrinkWarning` 仍在 |
| API 文档 (TSDoc) | 📋 仍缺 |
| lint 相对链接 orphan 检测 | ⚠️ 已知限制：同目录 `(foo.md)` 与 vault 路径 `topics/foo.md` 不对齐 |

---

## 5. 过期 / 需同步章节

| 位置 | 问题 | 处置 |
|------|------|------|
| **product-design.md §9 Phase 2a** | 仍以「Catalog Bridge & Enrich / BigQuery connectors」为主叙事 | ⚠️ 被 [phase-2-plan.md §1.2 非目标](phase-2-plan.md#12-非目标phase-2-明确不做) 取代；阅读路线图时以 phase-2-plan 为准 |
| **product-design.md §9 Phase 2b** | Desktop/Web 时间线 | 📋 phase-2-plan 推迟大 UI 至 2b 末期评估 |
| **phase-1-plan.md** | 日期 2026-06-23，checkbox 未勾选 | ✅ 已标记 M0–M10 完成（归档） |
| **serial-read-design.md §1.2** | 「本文档仅设计，不实现」 | 📝 仍准确；M12 起开始实现 |
| **review-20260627.md** | 静态快照 | ⚠️ 待改进项 § 多数已修复；勿作当前 backlog |
| **README Phase badge** | 仍显示 phase-1a | ✅ 已更新为 phase-2a |

---

## 6. quality-todo 摘要（仍开放）

| 类别 | 开放项 |
|------|--------|
| P1 | `--format marp`、图片 ingest、语音输入、跨页矛盾 LLM lint |
| P2 | discover / enrich / publish / hybrid search / bridge |
| P3 | RBAC、Bundle Market、Hosted agents |
| 技术债 | 废弃别名移除、Shell→MCP 工具、policy→lint-report、instructions 共演化 |

完整列表：[quality-todo.md](quality-todo.md)

---

## 7. 相关命令

```bash
# 全量 core 测试
pnpm nx test core

# 仅 E2E（CI 同款）
pnpm nx test core -- test/e2e/

# lint-report schema
# 见 docs/lint-report-schema.json
```
