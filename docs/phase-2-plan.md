# Memoss — Phase 2 开发计划（个人与小团队）

> **文档状态：** 🚧 **活跃** — M11 ✅ 已完成（2026-06-30）；**当前焦点 M12**（Works 基础设施）。  
> 完成度索引：[DOC-STATUS.md](DOC-STATUS.md)

**日期：** 2026-06-30  
**周期：** 6–14 个月（Phase 2a：0–8 周 · Phase 2b：8–20 周 · Phase 2c：按需）  
**定位：** 个人研究者、独立开发者、5–15 人小团队 — **不**以企业数据目录 / Dataplex 同步为主叙事  

**北极星指标：** 7 天内发生第二次主动 `ingest` / `read` 的用户占比  

> 上下文：[产品设计 v0.2](product-design.md) · [Phase 1 计划](phase-1-plan.md) · [Serial Read 设计](serial-read-design.md) · [质量待办](quality-todo.md)

---

## 1. 目标与非目标

### 1.1 Phase 2 要解决的问题

Phase 1 已验证 **Ingest → Query → Lint → Approve** 核心环。Phase 2 解决三类真实瓶颈：

| 瓶颈 | 用户场景 | Phase 2 答案 |
|------|----------|--------------|
| **读不进** | 整本书、几百页 PDF、系列文章 | `memoss read`（Serial Read 编排） |
| **信不过** | vault 变大后不敢 approve；溯源断裂 | Provenance 写回闭环 + E2E + lint 加固 |
| **查不准 / 分不出** | >100 页检索漏页；想分享给队友 | Local Discover + 混合检索 + `publish` |

### 1.2 非目标（Phase 2 明确不做）

| 项目 | 原因 | 归属 |
|------|------|------|
| `@memoss/catalog-bridge` / mdcode sync | 个人用户无 Dataplex；小团队用 Git 即可 | Phase 3+ 或按需分支 |
| Dataplex / BigQuery 实时连接器 | 企业基础设施依赖 | Phase 3 可选 |
| RBAC / 审计日志 / 托管 SaaS | 超出小团队刚需 | Phase 3 |
| Web UI / Desktop 应用 | 核心环未稳前不做大 UI 投入 | Phase 2b 末期评估 |
| Context A/B eval 平台 | 先有本地 retrieval eval 即可 | Phase 2b 最小集 |

### 1.3 与 Google Knowledge Catalog 的关系

- **继承：** OKF 格式、专用 Agent 边界、MCP 出口、metrics/joins 参考页约定  
- **不竞争：** always-on 元数据采集、IAM 检索、血缘治理、Data Products 控制面  
- **定位句：** *Memoss 是 Agent 知识编译运行时；OKF 是与 KC 生态互操作的格式，不是 GCP KC Cloud 的开源替代。*

---

## 2. 交付物总览

### Phase 2a（0–8 周）— 读得进 + 信得过

| 交付 | 包/路径 | 用户可见 | 状态 |
|------|---------|----------|------|
| Provenance 写回闭环 | ingest prompt + policies | 页 frontmatter 含 `sources` / `verified_at` | ✅ M11 |
| E2E 信任测试 | `packages/core/test/e2e/` | CI 全链路绿 | ✅ M11 |
| Serial Read 编排 | `packages/core/src/works/` | `memoss read` | 📋 M12–M14 |
| 书级 Tuning | `packages/core/src/engine/book-tuning-runner.ts` | 整书 ingest 质量 | 📋 M13 |
| 图片附件 ingest | extract skill + ingest 适配 | 本地图片进 vault | 📋 M15 |
| MCP `run_read` | `packages/mcp/` | Cherry Studio 长文入库 | 📋 M14 |

### Phase 2b（8–20 周）— 查得准 + 分得出去

| 交付 | 包/路径 | 用户可见 |
|------|---------|----------|
| Local Discover | `packages/core/src/engine/discover-runner.ts` | `memoss discover` |
| 混合检索 | `packages/search/` | 大 vault 自动增强检索 |
| Publish bundle | `packages/core/src/publish/` | `memoss publish` |
| Retrieval eval（最小） | `packages/core/test/eval/` | `memoss eval retrieval` |
| Query save UX | TUI + shell | 高价值回答一键写回 |

### Phase 2c（按需，不阻塞主线）— 数据文档用户

| 交付 | 条件 | 用户可见 |
|------|------|----------|
| Golden queries | `data-catalog` pack 有明确需求 | `references/queries/` |
| `memoss enrich --target` | 用户反馈单表深化刚需 | 单资产 enrich |

---

## 3. 里程碑时间线

```
Phase 2a（Week 1–8）— 信任 + 长文
──────────────────────────────────
M11: Provenance 写回 + E2E           (W1–2)  ✅ 已完成
M12: Works 基础设施                  (W2–3)  ← 当前
M13: Serial Read 核心编排            (W3–5)
M14: memoss read CLI + MCP           (W5–6)
M15: 图片 ingest + 体验收尾          (W6–8)

Phase 2b（Week 9–20）— 检索 + 分享
──────────────────────────────────
M16: Local Discover                  (W9–11)
M17: 混合检索 @memoss/search         (W11–14)
M18: memoss publish                  (W14–16)
M19: Retrieval eval + Query UX       (W16–18)
M20: 文档 + 示例 + Phase 2 收尾      (W18–20)
```

依赖关系：M11 可与 M12 并行；M13 依赖 M12；M14 依赖 M13；M16–M18 可部分并行。

---

## 4. Phase 2a — 详细任务分解

### Milestone 11：Provenance 写回闭环 + E2E（Week 1–2）✅ 已完成

**目标：** 用户 approve 前能信任 Agent 写出的页与源之间的可追溯关系；CI 覆盖核心环。

#### 11.1 Ingest Agent 写回 frontmatter

| 状态 | ID | 任务 | 文件 | 验收标准 |
|------|----|------|------|----------|
| ✅ | 11.1.1 | 更新 `ingest.md`：要求每次 `write_page` 写入 `sources` 数组 | `packages/core/src/engine/prompts/ingest.md` | prompt 含示例 frontmatter |
| ✅ | 11.1.2 | 更新 `augment` 策略：更新页时合并而非覆盖 `sources` | `packages/core/src/policies/augment.ts` | 单测：旧 sources 保留 + 新 source 追加 |
| ✅ | 11.1.3 | `write_page` 工具：自动填充 `verified_at`（ISO 时间） | `packages/core/src/tools/page-tools.ts` | agent 不写时工具层补全 |
| ✅ | 11.1.4 | ingest runner 传入 `source_id` 到 tool context | `packages/core/src/engine/ingest-runner.ts` | manifest 注册后 ID 可用 |
| ✅ | 11.1.5 | `data-catalog` overlay 同步要求 `# Citations` + sources | `packages/core/src/engine/prompts/overlays/data-catalog.md` | GA4 示例 ingest 后 frontmatter 合规 |

#### 11.2 Lint 与 provenance 对齐

| 状态 | ID | 任务 | 文件 | 验收标准 |
|------|----|------|------|----------|
| ✅ | 11.2.1 | 缺 `sources` 的 agent 新页 → lint `info`（非 error，避免旧 vault 爆炸） | `packages/core/src/lint/checks.ts` | 可 `--min-score` 配置是否升级 |
| ✅ | 11.2.2 | `lint --fix` orphan 补链：prompt 强化 + E2E 样例 | `packages/core/src/engine/prompts/lint.md` | 固定 fixture vault 跑通 |
| ✅ | 11.2.3 | `lint-report.json` 输出 `provenance_coverage` 指标 | `packages/core/src/lint/vault-lint.ts` | JSON schema 文档化 |

#### 11.3 E2E 测试（mock model）

| 状态 | ID | 任务 | 文件 | 验收标准 |
|------|----|------|------|----------|
| ✅ | 11.3.1 | Mock LLM provider：确定性 tool-call 序列 | `packages/core/test/e2e/mock-model.ts` | 可注入 ingest/query/lint |
| ✅ | 11.3.2 | 场景：web ingest → draft → approve → query 命中新页 | `packages/core/test/e2e/core-loop.spec.ts` | `pnpm nx test core -- test/e2e/` 绿 |
| ✅ | 11.3.3 | 场景：re-ingest 同 URL hash 变化 → lint stale 警告 | `packages/core/test/e2e/provenance-stale.spec.ts` | `STALE_VERIFIED_AT` 出现 |
| ✅ | 11.3.4 | CI workflow 加入 e2e job | `.github/workflows/` | PR 必跑 |

**M11 退出标准：**

- [x] 新 ingest 的页 100% 含 `verified_at`；90%+ 含 `sources`
- [x] E2E core-loop 在 CI 稳定通过（3 次连续绿）
- [x] `quality-todo.md` P0 E2E 项标记完成

---

### Milestone 12：Works 基础设施（Week 2–3）📋 未开始

**目标：** Work Manifest 读写、章节拆分、状态持久化 — 无 LLM 的确定性层。

> 设计细节：[Serial Read 设计 §4–6](serial-read-design.md)

#### 12.1 Work Manifest

| ID | 任务 | 文件 | 验收标准 |
|----|------|------|----------|
| 12.1.1 | 定义 `WorkManifest` / `ChapterEntry` TypeScript 类型 | `packages/core/src/works/types.ts` | Zod schema 校验 |
| 12.1.2 | `loadWorkManifest` / `saveWorkManifest` | `packages/core/src/works/manifest.ts` | 读写 `sources/works/<id>.yaml` |
| 12.1.3 | 可选 sidecar `.memoss/works/<id>.state.json` | `packages/core/src/works/state.ts` | 长跑任务不频繁 rewrite yaml |
| 12.1.4 | `initWorkManifest`：从 CLI 参数生成初始 manifest | `packages/core/src/works/init.ts` | `--init-work` 可用 |
| 12.1.5 | 单测：manifest round-trip + 非法 schema 拒绝 | `packages/core/src/works/manifest.spec.ts` | 覆盖率 >90% |

#### 12.2 章节拆分 `splitChapters`

| ID | 任务 | 文件 | 验收标准 |
|----|------|------|----------|
| 12.2.1 | `heading` 策略：按 regex 切分 | `packages/core/src/works/split-chapters.ts` | fixture：3 章输入 → 3 文件 |
| 12.2.2 | `files` 策略：扫描目录注册 chapters | 同上 | crawl 多页输出可直接注册 |
| 12.2.3 | `toc` 策略（P1）：解析目录区块 | 同上 | 至少 1 个真实书籍 fixture |
| 12.2.4 | `minChars` / `maxChars` 二次切分 | 同上 | 超长章按段落切 |
| 12.2.5 | 输出更新 manifest `chapters[]` | 同上 | 每章含 id/title/path/status |

#### 12.3 Vault 配置扩展

| ID | 任务 | 文件 | 验收标准 |
|----|------|------|----------|
| 12.3.1 | `works` 配置段默认值 | `packages/core/src/config/vault-config.ts` | `default_max_steps`、`commit_every` |
| 12.3.2 | schema pack `personal` / `research` 补充 works 说明 | `schema-packs/*/README.md` | 用户知道放 PDF 路径 |

**M12 退出标准：**

- [ ] `splitChapters({ strategy: 'heading' })` 对测试 PDF/MD 产出预期章节数
- [ ] manifest 可 resume：记录 `completed_chapters` / `failed_chapters`

---

### Milestone 13：Serial Read 核心编排（Week 3–5）

**目标：** `runSerialIngest` 串联 extract → split → plan → ingest × N → finalize。

#### 13.1 书级 Tuning `runBookTuning`

| ID | 任务 | 文件 | 验收标准 |
|----|------|------|----------|
| 13.1.1 | 新增 prompt `book-tuning.md` | `packages/core/src/engine/prompts/book-tuning.md` | 只读；输出 overlay + proposed_pages |
| 13.1.2 | `runBookTuning` runner | `packages/core/src/engine/book-tuning-runner.ts` | 输入：manifest + TOC/首章 16KB + list_pages |
| 13.1.3 | 输出 `qualityOverlay` 缓存到 `.memoss/works/<id>.overlay.md` | `packages/core/src/works/overlay.ts` | 后续章 ingest 注入 |
| 13.1.4 | 创建空 `synthesis_page` 骨架（若不存在） | book-tuning-runner | frontmatter 合规 |
| 13.1.5 | 单测：mock model 返回固定 overlay | `book-tuning-runner.spec.ts` | 不调用真实 API |

#### 13.2 `runSerialIngest` 编排器

| ID | 任务 | 文件 | 验收标准 |
|----|------|------|----------|
| 13.2.1 | 实现 `SerialIngestOptions` / `SerialIngestReport` | `packages/core/src/works/serial-ingest-runner.ts` | 接口同 [serial-read-design §5.1](serial-read-design.md) |
| 13.2.2 | 阶段 `extract`：条件调用 `runExtract` | 同上 | cache 命中跳过 |
| 13.2.3 | 阶段 `split`：调用 `splitChapters` | 同上 | 更新 manifest |
| 13.2.4 | 阶段 `plan`：调用 `runBookTuning`（尊重 `skip_tuning`） | 同上 | `after_first` 默认 |
| 13.2.5 | 阶段 `ingest`：循环 `runIngest` per chapter | 同上 | `noExtract: true`, emphasis 模板渲染 |
| 13.2.6 | 阶段 `finalize`：`regenerateIndexes` + 可选 git commit | 同上 | 与 `commit_every` 策略一致 |
| 13.2.7 | Draft 分支：`memoss/draft/read-<work>-<ts>` | 同上 | 复用 `SimpleGitAdapter` |
| 13.2.8 | Resume / retryFailed / stopOnError 语义 | 同上 | 单测覆盖 |
| 13.2.9 | `onChapterStart` / `onChapterComplete` 回调 | 同上 | CLI 进度条可用 |

#### 13.3 Ingest prompt 扩展

| ID | 任务 | 文件 | 验收标准 |
|----|------|------|----------|
| 13.3.1 | `ingest.md` 增加 `{{serial_context}}` 块 | `packages/core/src/engine/prompts/ingest.md` | 串行 ingest 时注入章序号 |
| 13.3.2 | ingest-runner 传入 serial 上下文 | `packages/core/src/engine/ingest-runner.ts` | 单次 ingest 行为不变 |

#### 13.4 集成测试

| ID | 任务 | 文件 | 验收标准 |
|----|------|------|----------|
| 13.4.1 | Fixture：10 章短 MD 书 + mock ingest | `packages/core/test/e2e/serial-read.spec.ts` | 10 章 complete；synthesis 页更新 |
| 13.4.2 | Resume：中断后重跑跳过 complete 章 | 同上 | 仅跑剩余章 |
| 13.4.3 | 示例 `examples/short-book/` | `examples/short-book/` | README 可复现 |

**M13 退出标准：**

- [ ] `runSerialIngest({ phase: 'auto' })` 对 10 章 fixture 全书完成
- [ ] draft 分支上概念页交叉链接可 `memoss graph` 可视化
- [ ] 失败章记入 `failed_chapters`，`--retry-failed` 可重跑

---

### Milestone 14：`memoss read` CLI + MCP（Week 5–6）

**目标：** 产品层暴露 Read 操作；MCP 支持异步长任务。

#### 14.1 CLI 命令

| ID | 任务 | 文件 | 验收标准 |
|----|------|------|----------|
| 14.1.1 | `memoss read <source> --work <id>` | `apps/cli/src/commands/read.ts` | 调用 `runSerialIngest` |
| 14.1.2 | Flags：`--phase` `--resume` `--retry-failed` `--dry-run` `--init-work` | 同上 | 与 design §9.1 一致 |
| 14.1.3 | `--init-work` 从 PDF/路径自动创建 manifest | 同上 | 合理默认 split=heading |
| 14.1.4 | 进度输出：章 N/M + 当前阶段 | 同上 | TUI 与非 TUI 均可读 |
| 14.1.5 | 注册到 citty 命令树 | `apps/cli/src/main.ts` | `memoss read --help` |
| 14.1.6 | CLI 参考文档 | `docs/cli-reference.md` | 含示例 |

#### 14.2 MCP

| ID | 任务 | 文件 | 验收标准 |
|----|------|------|----------|
| 14.2.1 | `run_read` / `run_read_status` schema | `packages/mcp/src/mcp-tools.ts` | async 默认 true |
| 14.2.2 | Job type 扩展 `'read'` | `packages/mcp/src/mcp-jobs.ts` | 状态含 chapter 进度 |
| 14.2.3 | MCP capabilities：read 归入 agent 级 | `packages/mcp/src/capabilities.ts` | 默认暴露 |
| 14.2.4 | MCP 单测 | `packages/mcp/src/mcp-jobs.spec.ts` | mock serial ingest |

#### 14.3 Shell REPL

| ID | 任务 | 文件 | 验收标准 |
|----|------|------|----------|
| 14.3.1 | `executeShellTask` 支持 `read` task | `packages/core/src/shell/dispatch.ts` | 自然语言「读这本书」可路由 |
| 14.3.2 | Shell prompt 补充 read 说明 | `packages/core/src/engine/prompts/shell.md` | — |

**M14 退出标准：**

- [ ] `memoss read ./book.pdf --work test --init-work` 端到端（真实 API 或 mock）
- [ ] Cherry Studio 调 `run_read` + 轮询 status 成功
- [ ] README_ZH 快速开始含 read 示例

---

### Milestone 15：图片 ingest + Phase 2a 收尾（Week 6–8）

**目标：** Obsidian/Karpathy 式图片笔记；修补体验毛刺。

#### 15.1 图片附件

| ID | 任务 | 文件 | 验收标准 |
|----|------|------|----------|
| 15.1.1 | 本地图片 copy 到 `sources/raw/images/<hash>.<ext>` | `packages/core/src/adapters/source-image.ts` | 去重 |
| 15.1.2 | Extract skill 或内置：图片 → 描述 MD（vision model） | `schema-packs/personal/.agents/skills/image-describe/` | 可选 skill |
| 15.1.3 | Ingest `kind: image` 路由 | `packages/core/src/engine/ingest-runner.ts` | CLI `ingest ./photo.png` |
| 15.1.4 | 概念页嵌入相对路径图片链接 | ingest prompt | Obsidian 可显示 |
| 15.1.5 | 配置：`ingest.images.vision_model` | `vault-config.ts` | 默认用 lightweight 或关闭 |

#### 15.2 Query save UX

| ID | 任务 | 文件 | 验收标准 |
|----|------|------|----------|
| 15.2.1 | TUI：`suggestSave` 时 `[Y/n]` 一键写回 | `apps/cli/src/tui/` | 无需重新敲 query |
| 15.2.2 | `run_query` 返回 `suggestedSavePath` | `packages/core/src/engine/query-runner.ts` | MCP 客户端可提示 |

#### 15.3 文档与发布

| ID | 任务 | 文件 | 验收标准 |
|----|------|------|----------|
| 15.3.1 | 更新 `quality-todo.md` Phase 2a 项 | `docs/quality-todo.md` | — |
| 15.3.2 | README / README_ZH Phase 徽章 → 2a | 根目录 | — |
| 15.3.3 | `examples/short-book/` _walkthrough | `examples/short-book/README.md` | <15 分钟可跑通 |

**M15 / Phase 2a 总退出标准：**

- [ ] 真实用户路径：PDF 书 → read → approve → query 跨章问题 → 有引用
- [ ] 图片 ingest 至少 1 个 e2e fixture
- [ ] 所有 M11–M15 单测 + e2e CI 绿

---

## 5. Phase 2b — 详细任务分解

### Milestone 16：Local Discover（Week 9–11）

**目标：** 不接外部 catalog，增强大 vault 上的「找对页」能力；可作为 `query` 前置。

#### 16.1 Discover Runner

| ID | 任务 | 文件 | 验收标准 |
|----|------|------|----------|
| 16.1.1 | `discover.md` system prompt | `packages/core/src/engine/prompts/discover.md` | 分解为 ≤3 变体 + baseline |
| 16.1.2 | `runDiscover`：分解 → 并行 `search_kb` → 去重 | `packages/core/src/engine/discover-runner.ts` | 无外部 API |
| 16.1.3 | LLM rerank：top-K 页 + 理由 | 同上 | 默认 K=10 |
| 16.1.4 | 输出 `DiscoverResult { queries, hits[], ranked[] }` | 同上 | JSON 可序列化 |
| 16.1.5 | `memoss discover "<q>"` CLI | `apps/cli/src/commands/discover.ts` | 人类可读 + `--json` |
| 16.1.6 | `memoss query --discover` 链式调用 | query command | 先 discover 再 query |
| 16.1.7 | MCP `run_discover` | `packages/mcp/` | agent 级工具 |

#### 16.2 性能与阈值

| ID | 任务 | 文件 | 验收标准 |
|----|------|------|----------|
| 16.2.1 | `list_pages` 计数 > 阈值时 query 默认 `--discover` | `vault-config.ts` | 默认阈值 80，可关 |
| 16.2.2 | discover 分解用 lightweight model | discover-runner | 成本可控 |

**M16 退出标准：**

- [ ] 200 页 fixture vault：discover 召回率优于单次 search_kb（eval 集验证）
- [ ] `memoss discover` P95 < 30s（本地 grep，不含 rerank LLM）

---

### Milestone 17：混合检索 `@memoss/search`（Week 11–14）

**目标：** vault >200 页时自动 BM25 + vector，用户无感切换。

#### 17.1 包脚手架

| ID | 任务 | 文件 | 验收标准 |
|----|------|------|----------|
| 17.1.1 | Nx lib `packages/search` | `packages/search/` | `pnpm nx build search` |
| 17.1.2 | 依赖：`@memoss/core` 只读 vault 路径 | `package.json` | 无循环依赖 |
| 17.1.3 | 索引存储：`.memoss/search-index/` | `packages/search/src/index-store.ts` | gitignore 文档化 |

#### 17.2 索引实现

| ID | 任务 | 文件 | 验收标准 |
|----|------|------|----------|
| 17.2.1 | BM25：基于 `fast-glob` + 倒排 | `packages/search/src/bm25.ts` | 单测 |
| 17.2.2 | Vector：本地 embedding（OpenAI / 可选 Ollama） | `packages/search/src/vector.ts` | 配置 `search.embedding` |
| 17.2.3 | `buildIndex(vaultRoot)` 全量 | `packages/search/src/build.ts` | ingest/approve 后可重建 |
| 17.2.4 | `hybridSearch(query, opts)` RRf 融合 | `packages/search/src/hybrid.ts` | top-20 结果 |
| 17.2.5 | 增量更新 hook（approve 后） | `packages/core` ingest 回调 | 可选 `--search-incremental` |

#### 17.3 集成

| ID | 任务 | 文件 | 验收标准 |
|----|------|------|----------|
| 17.3.1 | `search_kb` 工具：超阈值走 hybrid | `packages/core/src/tools/search-kb.ts` | 配置 `search.mode: auto` |
| 17.3.2 | `memoss index rebuild` CLI | `apps/cli/src/commands/index.ts` | 手动重建 |
| 17.3.3 | lint：索引陈旧检测（可选 warning） | `packages/core/src/lint/checks.ts` | mtime 比对 |

**M17 退出标准：**

- [ ] 500 页 synthetic vault：hybrid 召回@10 优于纯 grep（固定 eval 集）
- [ ] 无 embedding API 时降级为 BM25-only，不 crash

---

### Milestone 18：`memoss publish`（Week 14–16）

**目标：** 小团队通过 git / zip 分享自包含知识 bundle。

#### 18.1 Publish 核心

| ID | 任务 | 文件 | 验收标准 |
|----|------|------|----------|
| 18.1.1 | `computeClosure(scope)`：BFS 跨链引用 | `packages/core/src/publish/closure.ts` | 无悬空 link |
| 18.1.2 | `publishBundle(opts)` 复制闭包 + sources 子集 | `packages/core/src/publish/bundle.ts` | 可 `--include-sources` |
| 18.1.3 | 重写相对链接（可选扁平化） | `packages/core/src/publish/rewrite-links.ts` | 单测 |
| 18.1.4 | 生成 `bundle.yaml` manifest | `packages/core/src/publish/manifest.ts` | 含 version、created_at、scope |
| 18.1.5 | 附带 `viz.html`（复用 graph viewer） | 调用 `viewer/generate.ts` | 零依赖打开 |
| 18.1.6 | `memoss publish --scope topics/foo --output ./dist/foo-bundle` | `apps/cli/src/commands/publish.ts` | — |
| 18.1.7 | `--tag` 过滤 frontmatter tags | publish command | 多主题打包 |

#### 18.2 轻量 Data Product manifest（可选）

| ID | 任务 | 文件 | 验收标准 |
|----|------|------|----------|
| 18.2.1 | `product.yaml`：`owner` `description` `freshness_sla` `pages[]` | `packages/core/src/publish/product.ts` | 不强制，CLI `--product` |

**M18 退出标准：**

- [ ] 发布的 bundle 在新目录 `memoss query` 可回答（含引用）
- [ ] zip 解压后 `viz.html` 可浏览图谱

---

### Milestone 19：Retrieval Eval + Query UX（Week 16–18）

#### 19.1 Eval 最小集

| ID | 任务 | 文件 | 验收标准 |
|----|------|------|----------|
| 19.1.1 | Eval 集格式：`eval/queries.yaml` | `docs/eval-format.md` | query + expected_pages[] |
| 19.1.2 | `memoss eval retrieval [--discover] [--search-mode]` | `apps/cli/src/commands/eval.ts` | 输出 recall@k |
| 19.1.3 | 内置 eval 集：`examples/ga4-ecommerce/eval/` | examples | CI 回归 |
| 19.1.4 | CI：recall@5 不低于 baseline | `.github/workflows/` | 防退化 |

#### 19.2 Query 格式（低优先级）

| ID | 任务 | 文件 | 验收标准 |
|----|------|------|----------|
| 19.2.1 | `--format marp` 幻灯片输出 | query-runner | quality-todo 项关闭 |

**M19 退出标准：**

- [ ] `memoss eval retrieval` 在 GA4 示例上 recall@5 ≥ 0.6
- [ ] discover 开启后 recall 高于 baseline（同 eval 集）

---

### Milestone 20：文档 + Phase 2 收尾（Week 18–20）

| ID | 任务 | 文件 | 验收标准 |
|----|------|------|----------|
| 20.1 | Phase 2 用户指南 | `docs/phase-2-user-guide.md` | read/discover/publish 场景 |
| 20.2 | 更新 product-design 路线图章节 | `docs/product-design.md` | Phase 2 完成态 |
| 20.3 | `examples/research-topic/` 扩充 discover + publish | examples | 端到端故事 |
| 20.4 | CHANGELOG Phase 2 汇总 | `CHANGELOG.md` | — |
| 20.5 | Phase 2 retrospective：是否启动 2c | 内部 | 数据驱动 |

**Phase 2b 总退出标准：**

- [ ] 200+ 页 vault：query with discover 用户主观满意度可用（内测 N≥5）
- [ ] publish bundle 被至少 1 个外部测试者独立打开并 query 成功

---

## 6. Phase 2c — 按需任务（不阻塞发布）

触发条件：≥3 个用户主动要求数据目录深化，或 `data-catalog` pack 下载/使用显著。

| ID | 任务 | 预估 | 说明 |
|----|------|------|------|
| 2c.1 | `references/queries/<slug>.md` golden SQL 类型 | 1 周 | frontmatter: `validated`, `dialect` |
| 2c.2 | lint：query 引用表存在于 vault | 3 天 | data-catalog checks 扩展 |
| 2c.3 | `memoss enrich --target <page>` | 2 周 | 单页垂直；MCP 外部源可选 |
| 2c.4 | `memoss bridge` 只读 mac-to-okf（无 sync） | 1 周 | 导入 KC 样例 bundle |

---

## 7. 技术依赖（Phase 2 新增）

| 依赖 | 用途 | 里程碑 |
|------|------|--------|
| 现有 `ai` + providers | book-tuning, discover, rerank | M13, M16 |
| 可选 `@xenova/transformers` 或 embedding API | 本地 vector | M17 |
| 无新强制运行时 | Phase 2a 不引入 DB | — |

> 具体版本在实现 M17 时锁定于 `phase-1-technical-design.md` 附录更新。

---

## 8. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 整书 ingest 成本高 | 高 | 中 | `dry-run`、resume、章级 skip、`max_steps` 配置 |
| PDF 拆分质量差 | 中 | 高 | 优先 MD/EPUB；PDF 推荐 extract skill；`files` 策略手工拆章 |
| Hybrid search 无 API key | 中 | 低 | BM25-only 降级 |
| Discover rerank 慢 | 中 | 中 | lightweight model；可 `--no-rerank` |
| 范围蔓延至企业 catalog | 中 | 高 | 本文档非目标清单；PR review 检查 |

---

## 9. 任务看板视图（按优先级排序）

便于 sprint 规划，所有任务 ID 可直映射 GitHub Issues。

### Sprint 1（W1–2）
- 11.1.1 – 11.1.5
- 11.3.1 – 11.3.4
- 12.1.1 – 12.1.3

### Sprint 2（W3–4）
- 11.2.1 – 11.2.3
- 12.1.4 – 12.2.5
- 13.1.1 – 13.1.3

### Sprint 3（W5–6）
- 13.1.4 – 13.2.9
- 13.3.1 – 13.4.3

### Sprint 4（W7–8）
- 14.1.1 – 14.3.2
- 15.1.1 – 15.3.3

### Sprint 5（W9–11）
- 16.1.1 – 16.2.2

### Sprint 6（W12–14）
- 17.1.1 – 17.3.3

### Sprint 7（W15–16）
- 18.1.1 – 18.2.1

### Sprint 8（W17–20）
- 19.1.1 – 19.2.1
- 20.1 – 20.5

---

## 10. 成功指标

| 指标 | Phase 2a 目标 | Phase 2b 目标 | 测量方式 |
|------|---------------|---------------|----------|
| 7 日二次 ingest/read 率 | ≥25%（内测） | ≥35% | 匿名 CLI telemetry（opt-in）或访谈 |
| Read 完成率 | ≥70% 启动用户 approve | — | work manifest `status=complete` |
| Lint health_score 中位数 | ≥75 | ≥80 | 示例 vault CI |
| Retrieval recall@5 | — | ≥0.6（GA4 eval） | `memoss eval` |
| Publish 采用 | — | ≥3 次外部 bundle 使用 | 社区反馈 |

---

## 11. 相关文档

- [文档状态索引](DOC-STATUS.md)
- [Phase 1 计划](phase-1-plan.md)
- [Serial Read 技术设计](serial-read-design.md)
- [产品设计 v0.2](product-design.md)
- [质量待办](quality-todo.md)
- [CLI 参考](cli-reference.md)
- [lint-report JSON Schema](lint-report-schema.json)
- [Extraction Skills 设计](extraction-skills-design.md)

---

## 附录 A：Issue 模板建议

```markdown
## 任务 ID
M13.2.5

## 描述
runSerialIngest ingest 阶段：循环 runIngest per chapter

## 验收标准
- [ ] ...
- [ ] 单测 / e2e

## 依赖
M12, M13.1

## 参考
docs/phase-2-plan.md § M13.2.5
docs/serial-read-design.md §5.2
```

## 附录 B：与 Phase 1 计划变更对照

| Phase 1 延后项 | Phase 2 本计划处置 |
|----------------|-------------------|
| `memoss read` / Serial Read | **M12–M14，P0** |
| `memoss discover` | **M16，本地版** |
| Hybrid search | **M17** |
| `memoss publish` | **M18** |
| catalog-bridge / sync | **推迟 Phase 3** |
| `memoss enrich` | **Phase 2c 按需** |
| Web/Desktop UI | **不纳入 Phase 2** |
