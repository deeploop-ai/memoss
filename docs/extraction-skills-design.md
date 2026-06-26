# Extraction Skills 技术设计

> **状态：** Draft v0.1  
> **日期：** 2026-06-26  
> **决策：** Skill 选择策略采用 **混合模式（C）** — CLI/config 显式映射优先，无匹配时由 Extract Agent 从 catalog 自选。

## 1. 目标与非目标

### 1.1 目标

- 支持通过 **[Agent Skills](https://agentskills.io/specification)** 标准格式扩展文档提取能力（web、PDF、音视频、数据库等）。
- **直接复用 [skills.sh](https://www.skills.sh/) 生态**：`npx skills add` 安装的 skill 无需 Memoss 专用字段或改造。
- 将 **提取（Extract）** 与 **入库（Ingest）** 解耦：提取产出不可变 markdown 中间层，现有 Ingest Agent 职责不变。
- Skill 路由采用混合策略：**显式指定 > vault 配置映射 > Agent 自选**。

### 1.2 非目标（本阶段）

- 不要求 skill 作者添加 `metadata.memoss.*` 或任何 Memoss 扩展 frontmatter。
- 不实现 skill 市场 UI（复用 skills.sh + `npx skills` CLI）。
- 不替换 Ingest Agent 的知识编译逻辑。
- Phase 1 不实现 Fast Path（无 LLM 的单命令直跑优化）。

---

## 2. 背景：现有架构

当前摄取链路：

```
URI → SourceAdapter (file/web/github) → read_source/fetch_url → Ingest Agent → OKF vault
```

内置提取能力硬编码：

| 来源 | 实现 |
|------|------|
| Web | `Readability` + `Turndown`（`packages/core/src/adapters/fetch.ts`） |
| PDF | `pdf-parse` 纯文本（`packages/core/src/adapters/source-file.ts`） |
| Markdown/TXT | 直接读取 |

缺口：无法插拔 jina、mineru、firecrawl、defuddle 等社区方案，且提取与知识编译耦合在同一 Agent 内。

---

## 3. 标准 Skill 模型

skills.sh 上的 skill 是 **Agent 操作手册**，不是声明式插件。典型结构：

```
skill-name/
├── SKILL.md          # 必需：YAML frontmatter + Markdown 指令
├── scripts/          # 可选
├── references/       # 可选
└── assets/           # 可选
```

Extract 相关 skill 示例（均可 `npx skills add` 安装）：

| Skill | 来源 | 用途 |
|-------|------|------|
| `defuddle` | kepano/obsidian-skills | Web → Markdown |
| `firecrawl-scrape` | firecrawl/cli | Web/SPA → Markdown |
| `web-to-markdown` | softaworks/agent-toolkit | 本地浏览器 → Markdown |
| `pdf` | anthropics/skills | PDF 文本/表格提取 |
| `crawl4ai` | brettdavies/crawl4ai-skill | 爬取 + Markdown |

Memoss **只消费标准 frontmatter**（`name`、`description`、`compatibility`、`allowed-tools`、`metadata`），路由与映射逻辑放在 Memoss 配置侧。

---

## 4. 总体架构

```
┌──────────────┐     ┌──────────────────────────────┐     ┌─────────────────────┐
│ Source       │     │ Extract Agent                │     │ sources/extracted/  │
│ URI / path   │────▶│ · skill catalog (tier 1)     │────▶│ <slug>.md           │
└──────────────┘     │ · activate_skill (tier 2)    │     │ + .meta.json (可选) │
                     │ · bash / read_file / write   │     └──────────┬──────────┘
                     └──────────────────────────────┘                │
                                                                      ▼
                     ┌──────────────────────────────┐     ┌─────────────────────┐
                     │ Ingest Agent（现有）          │◀────│ FileSourceAdapter   │
                     │ read_page / write_page / …   │     │ 或 extracted adapter │
                     └──────────────────────────────┘     └─────────────────────┘
```

### 4.1 阶段职责

| 阶段 | Runner | 输入 | 输出 | LLM |
|------|--------|------|------|-----|
| **Extract** | `runExtract()` | 原始 URI/路径 | `sources/extracted/<slug>.md` | 是（Extract Agent） |
| **Ingest** | `runIngest()`（现有） | 提取后 markdown 路径 | OKF vault 变更 | 是（Ingest Agent） |

### 4.2 一键 vs 两阶段

| 命令 | 行为 |
|------|------|
| `memoss extract <source>` | 仅 Extract |
| `memoss ingest <source>` | Extract（若需要）→ Ingest |
| `memoss ingest <extracted.md>` | 跳过 Extract，直接 Ingest |

默认 **一键**；`extract` 子命令用于调试、缓存复用、人工审阅提取结果。

---

## 5. Skill 发现与安装

### 5.1 发现路径

与 [vercel-labs/skills](https://github.com/vercel-labs/skills) CLI 对齐：

| 优先级 | 路径 | 说明 |
|--------|------|------|
| 1 | `<vault>/.memoss/skills/` | Vault 级（可选，Memoss 专用覆盖目录） |
| 2 | `<vault>/.agents/skills/` | 项目级 canonical（`npx skills add` 默认） |
| 3 | `~/.memoss/skills/` | 用户级覆盖 |
| 4 | `~/.agents/skills/` | 用户级 canonical |

同名 skill：**vault 路径优先于用户路径**；同作用域内后扫描覆盖先扫描（记录 warning）。

### 5.2 与 `npx skills` 集成

Memoss 注册为 skills CLI 支持的 agent，安装路径写入 `.agents/skills/`：

```bash
# 推荐：Memoss 包装
memoss skill add firecrawl/cli --skill firecrawl-scrape

# 等价底层
npx skills add firecrawl/cli --skill firecrawl-scrape --agent memoss
```

CLI 子命令：

| 命令 | 说明 |
|------|------|
| `memoss skill add <source> [--skill <name>]` | 包装 `npx skills add` |
| `memoss skill list` | 列出已发现 skill（catalog） |
| `memoss skill update` | 包装 `npx skills update` |

### 5.3 解析规则

对每个 `*/SKILL.md`：

1. 解析 YAML frontmatter（宽容模式：colon 未引号等常见兼容问题）。
2. **必需** `name`、`description`；缺 description 则跳过并 log。
3. 存储：`{ name, description, compatibility?, allowedTools?, location, baseDir }`。
4. Body 在 `activate_skill` 时加载（tier 2）。

---

## 6. Skill 选择：混合策略（C）

### 6.1 优先级

```
1. CLI --skill <name>           （最高，强制）
2. vault config extraction.skills[<kind>]   （按来源类型映射）
3. vault config extraction.skill_overrides[<pattern>]  （URI glob，可选 Phase 2）
4. Extract Agent auto_select    （读 catalog，根据 description + 来源上下文自选）
5. builtin fallback             （无 skill / 失败降级：现有 fetch.ts / pdf-parse）
```

### 6.2 来源类型推断（`SourceKind` 扩展）

在现有 `file | web | github` 基础上，Extract 阶段增加 **MIME/扩展名细分类**（仅用于路由，不暴露为新 `SourceKind`）：

| `extract_kind` | 推断规则 |
|----------------|----------|
| `web` | `http(s)://` 且非 github |
| `github` | `github.com` URL |
| `pdf` | `.pdf` 或 `application/pdf` |
| `markdown` | `.md` / `text/markdown` |
| `text` | `.txt` / `text/plain` |
| `audio` | `.mp3`, `.wav`, … |
| `video` | `.mp4`, `.webm`, … |
| `unknown` | 其他 |

`markdown` / `text` 可 **跳过 Extract**（直接 Ingest），除非用户显式 `--skill`。

### 6.3 配置示例

```yaml
# .memoss/config.yaml
extraction:
  enabled: true
  auto_select: true          # 无映射时允许 Agent 自选；false 则仅用映射 + fallback
  cache: true                # 同 source + skill 命中缓存
  output_dir: sources/extracted

  skills:
    web: defuddle
    pdf: pdf
    # github: …              # Phase 2

  # 可选：Extract Agent 模型（默认 lightweight_model）
  model: null

  # 信任：项目级 skill 是否需要显式信任
  trust_project_skills: false
```

用户级 `~/.memoss/config.yaml` 可提供默认 `extraction.skills` 映射；vault 级覆盖。

### 6.4 Agent 自选（tier 4）

当 `auto_select: true` 且无 CLI/config 命中时，Extract Agent system prompt 注入：

```xml
<available_skills>
  <skill>
    <name>defuddle</name>
    <description>Extract clean markdown from web pages…</description>
  </skill>
  ...
</available_skills>
```

指令：根据 `source_uri`、`extract_kind` 选择最相关 skill；不确定时优先选 `compatibility` 与当前环境匹配的 skill。

### 6.5 Fallback

Extract 失败或 `auto_select: false` 且无映射时：

| extract_kind | Fallback |
|--------------|----------|
| `web` | 内置 `fetchUrl()`（Readability） |
| `pdf` | 内置 `pdf-parse` |
| 其他 | 报错，提示安装 skill 或 `--skill` |

Fallback 不经过 Extract Agent，确定性执行。

---

## 7. Extract Agent

### 7.1 工具集

Extract Agent **独立 tool registry**，与 Ingest 隔离：

| 工具 | 说明 |
|------|------|
| `activate_skill` | 加载 SKILL.md body；返回 `baseDir` + `resources` 列表 |
| `bash` | 非交互 shell；cwd 默认 skill `baseDir`；超时可配置 |
| `read_file` | 读 skill 资源、源文件、vault 内路径（沙箱） |
| `write_file` | 仅允许写入 `extraction.output_dir` 与临时目录 |

**不提供** `write_page`、`git_commit` 等 Ingest 工具，防止职责越界。

### 7.2 System Prompt 要点

```
你是 Memoss Extract Agent。唯一任务：将来源转换为干净、可阅读的 Markdown。

规则：
- 使用 available_skills 或已指定的 skill（{skill_name}）
- activate_skill 后严格遵循 SKILL.md 指令
- 使用 bash 执行 CLI；读 scripts/ 用 read_file
- 最终结果写入 {output_path}
- 禁止：知识整理、摘要章节、修改 vault 页面
- bash 必须非交互；缺参数时明确报错而非猜测
- 输出过大时写入文件，stdout 只返回摘要 + 路径

来源：{source_uri}
类型：{extract_kind}
输出：{output_path}
```

若 CLI/config 已指定 skill，prompt 中 **预激活** 该 skill，跳过自选步骤。

### 7.3 输出契约

Extract 完成后写入：

```
sources/extracted/<slug>.md          # 主内容
sources/extracted/<slug>.meta.json   # 侧车元数据（可选）
```

`meta.json` 示例：

```json
{
  "source_uri": "https://example.com/article",
  "extract_kind": "web",
  "skill": "defuddle",
  "skill_location": "/path/to/.agents/skills/defuddle/SKILL.md",
  "extracted_at": "2026-06-26T12:00:00Z",
  "content_hash": "sha256:…",
  "fallback": false
}
```

后续 M9 `sources/manifest.yaml` 可引用 `content_hash` 与 `skill` 字段。

### 7.4 模型与步数

- 默认：`config.agent.lightweight_model`（提取多为指令跟随，不需最强模型）
- `extraction.model` 可覆盖
- `max_steps`：默认 15（可配置）；低于 Ingest Agent 的 50

---

## 8. Ingest 衔接

Extract 成功后：

```typescript
await runIngest({
  vaultRoot,
  source: extractedPath,      // sources/extracted/foo.md
  kind: 'file',
  extract: false,             // 已提取，跳过
  …
});
```

`runIngest` 新增选项：

```typescript
interface IngestRunOptions {
  // …现有字段
  extract?: boolean | 'auto';  // default 'auto'
  skill?: string;              // 传给 runExtract
}
```

`extract: 'auto'` 逻辑：

- `markdown` / `text` 源 → 跳过
- 其他 → `runExtract` → 再 ingest 提取结果

---

## 9. 缓存

当 `extraction.cache: true`：

```
cache_key = sha256(source_uri + skill_name + skill_md_mtime)
```

命中且 `meta.json` 存在 → 跳过 Extract Agent，直接进入 Ingest。

缓存目录：`<vault>/.memoss/cache/extract/`（或 sidecar 与 `sources/extracted/` 同目录用 hash 命名）。

---

## 10. 安全与信任

| 风险 | 缓解 |
|------|------|
| Skill 执行任意 bash | Extract 沙箱；网络/路径 scope；超时 |
| 不可信仓库中的 project skill | `trust_project_skills: false` 时忽略 `<vault>/.agents/skills/`，除非用户 `memoss skill trust` |
| 凭证泄露 | 仅环境变量 / `~/.memoss/secrets.yaml`（gitignore）；禁止写入 vault |
| 超大输出 | `bash` stdout 截断；skill 输出写文件 |

参考 skills.sh 安全审计（Socket/Snyk）作为 `memoss skill add` 可选提示，非阻断。

---

## 11. 包结构与文件清单

```
packages/core/src/
├── skills/
│   ├── types.ts              # SkillRecord, SkillCatalog
│   ├── discovery.ts          # 扫描 .agents/skills/
│   ├── parse-skill-md.ts     # frontmatter 解析
│   ├── catalog.ts            # 构建 catalog XML/JSON
│   ├── activate.ts           # 加载 body + list resources
│   └── router.ts             # 混合策略 C 路由
├── engine/
│   ├── extract-runner.ts     # runExtract()
│   ├── extract-prompt.ts
│   └── prompts/extract.md
├── tools/
│   ├── extract-registry.ts   # Extract Agent 工具集
│   ├── activate-skill.ts
│   └── bash.ts

apps/cli/src/commands/
├── extract.ts
└── skill.ts                  # add | list | update | trust
```

### 11.1 公开 API

```typescript
// @memoss/core
export { discoverSkills, buildSkillCatalog } from './skills/catalog.js';
export { resolveExtractorSkill } from './skills/router.js';
export { runExtract, type ExtractRunOptions, type ExtractRunResult } from './engine/extract-runner.js';
```

---

## 12. CLI 参考

```bash
# 安装 skill（标准生态）
memoss skill add kepano/obsidian-skills --skill defuddle
memoss skill add anthropics/skills --skill pdf

# 列出已安装
memoss skill list

# 仅提取
memoss extract https://example.com
memoss extract report.pdf --skill pdf

# 提取 + 入库（默认）
memoss ingest https://example.com                    # config: web → defuddle
memoss ingest https://example.com --skill firecrawl-scrape
memoss ingest report.pdf --skill pdf
memoss ingest sources/extracted/report.md            # 跳过 extract

# 信任项目 skill
memoss skill trust
```

---

## 13. 配置 Schema（Zod 扩展）

```typescript
const extractionConfigSchema = z.object({
  enabled: z.boolean().default(true),
  auto_select: z.boolean().default(true),
  cache: z.boolean().default(true),
  output_dir: z.string().default('sources/extracted'),
  skills: z.record(z.string()).default({}),   // extract_kind → skill name
  skill_overrides: z.record(z.string()).default({}),  // Phase 2: glob → skill
  model: modelSpecSchema.optional(),
  max_steps: z.number().int().positive().default(15),
  bash_timeout_ms: z.number().int().positive().default(120_000),
  trust_project_skills: z.boolean().default(false),
});
```

并入 `vaultConfigSchema.extraction`。

---

## 14. 分阶段实现

### Phase 1 — 核心（MVP）

- [ ] `skills/discovery` + `parse-skill-md` + `catalog`
- [ ] `skills/router`（混合 C：CLI > config > auto_select > fallback）
- [ ] Extract Agent + `activate_skill` + `bash` + `read_file` + `write_file`
- [ ] `runExtract()` + `memoss extract`
- [ ] `runIngest` 集成 `extract: 'auto'`
- [ ] `memoss skill add` / `list`（包装 npx skills）
- [ ] 向 vercel-labs/skills 提交 `memoss` agent 路径映射

**验收：** 安装 `defuddle` + `pdf`，`memoss ingest <url>` 与 `memoss ingest file.pdf` 端到端成功。

### Phase 2 — 生产化

- [ ] Extract 缓存
- [ ] `sources/manifest.yaml` 集成（M9）
- [ ] `skill_overrides` glob 路由
- [ ] `memoss skill trust`
- [ ] Fast Path（可选：单命令 skill 无 LLM 直跑）

### Phase 3 — 复杂来源

- [ ] audio / video skill（whisper 等）
- [ ] 数据库 schema skill
- [ ] GitHub 源专用 extract skill 映射

---

## 15. 示例：jina / mineru（社区 skill）

Memoss 不内置 jina/mineru；用户安装 **标准格式** 社区 skill 后在 config 映射：

```bash
memoss skill add <owner/repo> --skill jina-reader
```

```yaml
extraction:
  skills:
    web: jina-reader
    pdf: mineru-pdf
```

Skill 作者只需按 agentskills.io 规范编写 SKILL.md（调用 Jina Reader API 或 MinerU CLI 的步骤），无需 Memoss 专用字段。

---

## 16. 测试策略

| 层级 | 内容 |
|------|------|
| Unit | `parse-skill-md`、`router` 优先级、kind 推断 |
| Integration | mock Extract Agent；fallback 路径 |
| E2E（可选） | 固定 HTML/PDF fixture + 本地 skill stub（`scripts/echo.sh`） |

CI 不依赖外部 API（jina/firecrawl）；用 vault 内 **test skill** 目录。

---

## 17. 开放问题

1. **vercel-labs/skills agent 注册**：需 PR 添加 `memoss` → `.agents/skills/` 映射；落地前可用 `--dir` 手动指定。
2. **Windows bash**：Extract Agent 默认 `bash`；Windows 需 `shell: powershell` 或 WSL 检测（Phase 1 文档注明 WSL 推荐）。
3. **MCP 暴露**：Phase 2 将 `run_extract` 注册为 MCP tool，与 `run_ingest` 并列。

---

## 18. 决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| Skill 格式 | 纯 agentskills.io | 复用 skills.sh 生态，零改造 |
| 执行模型 | Extract Agent 按 SKILL.md 执行 | 与标准 skill 语义一致 |
| 路由策略 | **C 混合** | 可预测（config/CLI）+ 灵活（auto_select） |
| 提取产物 | `sources/extracted/*.md` | 不可变来源层，可审计、可复跑 Ingest |
| Fallback | 内置 fetch/pdf-parse | 零 skill 时仍可工作 |
