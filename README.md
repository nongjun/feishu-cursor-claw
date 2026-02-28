# feishu-cursor

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

## Quick Start

### 1. Prerequisites

- macOS with [Bun](https://bun.sh) installed
- [Cursor IDE](https://cursor.com) with Agent CLI (`~/.local/bin/agent`)
- A [Feishu](https://open.feishu.cn) bot app (WebSocket mode, no public URL needed)

### 2. Install & Configure

```bash
git clone https://github.com/nongjun/feishu-cursor.git
cd feishu-cursor
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

## Roadmap

```
Phase 1: Bridge ✅ (current)
  ✅ Feishu ↔ Cursor CLI bridge
  ✅ Voice recognition (Volcengine + whisper fallback)
  ✅ Bilingual command system
  ✅ Streaming progress + smart queuing + session continuity
  ✅ Security (group chat protection, smart error guidance)

Phase 2: Smart Agent
  🔲 Persistent memory (conversation history + context summarization)
  🔲 Heartbeat monitoring (service health + Cursor connectivity probes)
  🔲 Scheduled tasks (cron-triggered agent execution)
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
git clone https://github.com/nongjun/feishu-cursor.git
cd feishu-cursor
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

## 语音识别配置

**推荐开通[火山引擎](https://console.volcengine.com/speech/app)**：

1. 创建应用，获取 APP ID 和 Access Token
2. 开通「大模型流式语音识别」服务（资源 ID：`volc.bigasr.sauc.duration`）
3. 填入 `.env` 中的 `VOLC_STT_APP_ID` 和 `VOLC_STT_ACCESS_TOKEN`

不配置火山引擎时自动使用本地 whisper-tiny（质量较低但可离线工作）。

**降级链路**：火山引擎豆包大模型 → 本地 whisper-cpp → 告知用户

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
