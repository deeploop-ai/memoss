# Memoss

> **像苔藓一样自然生长的记忆。**
>
> *文件系统即知识库。Agent 持续编译、维护并交叉引用其中的知识。*

[English README](README.md)

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Phase](https://img.shields.io/badge/phase-1a-yellow.svg)](docs/phase-1-plan.md)
[![Design](https://img.shields.io/badge/design-v0.2-blue.svg)](docs/product-design.md)

---

## Memoss 是什么？

Memoss 是一个 **面向 Agent 的知识运行时** —— LLM Agent 从你的原始资料（文档、网页、数据 schema、代码、对话等）持续构建并维护一个「活」的知识库，全部以文件系统上的纯 Markdown 文件存储。

与传统 Wiki 需要 **人工维护**（且容易过时）不同，也与 RAG 在每次查询时 **从头推导** 不同 —— 在 Memoss 中，**Agent 负责维护**，知识 **一次编译、持续更新、随时可用**。

### 核心理念

```
你放入资料。Agent 构建知识。你提问。Agent 保持知识鲜活。
```

**Phase 1 核心操作：**

- **Ingest（入库）** — 放入 URL、文件或仓库。Agent 阅读内容、提取知识、更新相关页面，并提交（默认写入 draft 分支供你审核）。
- **Query（查询）** — 提出问题。Agent 检索知识库、综合带引用的答案，并可将答案写回为新页面。
- **Lint（检查）** — Agent 检查矛盾、过时陈述、孤立页面和断链，保持知识库健康。
- **Extract（提取）** — 使用 [skills.sh](https://skills.sh) 技能将资料转为 `sources/extracted/` 下的 Markdown（入库时自动调用，也可通过 `memoss extract` 单独使用）。

**Phase 2 规划：** Enrich · Discover · Sync · Publish · Bridge（OKF ↔ 企业目录）

### 双轨知识

Memoss 支持两条可独立或组合使用的知识轨道：

| 轨道 | 格式 | 适用场景 |
|------|------|----------|
| **Wiki** | [OKF](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) 仓库（Markdown + YAML frontmatter） | 个人研究、团队 Wiki、阅读笔记 |
| **Catalog** | Metadata-as-Code 快照（`catalog.yaml` + 条目） | 数据资产文档、企业目录同步 |

**Bridge** 层在两者之间转换 —— 兼容 [Google knowledge-catalog](https://github.com/GoogleCloudPlatform/knowledge-catalog) 的 mdcode 工具链。

### 为什么用 Markdown 文件？

因为 **Markdown 是人类可读、Agent 可解析、Git 可 diff 的唯一格式** —— 无需专有工具。你可以 `cat` 阅读、`grep` 搜索、`git diff` 查看变更，在 **Obsidian** 中打开仓库做图谱浏览。没有专有数据库，没有厂商锁定。

---

## 快速开始

### 从源码运行（开发）

```bash
git clone https://github.com/deeploop-ai/memoss.git
cd memoss
pnpm install
pnpm nx build core cli mcp-server

# 设置 LLM API Key
export ANTHROPIC_API_KEY=sk-ant-...

# 创建知识库（默认：~/.memoss-vault）
node apps/cli/dist/main.js init --pack research

# 或指定路径
node apps/cli/dist/main.js init ./my-knowledge --pack research
cd ./my-knowledge

# 入库第一个资料（写入 draft 分支）
node apps/cli/dist/main.js ingest "https://example.com/article" --type web

# 审核并合并 Agent 的修改
node apps/cli/dist/main.js approve

# 提问
node apps/cli/dist/main.js query "what does this article say about X?"

# 将答案写回知识库
node apps/cli/dist/main.js query "compare X and Y" --save

# 检查知识库健康度
node apps/cli/dist/main.js lint

# 可视化知识图谱
node apps/cli/dist/main.js graph

# 启动 MCP 服务供其他 AI Agent 使用（默认仅 agent 工具）
node apps/cli/dist/main.js mcp serve
node apps/cli/dist/main.js mcp serve --capabilities agent,read
node apps/cli/dist/main.js mcp serve --capabilities full
```

### 全局安装

```bash
npm install -g @memoss/cli
memoss --version

# 默认知识库位于 ~/.memoss-vault
memoss init
memoss ingest "https://example.com/article" --type web
memoss approve
memoss query "what does this article say about X?"
memoss graph
memoss mcp serve
```

### 配置

| 路径 | 用途 |
|------|------|
| `~/.memoss-vault` | 未指定时的默认知识库位置 |
| `~/.memoss/config.yaml` | 用户级共享配置（模型默认值等，合并进仓库配置） |
| `MEMOSS_VAULT_PATH` | 覆盖知识库路径 |
| `MEMOSS_MCP_CAPABILITIES` | MCP 工具级别：`agent`、`read`、`write` 或 `full` |

知识库发现顺序：`--vault` / `-C` → `MEMOSS_VAULT_PATH` → 从当前目录向上查找 → `~/.memoss-vault`。

### 入库限制与策略

`memoss ingest` 在写入页面前后会经过以下流水线：

```
Extract（可选）→ Validate（默认开启）→ Tuning（默认开启）→ Ingest Agent → draft 分支待审
```

#### 硬拦截（中止入库，vault 不会被修改）

**Validate** 默认开启，可用 `--skip-validate` 跳过，包含两层：

1. **启发式检查**（确定性，任一命中即拒绝）：
   - 原始 HTML 页面壳，而非正文
   - 大量 `<head>` / `<script>` 脚手架
   - 有效文本不足约 80 字符
   - 含替换字符 `U+FFFD`（编码损坏）
   - 内容像 HTTP 404/403 错误页
   - PDF 文本提取破碎（大量短行、竖排单字 CJK 等）

2. **Validate Agent**（LLM 复审）— 还会拒绝登录墙、验证码页、付费墙摘要、空占位页、导航/页脚占主导且正文极少等情况。若 Agent 未提交判定，出于谨慎也会中止入库。

**Extract 失败** 也可能在 validate 之前中止入库，例如 `audio` / `video` / 未知格式且无可用提取 skill、也无内置 fallback。

> `memoss extract` 在内容被标为 `needs_manual_review`（如破碎 PDF）时会**退出**；**`memoss ingest` 仅警告并继续**。

#### 软限制（允许入库，但可能取舍内容）

| 阶段 | 会阻止入库？ | 作用 |
|------|-------------|------|
| **Tuning** | 否 | 规划要创建/更新的页面；`skip_patterns` 只针对源内**低信号段落**（页脚导航、changelog 索引等），不能拒绝整份用户提交的源。可用 `--emphasis` 覆盖。 |
| **Ingest Agent** | 否 | 跳过源内低价值**段落**（营销废话、导航栏等），不会跳过整份源；主题与 vault 不符时会新建 `topics/` 页。可能省略规范级细节（原始 BNF、历史附录）以换取概念页 — 见 Agent 摘要中的 **Skipped** 说明。 |
| **写入策略** | 在 `write_page` 时 | 默认见 `.memoss/config.yaml` → `policies`：更新前须 `read_page`；保留已有 `#` 标题与 `resource` frontmatter（违反则 `error`）；正文大幅缩短、缺少 `# Citations`、元页面式 reference slug 等会 `warn`。 |

#### 入库之后

`git.draft_branch` 默认开启时，改动在 draft 分支上 — 用 `memoss approve` 或 `memoss reject` 审核。若 ingest 完成但未创建/更新任何页面，可用 `--emphasis` 或 `--skip-tuning` 重试。

#### 常用开关

```bash
memoss ingest <source> \
  --skip-validate    # 跳过 validate 门禁（慎用）
  --skip-tuning      # 跳过 tuning 规划
  --no-extract       # 不 extract，直接入库原文件
  --emphasis "..."   # 强调要保留或优先整理的内容
  --no-draft         # 直接写入当前分支
```

提取 skill 与信任配置见 `.memoss/config.yaml` 的 `extraction.*`。详见 [Extraction Skills 设计](docs/extraction-skills-design.md)。

### 在 Cherry Studio 中使用 MCP

使用 **STDIO** 传输。将可执行文件填入 **Command**，子命令填入 **Arguments**：

| 字段 | 值 |
|------|-----|
| Command | `memoss` |
| Arguments | `mcp` / `serve` |
| Environment | `MEMOSS_VAULT_PATH=/path/to/vault` |

#### Agent 工具（默认）

默认仅暴露 **agent** 类 runner：

| 工具 | 使用场景 |
|------|----------|
| `run_ingest` | 将 URL、文件或其他资料**加入知识库**（提取 + 分析 + 更新页面）。用户要「入库 / 保存 / 加入知识库」时**优先使用此工具**。 |
| `run_ingest_status` | 通过 `jobId` 轮询异步 `run_ingest` 任务状态。 |
| `run_extract` | **仅提取**：将资料转为 `sources/extracted/` 下的 Markdown，**不会**更新 Wiki 页面。仅在用户明确要求「只提取、不入库」时使用。 |
| `run_query` | 对知识库提问。优先于直接调用 `search_kb`。 |
| `run_lint` | 检查知识库健康度（矛盾、过时页面、断链等）。 |

`run_ingest` 会在需要时自动执行 extract（`extract: auto`）。对于「把这个 URL 加入知识库」这类请求，客户端应调用 **`run_ingest`**，而不是 `run_extract`。

如需暴露底层读写工具：

```bash
memoss mcp serve --capabilities agent,read
memoss mcp serve --capabilities full
```

完整命令参考：[docs/cli-reference.md](docs/cli-reference.md) · OKF 格式：[docs/okf-spec.md](docs/okf-spec.md)

---

## 架构

```
apps/
└── cli/                    @memoss/cli     init · ingest · query · lint · approve · graph · mcp

packages/
├── core/                   @memoss/core    OKF · agents · tools · policies
├── mcp/                    @memoss/mcp-server
├── catalog-bridge/         @memoss/catalog-bridge   (Phase 2a — MaC 同步)
└── search/                 @memoss/search           (Phase 2b — 混合检索)

schema-packs/               personal · research · data-catalog 模板
```

Phase 2 将加入 `apps/web/`（Next.js UI）和 `apps/desktop/`（Obsidian 兼容仓库 + Agent 对话）。

技术栈：
- **Agent 引擎** — Vercel AI SDK（多模型、类型安全的工具调用）
- **Monorepo** — Nx + pnpm workspaces
- **格式** — OKF（Wiki）+ MaC（目录）
- **语言** — TypeScript

---

## 设计来源

Memoss 将两套独立设计收敛为可产品化的运行时：

- **[Google knowledge-catalog](https://github.com/GoogleCloudPlatform/knowledge-catalog)** — OKF 格式、Metadata-as-Code 同步、enrich/discover Agent、MCP 优先架构。
- **[Karpathy LLM Wiki Pattern](https://gist.githubusercontent.com/karpathy/442a6bf555914893e9891c11519de94f/raw/ac46de1ad27f92b28ac95459c782c07f6b8c964a/llm-wiki.md)** — 三层模型（sources → wiki → schema）、ingest/query/lint、交互式策展、Obsidian 工作流。

企业级与个人级，同一套架构。**模式已被验证，品类尚未定义。**

---

## 路线图

| 阶段 | 时间 | 重点 |
|------|------|------|
| **Phase 1a** | 0–4 个月 | CLI + 核心循环（ingest/query/lint）、draft 审核、MCP、图谱查看器 |
| **Phase 1b** | 4–6 个月 | 网页爬取入库、溯源、lint 健康分、示例 |
| **Phase 2a** | 6–12 个月 | 目录桥接、enrich、sync、publish、数据连接器 |
| **Phase 2b** | 12–18 个月 | Discover、桌面应用、混合检索、团队 PR 工作流 |
| **Phase 3** | 18+ 个月 | 托管平台、Bundle 市场、企业版 |

详细文档：[产品设计 v0.2](docs/product-design.md) · [Phase 1 计划](docs/phase-1-plan.md) · [Phase 1 技术设计](docs/phase-1-technical-design.md) · [Extraction Skills 设计](docs/extraction-skills-design.md) · [Serial Read 设计](docs/serial-read-design.md) · [CLI 参考](docs/cli-reference.md) · [OKF 规范](docs/okf-spec.md)

---

## 贡献

Memoss 处于早期开发阶段。贡献指南见 [CONTRIBUTING.md](CONTRIBUTING.md)（即将推出）。

---

## 许可证

Memoss 以 [Apache License 2.0](LICENSE) 开源。
