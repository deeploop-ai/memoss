# 长文 / 整本书导入（Serial Read）技术设计

> **状态：** 📝 设计稿 v0.1 — **实现未开始**（M12–M14；当前焦点 M12 Works 基础设施）  
> **日期：** 2026-06-27  
> **决策：** 整本书导入作为 **编排层操作（Read / Serial Ingest）** 内置，复用现有 Extract + Ingest Runner；**不**新增 Book Ingest Agent，**不**以独立 schema pack 作为首要机制。  
> **索引：** [DOC-STATUS.md](DOC-STATUS.md) · [phase-2-plan.md § M12–M14](phase-2-plan.md#milestone-12works-基础设施week-2-3-未开始)

---

## 1. 目标与非目标

### 1.1 目标

- 将 **整本书 / 长文档（数百页）** 的导入流程固化为 Memoss 一等能力：Extract → 拆章 → 逐章 Ingest → 综合页收尾。
- 提供 **断点续跑、失败重试、进度追踪**，避免用户手写 shell 循环。
- 保持 Memoss 核心范式：**Agent 编译知识、Runner 控制流程**；每章仍目标 5–15 页交叉更新，而非整书摘要 dump。
- 与现有 **draft 分支、provenance、extract cache、MCP async job** 机制对齐。

### 1.2 非目标（本阶段）

- 不实现「单个 Agent 读完全书再一次性写 vault」。
- 不为此单独新增 schema pack（目录约定可通过 vault `instructions.md` 或后续 profile 扩展；见 §11）。
- 不替换现有单次 `memoss ingest` 语义。
- 不实现向量检索 / hybrid search（Query 侧仍走现有 index + grep；Phase 2 另行规划）。
- 本文档 **为 M12–M14 实现规格**；代码尚未落地（2026-06-30）。

---

## 2. 背景与问题

### 2.1 现有单次 Ingest 的边界

当前 `runIngest` 针对 **单次资料源** 优化：

| 环节 | 现状 | 对整本书的影响 |
|------|------|----------------|
| Ingest Agent | 默认 `max_steps: 50`，目标每源 5–15 页更新 | 一次 ingest 整本书易 `INCOMPLETE` |
| Tuning | 预览源前 ~8000 字符 | 无法对全书做准确规划 |
| 内置 PDF | `pdf-parse` 纯文本 | 复杂排版质量差，validate 可能拒绝 |
| Web 抓取 | 40KB 截断 | 不适用整书 |

Memoss 的价值在于 **知识编译**（交叉引用、概念页、持续 augment），不是 RAG 式切块。整本书的正确粒度是 **按章 ingest，跨章累积概念图谱**。

### 2.2 已有可复用先例

| 组件 | 路径 | 可借鉴点 |
|------|------|----------|
| 多源顺序 ingest | `packages/core/src/rebuild/runner.ts` | `for` 循环、`onSourceStart/Complete`、index 重建 |
| Extract → Ingest 解耦 | `packages/core/src/engine/extract-runner.ts` | `resolveIngestSource`、`runExtract` |
| 多页 extract 目录 | `packages/core/src/skills/crawl-meta.ts` | 章节目录扫描、sidecar meta |
| MCP 长任务 | `packages/mcp/src/mcp-jobs.ts` | async job + 轮询 |
| 源注册 | `packages/core/src/provenance/manifest.ts` | `sources/manifest.yaml` |

### 2.3 `runRebuild` 为何不能直接复用

`runRebuild` 的 emphasis 为「Full vault rebuild… Create or rewrite pages」，且默认 **reset wiki**。整本书导入需要：

- **Augment**，非重写
- **同一 draft 分支** 跨多章累积
- **书级 emphasis 模板**（章节序号、 synthesis 路径）
- **书级 tuning 一次**，而非每章重复

因此需要独立编排 Runner，而非扩展 rebuild。

---

## 3. 总体架构

```
┌─────────────────┐     ┌──────────────────────────────┐     ┌─────────────────────┐
│ 用户 / MCP      │     │ runSerialIngest（编排，无 LLM）│     │ sources/works/      │
│ memoss read …   │────▶│ · load work manifest         │◀───▶│ <id>.yaml           │
└─────────────────┘     │ · splitChapters（确定性）      │     │ progress / chapters │
                        │ · 阶段调度 + resume            │     └─────────────────────┘
                        └──────────────┬───────────────┘
                                       │
           ┌───────────────────────────┼───────────────────────────┐
           ▼                           ▼                           ▼
   ┌───────────────┐          ┌───────────────┐          ┌───────────────┐
   │ runExtract()  │          │runBookTuning()│          │ runIngest()   │
   │ （可选）      │          │ （全书一次）  │          │ × N 章        │
   └───────┬───────┘          └───────────────┘          └───────┬───────┘
           ▼                                                     ▼
   sources/extracted/                                    topics/ + synthesis
   <work>/<chapter>.md                                   draft branch → approve
```

### 3.1 三层职责

| 层级 | 职责 | 是否 LLM |
|------|------|----------|
| **声明层** | Work Manifest：书元数据、章节列表、emphasis 模板、进度 | 否 |
| **编排层** | `runSerialIngest`：阶段调度、split、resume、git checkpoint | 否 |
| **执行层** | `runExtract` / `runBookTuning` / `runIngest`（现有 Runner） | 是 |

---

## 4. Work Manifest

### 4.1 文件位置

```
sources/works/<work-id>.yaml
```

`<work-id>` 与 `sources/extracted/<work-id>/` 目录 slug 对齐（约定，非强制）。

### 4.2 Schema（草案）

```yaml
# sources/works/deep-learning.yaml
id: deep-learning
title: "Deep Learning"
source: sources/raw/deep-learning.pdf   # 原始 URI/路径；ingest-only 时可省略

extract:
  skill: pdf                            # 传给 runExtract
  split: heading                        # heading | toc | files | none
  split_pattern: "^# Chapter"           # split=heading|toc 时生效
  output_dir: sources/extracted/deep-learning

synthesis_page: topics/deep-learning-synthesis.md

ingest:
  emphasis_template: |
    本书《{{work_title}}》第 {{chapter_index}} 章「{{chapter_title}}」。
    Augment 已有 topics/ 概念页；更新 {{synthesis_page}} 的「章节进展」小节。
    禁止创建与已有页重复的概念 slug。
  skip_tuning: after_first              # never | after_first | always
  max_steps: 80                         # 覆盖 vault 默认 agent.max_steps
  skip_validate: false

git:
  draft_branch: true                    # 整本书共用一个 draft 分支
  commit_every: 0                       # 0=全部完成后一次 commit；N=每 N 章 checkpoint

progress:
  status: pending                       # pending | extracting | planning | ingesting | complete | failed
  draft_branch: null
  completed_chapters: []
  failed_chapters: []
  last_error: null

chapters: []                            # extract+split 后填充；也可手工编辑
# - id: "01"
#   title: Introduction
#   path: sources/extracted/deep-learning/01-introduction.md
#   status: complete                    # pending | complete | failed | skipped
```

### 4.3 运行时状态（可选 sidecar）

长时间任务可写：

```
.memoss/works/<work-id>.state.json
```

内容与 `progress` 段同步，避免频繁整文件 rewrite manifest；完成时 merge 回 yaml。

---

## 5. 编排 Runner：`runSerialIngest`

### 5.1 接口（草案）

```typescript
// packages/core/src/works/serial-ingest-runner.ts

export type SerialReadPhase = 'auto' | 'extract' | 'split' | 'plan' | 'ingest' | 'finalize';

export interface SerialIngestOptions {
  vaultRoot: string;
  work: string;                    // work id 或 manifest 相对路径
  phase?: SerialReadPhase;         // default 'auto'
  resume?: boolean;                // default true — 跳过 status=complete 的章
  retryFailed?: boolean;           // 仅重跑 failed_chapters
  stopOnError?: boolean;           // default false
  noDraft?: boolean;
  noCache?: boolean;
  model?: ModelSpec;
  abortSignal?: AbortSignal;
  onChapterStart?: (chapter, index, total) => void;
  onChapterComplete?: (chapter, result, index, total) => void;
  onWarning?: (message: string) => void;
}

export interface SerialIngestReport {
  workId: string;
  phasesRun: SerialReadPhase[];
  chaptersTotal: number;
  chaptersComplete: number;
  chaptersFailed: string[];
  draftBranch?: string;
  results: Array<{
    chapterId: string;
    status: 'complete' | 'incomplete' | 'rejected' | 'skipped';
    affects?: string[];
  }>;
}
```

### 5.2 阶段流程（`phase: auto`）

| 顺序 | 阶段 | 动作 |
|------|------|------|
| 1 | **extract** | 若 `source` 存在且章节未提取 → `runExtract({ skill, … })` |
| 2 | **split** | 若 `extract.split != none` → `splitChapters()` 写章文件，更新 manifest `chapters[]` |
| 3 | **plan** | 若 `ingest.skip_tuning != always` 且尚无 book overlay → `runBookTuning()` |
| 4 | **ingest** | 对每章 `runIngest({ noExtract: true, emphasis, qualityOverlay, skipTuning, noDraft: true })` |
| 5 | **finalize** | 可选：更新 synthesis 目录/index；`regenerateIndexes()`；最终 `git_commit` |

### 5.3 Draft / Git 策略

1. 编排开始时：若 `git.draft_branch` 且尚无进行中的 draft → 创建 `memoss/draft/read-<work-id>-<timestamp>`，写入 manifest `progress.draft_branch`。
2. 每章 `runIngest` 传 `noDraft: true`（已在 draft 分支上）。
3. `commit_every: N` 时每 N 章 `git commit`；否则全部完成后一次 commit。
4. 用户 `memoss approve` 合并整本书变更。

### 5.4 Resume 语义

- `resume: true`：跳过 `chapters[].status === 'complete'`。
- `retryFailed: true`：仅处理 `progress.failed_chapters`。
- Extract cache 命中时跳过 extract 阶段（与现有 `extraction.cache` 一致）。

---

## 6. 章节拆分：`splitChapters`

**确定性实现，默认不用 LLM。**

```typescript
// packages/core/src/works/split-chapters.ts

export type SplitStrategy = 'heading' | 'toc' | 'files' | 'none';

export interface SplitChaptersOptions {
  strategy: SplitStrategy;
  pattern?: string;           // RegExp string，heading/toc 模式
  minChars?: number;          // default 3000
  maxChars?: number;          // default 80000 — 超限则按段落二次切
  outputDir: string;          // 相对 vault
  filenameTemplate?: string;  // default "{{index}}-{{slug}}.md"
}
```

| strategy | 行为 |
|----------|------|
| `heading` | 按 `split_pattern` 匹配的行切分（如 `^# Chapter`） |
| `toc` | 从目录区块解析链接/标题，再按锚点切正文 |
| `files` | 扫描 `outputDir` 已有 `*.md`，按文件名排序注册为 chapters |
| `none` | 不拆分；要求 extract skill 已输出多文件，或用户手工准备 |

输出：更新 work manifest 的 `chapters[]`，每章写独立 `.md`（及可选 `.meta.json` sidecar）。

---

## 7. 书级 Tuning：`runBookTuning`

现有 `runTuningPass` 仅预览 ~8000 字符，不足以规划全书。新增 **全书一次** 的 tuning runner：

### 7.1 输入

- Work manifest（标题、章节列表）
- 首章或 TOC 文件内容（有界读取，如前 16KB + 章标题列表）
- `list_pages` 结果

### 7.2 输出

- `qualityOverlay`：注入后续每章 ingest 的 `{{quality_overlay}}`
- `proposed_pages`：初始 concept 页 + `synthesis_page` 路径
- `emphasis`：书级优先级（可选合并进 emphasis_template）

### 7.3 Prompt

新增 `packages/core/src/engine/prompts/book-tuning.md`（或扩展 `tuning.md` 加 `{{serial_context}}` 分支）。

规则要点：

- 只读，不写 vault
- 基于 **章节列表** 规划，而非通读全书
- 明确 synthesis 页结构（章节进展、核心论点、术语索引入口）

### 7.4 与 per-chapter tuning 的关系

| `ingest.skip_tuning` | 行为 |
|----------------------|------|
| `never` | 每章仍跑 `runTuningPass`（成本高，不推荐整书） |
| `after_first`（**默认**） | 仅第一章前跑 `runBookTuning`；后续章 `skipTuning: true` |
| `always` | 跳过所有 tuning（用户完全靠 emphasis_template） |

---

## 8. 每章 Ingest：复用 `runIngest`

不新建 Agent。每章调用：

```typescript
await runIngest({
  vaultRoot,
  source: chapter.path,
  kind: 'file',
  noExtract: true,
  skipTuning: bookTuningDone,
  qualityOverlay: bookOverlay,
  emphasis: renderTemplate(manifest.ingest.emphasis_template, {
    work_title: manifest.title,
    chapter_index: chapter.id,
    chapter_title: chapter.title,
    synthesis_page: manifest.synthesis_page,
  }),
  noDraft: true,              // 编排层已建 draft 分支
  maxSteps: manifest.ingest.max_steps,
  skipValidate: manifest.ingest.skip_validate,
});
```

### 8.1 Ingest Prompt 扩展（可选）

在 `ingest.md` 增加条件块 `{{serial_context}}`，例如：

```markdown
## Serial read context

This ingest is chapter {{chapter_index}} of work «{{work_title}}».
- Augment existing pages; do not recreate concepts already in the vault.
- Update {{synthesis_page}} with a short «Chapter progress» note for this chapter.
- Prior chapters have already been ingested; maintain naming consistency.
```

---

## 9. 用户入口

### 9.1 CLI：`memoss read`

推荐 **独立子命令**（与单次 `ingest` 区分），作为产品层第 8 种核心操作 **Read（长文编译）**。

```bash
# 一键：extract + split + plan + 逐章 ingest
memoss read ./book.pdf --work deep-learning

# 分阶段
memoss read ./book.pdf --work deep-learning --phase extract
memoss read --work deep-learning --phase ingest --resume

# 从已拆章目录（split=none）
memoss read sources/extracted/my-book/ --work my-book

# 重试失败章
memoss read --work deep-learning --retry-failed

#  dry-run：列出将处理的章节
memoss read --work deep-learning --dry-run
```

| Flag | 说明 |
|------|------|
| `--work <id>` | Work manifest id（必填，除非 `--init-work` 自动创建） |
| `--phase` | `auto` \| `extract` \| `split` \| `plan` \| `ingest` \| `finalize` |
| `--resume` / `--no-resume` | 是否跳过已完成章 |
| `--retry-failed` | 仅重跑 failed |
| `--stop-on-error` | 遇错即停 |
| `--skill` | 覆盖 manifest extract.skill |
| `--emphasis` | 追加用户 emphasis（合并进模板） |
| `--no-draft` | 直接写当前分支 |
| `--vault` / `-C` | Vault 根 |

**折中方案：** 若 CLI 表面不宜增命令，可用 `memoss ingest --serial --work <id> <source>`；设计文档倾向 `read` 语义更清晰。

### 9.2 MCP

```typescript
run_read({
  work: 'deep-learning',
  source: './book.pdf',
  phase: 'auto',
  async: true,
})

run_read_status({ jobId: '…' })
```

- Job 类型扩展 `McpIngestJob.type: 'read'`
- 状态持久化：`.memoss/mcp-jobs/<id>.json` + work manifest progress

### 9.3 Shell REPL

`executeShellTask` 增加 `read` task：

```json
{ "task": "read", "params": { "source": "…", "work": "deep-learning" } }
```

---

## 10. 配置与 Provenance

### 10.1 Vault 默认（`.memoss/config.yaml`）

```yaml
works:
  manifest_dir: sources/works
  default_synthesis_dir: topics
  extract:
    split: heading
    split_pattern: "^# "
  ingest:
    skip_tuning: after_first
    max_steps: 80
  git:
    commit_every: 0
```

### 10.2 Manifest 扩展字段

在 `sources/manifest.yaml` 条目上增加可选字段：

```yaml
sources:
  - id: deep-learning-ch03
    uri: sources/extracted/deep-learning/03-linear-algebra.md
    work_id: deep-learning
    chapter_id: "03"
    content_hash: sha256:…
    affects: [topics/neural-networks.md, …]
```

`registerIngestProvenance` 在 serial ingest 路径传入 `work_id` / `chapter_id`。

### 10.3 Lint（Phase M3）

可选检查项：

| 检查 | 严重度 |
|------|--------|
| work 声明 N 章，manifest 缺少章节条目 | warning |
| synthesis 页未在 ingest 中被更新 | info |
| 章节 ingest `incomplete` 但 work status=complete | error |

---

## 11. 与 Schema Pack 的关系

整本书导入 **不以独立 schema pack 作为首要机制**。

| 方式 | 适用 |
|------|------|
| 现有 `research` / `personal` + vault `instructions.md` | 短期；M1 之前用户可手工分批 |
| `config.works` 默认值 | 编排层配置 |
| 未来 `profile: library` 扩展 research | 若需固定 `works/` 目录约定（见产品讨论） |

Schema pack 解决 **目录约定与 Agent 默认行为**；Serial Read 解决 **多章编排**。二者正交，可组合。

---

## 12. 包结构与文件清单（规划）

```
packages/core/src/works/
├── types.ts                    # WorkManifest, ChapterEntry, …
├── load-manifest.ts            # 读写 sources/works/*.yaml
├── split-chapters.ts           # 确定性拆章
├── book-tuning-runner.ts       # runBookTuning()
├── serial-ingest-runner.ts     # runSerialIngest()
└── emphasis-template.ts        # {{chapter_index}} 渲染

packages/core/src/engine/prompts/
├── book-tuning.md              # 书级 tuning prompt

apps/cli/src/commands/
└── read.ts                     # memoss read

packages/mcp/src/
└── mcp-jobs.ts                 # 扩展 type: 'read'
```

---

## 13. 实施分期

| 里程碑 | 交付 | 用户价值 |
|--------|------|----------|
| **M1** | Work manifest schema、`splitChapters`、`runSerialIngest`（extract+ingest 循环）、`memoss read`、resume | 可一键跑通，可断点续跑 |
| **M2** | `runBookTuning`、ingest serial_context overlay、synthesis finalize、MCP async | 质量接近手工 emphasis |
| **M3** | manifest `work_id`/`chapter_id`、lint 完整性检查、Shell `read` task | 长期可维护 |

M1 可复用约 70% `runRebuild` 循环骨架；差异在 manifest、emphasis 模板、draft 策略、augment 语义。

---

## 14. 风险与缓解

| 风险 | 缓解 |
|------|------|
| PDF 提取质量差 | Extract 阶段用 skill；validate 拒绝时中止并提示重提取 |
| 章节切分不准 | 支持 `split: none` + 手工 manifest；dry-run 预览章节 |
| 概念页命名漂移 | 书级 tuning + 第一章 emphasis 锁定 slug；lint 查重复 |
| 单章 ingest 超时 | 调 `max_steps`；过大章二次 split |
| 成本（N 章 × ingest） | extract cache；skip_tuning after_first；轻量 model 用于 plan |
| 与 rebuild 混淆 | 独立 CLI `read`；文档明确 augment vs rewrite |

---

## 15. 开放问题

1. **CLI 命名：** `memoss read` vs `memoss ingest --serial` — 倾向 `read`，待 CLI review。
2. **Work manifest 格式：** 纯 YAML vs JSON — 倾向 YAML（与 manifest.yaml 一致）。
3. **Finalize 是否需 Agent：** M1 可仅 `regenerateIndexes` + 模板写 synthesis 骨架；M2 再 Agent 润色。
4. **多本书并行：** 同一 vault 多 work 并行 ingest 是否允许 — 初期串行，避免 draft 冲突。
5. **EPUB / MOBI：** 经 extract skill 转 markdown 后走同一 pipeline，不单独分支。

---

## 16. 参考

- [Extraction Skills 技术设计](./extraction-skills-design.md) — Extract / Ingest 解耦
- [Product Design §6.1 Ingest](./product-design.md) — 单次 ingest 行为
- `packages/core/src/rebuild/runner.ts` — 多源顺序 ingest 先例
- `packages/core/src/engine/ingest-runner.ts` — 单次 ingest
- `packages/core/src/engine/prompts/tuning.md` — 现有 tuning 边界
- `packages/core/src/engine/prompts/overlays/personal.md` — 书籍内容组织提示
