# feishu-cursor-claw

> Turn Feishu/Lark into a remote control for Cursor AI — text, voice, and images to code changes (and beyond).

Send a message on your phone, and your Mac writes code, reviews documents, or executes strategy tasks. No VPN, no SSH, no browser needed.

**[中文文档](#中文文档)**

---

## Why

Cursor Agent CLI is incredibly powerful, but you need to be at your desk to use it. **feishu-cursor** bridges that gap: connect Feishu (Lark) to your local Cursor IDE via WebSocket, and control it from anywhere — your phone, a meeting, a coffee shop.

Beyond coding, executives and knowledge workers use this to co-create documents, review strategies, and manage files with AI — turning Cursor into a **personal AI strategic partner** driven entirely via instant messaging.

## Architecture

```
Phone (Feishu) ──WebSocket──→ feishu-cursor ──Cursor CLI──→ Local Cursor IDE
                                    │                          │
                             ┌──────┼──────┐            --resume (session continuity)
                             │      │      │
                          Text   Image   Voice
                                          │
                               Volcengine STT (primary)
                               Local whisper (fallback)
                                    │
                             ┌──────┴──────┐
                          Scheduler    Heartbeat
                          (cron-jobs)  (HEARTBEAT.md)
```

## Features

- **Multi-modal input**: text, images, voice messages, files, rich text
- **Session continuity**: auto-resume conversations per workspace
- **Voice-to-text**: Volcengine Doubao STT (primary, high-accuracy Chinese) → local whisper-cpp (fallback)
- **Live progress**: real-time streaming of thinking / tool calls / responses via Feishu cards
- **Elapsed time**: completion cards show total execution time
- **Smart queuing**: global concurrency limit + per-workspace serialization
- **Project routing**: prefix messages with `project:` to target different workspaces
- **Hot reload**: edit `.env` to change API keys, models, STT config — no restart needed
- **Bilingual commands**: all Feishu commands support both English and Chinese
- **Security**: sensitive commands (like API key changes) are blocked in group chats
- **Smart error guidance**: auth failures auto-display fix steps with dashboard links
- **Model fallback**: billing errors auto-downgrade to `auto` model with notification
- **Memory system v2**: OpenClaw-style identity + memory with embedding cache, incremental indexing, FTS5 BM25 keyword search, and vector hybrid search
- **Smart memory injection**: memory context injected only on the first message of each session (subsequent messages skip injection — Cursor already has context via `--resume`)
- **Scheduled tasks**: AI-created cron jobs via `cron-jobs.json` — supports one-shot, interval, and cron expressions
- **Heartbeat system**: periodic AI check-in via `HEARTBEAT.md` with active hours support
- **Auto workspace init**: first run auto-copies identity/memory templates to your workspace

## Quick Start

### 1. Prerequisites

- macOS with [Bun](https://bun.sh) installed
- [Cursor IDE](https://cursor.com) with Agent CLI (`~/.local/bin/agent`)
- A [Feishu](https://open.feishu.cn) bot app (WebSocket mode, no public URL needed)

### 2. Install & Configure

```bash
git clone https://github.com/nongjun/feishu-cursor-claw.git
cd feishu-cursor-claw
bun install

cp .env.example .env
# Edit .env with your credentials
```

### 3. Run

```bash
bun run server.ts
```

You should see:

```
飞书长连接已启动，等待消息...
```

Send a message to your Feishu bot and watch Cursor work.

## Feishu Commands

All commands support Chinese aliases:

| Command | Chinese | Description |
|---------|---------|-------------|
| `/help` | `/帮助` `/指令` | Show help |
| `/status` | `/状态` | Service status (model, key, STT, sessions) |
| `/new` | `/新对话` `/新会话` | Reset workspace session |
| `/model name` | `/模型 name` `/切换模型 name` | Switch model |
| `/apikey key` | `/密钥 key` `/换key key` | Update API key (DM only) |
| `/stop` | `/终止` `/停止` | Kill running agent task |
| `/memory` | `/记忆` | Memory system status |
| `/memory query` | `/记忆 关键词` | Semantic search memories |
| `/log text` | `/记录 内容` | Write to today's daily log |
| `/reindex` | `/整理记忆` | Rebuild memory index |
| `/task` | `/任务` `/cron` `/定时` | View/manage scheduled tasks |
| `/heartbeat` | `/心跳` | View/manage heartbeat system |

**Project routing**: `projectname: your message` routes to a specific workspace.

## Voice Recognition

Two-tier STT with automatic fallback:

| Engine | Quality | Notes |
|--------|---------|-------|
| **Volcengine Doubao** | Excellent (Chinese) | Primary. Requires [Volcengine](https://console.volcengine.com/speech/app) account |
| **Local whisper-cpp** | Basic | Fallback. Install via `brew install whisper-cpp` |

Volcengine uses the [streaming speech recognition API](https://www.volcengine.com/docs/6561/1354869) via WebSocket binary protocol — optimized for short voice messages (5-60s).

## Configuration

Copy `.env.example` to `.env` and fill in your values:

| Variable | Required | Description |
|----------|----------|-------------|
| `CURSOR_API_KEY` | Yes | [Cursor Dashboard](https://cursor.com/dashboard) → Integrations → User API Keys |
| `FEISHU_APP_ID` | Yes | Feishu app ID |
| `FEISHU_APP_SECRET` | Yes | Feishu app secret |
| `CURSOR_MODEL` | No | Default: `opus-4.6-thinking` |
| `VOLC_STT_APP_ID` | No | Volcengine app ID (skip to disable cloud STT) |
| `VOLC_STT_ACCESS_TOKEN` | No | Volcengine access token |
| `VOLC_EMBEDDING_API_KEY` | No | Volcengine embedding API key (for memory vector search) |
| `VOLC_EMBEDDING_MODEL` | No | Default: `doubao-embedding-vision-250615` |

### Feishu Bot Setup

1. Create an app at [Feishu Open Platform](https://open.feishu.cn)
2. Add **Bot** capability
3. Permissions: `im:message`, `im:message.group_at_msg`, `im:resource`
4. Events: subscribe to `im.message.receive_v1` via **WebSocket mode** (long connection)

### Project Routing

Create `../projects.json` (one level up from the bot directory):

```json
{
  "projects": {
    "mycode": { "path": "/path/to/code/project", "description": "Code project" },
    "strategy": { "path": "/path/to/strategy/docs", "description": "Strategy workspace" }
  },
  "default_project": "mycode"
}
```

Then in Feishu: `strategy: 帮我审阅这份季度规划` routes to the strategy workspace.

## Memory & Identity System

Inspired by [OpenClaw](https://github.com/openclaw/openclaw), the bot includes a full identity + memory framework that gives your AI persistent personality and long-term memory.

### Architecture

```
templates/                   Shipped with the repo (factory defaults)
├── SOUL.md                  Personality & principles
├── IDENTITY.md              Name, emoji, vibe
├── AGENTS.md                Workspace operating rules
├── USER.md                  Owner profile & preferences
├── TOOLS.md                 Tool capability memo
├── MEMORY.md                Long-term memory skeleton
└── .cursor/rules/           Cursor rule files
    ├── agent-identity.mdc   Identity + soul loading
    ├── memory-protocol.mdc  Memory read/write protocol
    └── scheduler-protocol.mdc  Scheduled task creation protocol

~/your-workspace/            User's actual workspace (auto-initialized)
├── SOUL.md                  Customized personality
├── IDENTITY.md              Your AI's identity
├── USER.md                  Your personal profile
├── MEMORY.md                Real memories (auto-updated)
├── memory/                  Daily logs (YYYY-MM-DD.md)
├── sessions/                Conversation transcripts (YYYY-MM-DD.jsonl)
├── .memory.sqlite           Vector embeddings database
├── HEARTBEAT.md             Heartbeat checklist (AI reads periodically)
├── TASKS.md                 Task documentation
└── cron-jobs.json           Scheduled tasks (AI-writable)
```

### How It Works

1. **First run**: `server.ts` auto-copies templates to your workspace (skips existing files)
2. **Session start**: bot searches memories via vector + FTS5 BM25 hybrid search, injects relevant context into the first message
3. **Within a session**: subsequent messages skip memory injection (Cursor retains context via `--resume`)
4. **After each reply**: user message + assistant reply logged to session history
5. **Incremental indexing**: only re-embeds files that have actually changed (tracked by content hash)
6. **Embedding cache**: same text chunk is never sent to the embedding API twice
7. **Feishu commands**: `/memory`, `/log`, `/reindex` for manual memory operations
8. **Cursor rules**: `.cursor/rules/*.mdc` tell Cursor to read identity/memory files on session start

### Customization

Edit your workspace files to personalize:

- **`IDENTITY.md`** — give your AI a name, emoji, and personality
- **`USER.md`** — fill in your info so the AI serves you better
- **`SOUL.md`** — adjust core principles and behavioral boundaries
- **`MEMORY.md`** — the AI maintains this automatically, but you can edit it too

## Roadmap

```
Phase 1: Bridge ✅ (current)
  ✅ Feishu ↔ Cursor CLI bridge
  ✅ Voice recognition (Volcengine + whisper fallback)
  ✅ Bilingual command system
  ✅ Streaming progress + smart queuing + session continuity
  ✅ Security (group chat protection, smart error guidance)

Phase 2: Smart Agent
  ✅ Persistent memory v2 (embedding cache, incremental indexing, FTS5 BM25, session-first injection)
  ✅ Heartbeat monitoring (HEARTBEAT.md + configurable intervals + active hours)
  ✅ Scheduled tasks (AI-created cron jobs via cron-jobs.json file watching)
  🔲 Multi-user isolation (Feishu user_id → independent workspace/session)
  🔲 More IM support (Slack / Discord / Telegram / WeChat)

Phase 3: Platform
  🔲 Pluggable IM adapter architecture
  🔲 Web dashboard (task history, analytics, configuration)
  🔲 Webhook triggers (GitHub Events → auto agent execution)
  🔲 Team collaboration (shared agent resource pool)
```

## License

[MIT](LICENSE)

---

# 中文文档

## 这是什么

**feishu-cursor** 将飞书变成 Cursor AI 的远程遥控器。在手机上发消息，你的 Mac 就自动写代码、审文档、执行任务。

不仅仅是编程工具——企业高管可以用它和 AI 共创战略文档、审阅文件、管理知识库，让 Cursor 成为你的**私人 AI 战略合伙人**。

## 快速开始

### 前置条件

| 项目 | 要求 |
|------|------|
| 系统 | macOS (Apple Silicon) |
| 运行时 | [Bun](https://bun.sh) |
| IDE | [Cursor](https://cursor.com) 已安装并登录 |
| CLI | Cursor Agent CLI (`~/.local/bin/agent`) |
| 语音(可选) | `brew install ffmpeg whisper-cpp` |

### 安装

```bash
git clone https://github.com/nongjun/feishu-cursor-claw.git
cd feishu-cursor-claw
bun install
cp .env.example .env
# 编辑 .env 填入你的凭据
```

### 启动

```bash
bun run server.ts
```

### 飞书机器人配置

1. 在[飞书开放平台](https://open.feishu.cn)创建企业自建应用
2. 添加**机器人**能力
3. 权限：`im:message`、`im:message.group_at_msg`、`im:resource`
4. 事件订阅：选择**长连接模式**，订阅 `im.message.receive_v1`
5. 将 App ID 和 App Secret 填入 `.env`

### 飞书指令

| 指令 | 中文别名 | 说明 |
|------|----------|------|
| `/help` | `/帮助` `/指令` | 显示帮助 |
| `/status` | `/状态` | 查看服务状态 |
| `/new` | `/新对话` `/新会话` | 重置当前工作区会话 |
| `/model 名称` | `/模型 名称` `/切换模型 名称` | 切换模型 |
| `/apikey key` | `/密钥 key` `/换key key` | 更换 API Key（仅限私聊） |
| `/stop` | `/终止` `/停止` | 终止当前运行的任务 |
| `/memory` | `/记忆` | 查看记忆系统状态 |
| `/memory 关键词` | `/记忆 关键词` | 语义搜索记忆 |
| `/log 内容` | `/记录 内容` | 写入今日日记 |
| `/reindex` | `/整理记忆` | 重建记忆索引 |
| `/任务` | `/cron` `/定时` | 查看/管理定时任务 |
| `/心跳` | `/heartbeat` | 查看/管理心跳系统 |

## 记忆与身份体系

灵感来自 [OpenClaw](https://github.com/openclaw/openclaw)，为你的 AI 赋予持久人格和长期记忆。

### 文件结构

| 文件 | 用途 | 是否需要定制 |
|------|------|------------|
| `SOUL.md` | AI 的灵魂和人格 | 可选（默认已有不错的通用人格） |
| `IDENTITY.md` | 名字、Emoji、气质 | **推荐**（给你的 AI 一个身份） |
| `AGENTS.md` | 工作区操作规范 | 可选 |
| `USER.md` | 你的个人信息和偏好 | **推荐**（帮 AI 更好地服务你） |
| `TOOLS.md` | 工具使用备忘 | 按需添加 |
| `MEMORY.md` | 长期记忆 | AI 自动维护，也可手动编辑 |
| `memory/*.md` | 每日日记 | 自动生成 |
| `sessions/*.jsonl` | 会话转录 | 自动记录 |

### 工作原理

1. **首次启动**：`server.ts` 自动将 `templates/` 中的模板复制到你的工作区（已有文件不覆盖）
2. **新会话首条消息**：向量 + FTS5 BM25 混合搜索相关记忆，注入上下文
3. **会话内后续消息**：跳过记忆注入（Cursor 通过 `--resume` 保持上下文）
4. **每条消息**：用户消息 + AI 回复自动记录到会话日志
5. **增量索引**：仅对内容变化的文件重新嵌入（按内容 hash 追踪）
6. **嵌入缓存**：相同文本块永远不会重复调用嵌入 API
7. **Cursor 规则**：`.cursor/rules/*.mdc` 指导 Cursor 在会话开始时读取身份和记忆文件
8. **定时任务**：Cursor Agent 可写入 `cron-jobs.json` 自动创建定时任务，到期自动执行并飞书通知
9. **心跳检查**：定期读取 `HEARTBEAT.md` 检查清单，有异常自动通知

### 定制

编辑工作区里的文件即可个性化：

- `IDENTITY.md` — 给你的 AI 起个名字
- `USER.md` — 填入你的信息
- `SOUL.md` — 调整核心原则和行为边界

## 定时任务与心跳

### 定时任务

在飞书对话中告诉 AI 创建定时任务，AI 会自动写入 `cron-jobs.json`：

- "每天早上9点检查邮件" → cron 表达式
- "每小时检查服务状态" → 固定间隔
- "明天下午3点提醒我开会" → 一次性任务

管理指令：

| 指令 | 说明 |
|------|------|
| `/任务` | 查看所有定时任务 |
| `/任务 暂停 ID` | 暂停任务 |
| `/任务 恢复 ID` | 恢复任务 |
| `/任务 删除 ID` | 删除任务 |
| `/任务 执行 ID` | 手动触发 |

### 心跳系统

编辑 `HEARTBEAT.md` 添加检查项，然后开启心跳：

| 指令 | 说明 |
|------|------|
| `/心跳 开启` | 启动心跳检查 |
| `/心跳 关闭` | 停止 |
| `/心跳 间隔 30` | 设为每 30 分钟 |
| `/心跳 执行` | 立即检查一次 |

心跳检查时 AI 阅读 `HEARTBEAT.md`，一切正常回复 `HEARTBEAT_OK`，有异常自动飞书通知。

## 语音识别配置

**推荐开通[火山引擎](https://console.volcengine.com/speech/app)**：

1. 创建应用，获取 APP ID 和 Access Token
2. 开通「大模型流式语音识别」服务（资源 ID：`volc.bigasr.sauc.duration`）
3. 填入 `.env` 中的 `VOLC_STT_APP_ID` 和 `VOLC_STT_ACCESS_TOKEN`

不配置火山引擎时自动使用本地 whisper-tiny（质量较低但可离线工作）。

**降级链路**：火山引擎豆包大模型 → 本地 whisper-cpp → 告知用户

### 向量记忆搜索（可选）

配置火山引擎向量嵌入 API 启用语义记忆搜索：

1. 在 `.env` 中设置 `VOLC_EMBEDDING_API_KEY`
2. 默认模型：`doubao-embedding-vision-250615`（无需修改）
3. 首次启动自动索引工作区的 `MEMORY.md` 和 `memory/*.md`

## 项目路由

在上层目录创建 `projects.json`：

```json
{
  "projects": {
    "code": { "path": "/Users/你/Projects/myapp", "description": "代码项目" },
    "strategy": { "path": "/Users/你/Documents/战略", "description": "战略文档" }
  },
  "default_project": "code"
}
```

飞书中发送 `strategy: 帮我审阅季度规划` → 路由到战略文档工作区。

## 日常运维

- **换 Key / 换模型**：飞书发 `/密钥 key_xxx...` 或 `/模型 sonnet-4`，无需重启
- **后台运行**：`nohup bun run server.ts > /tmp/feishu-cursor.log 2>&1 &`
- **查看日志**：`tail -f /tmp/feishu-cursor.log`
- **API Key 失效**：飞书卡片会自动提示修复步骤 + Dashboard 链接

## 故障排查

| 问题 | 解决 |
|------|------|
| 飞书无响应 | `ps aux \| grep server.ts` 检查进程；node_modules 损坏时删除后重新 `bun install` |
| API Key 无效 | 飞书发 `/密钥 新的key`，或编辑 .env |
| 语音识别出繁体/乱码 | 火山引擎配置有误，正在用 whisper 兜底，检查 VOLC_STT 配置 |
| `resource not granted` | 火山引擎控制台开通「大模型流式语音识别」 |
| 模型欠费 | 自动降级 auto，充值后恢复 |
| 群聊里发了 Key | 系统自动拦截，不会执行；建议到 Dashboard 轮换 Key |
