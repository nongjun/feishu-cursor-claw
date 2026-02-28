# 工作区模板

这些文件定义了你的 AI 助手的身份、记忆和行为规范。

## 核心理念

这套模板的设计哲学是：**不重造轮子，善用 Cursor 原生能力。**

Cursor Agent 天生就有文件操作、Shell 执行、网络搜索、浏览器自动化等能力。这些模板的作用是教 AI **如何使用**这些能力，以及赋予它**持久的身份和记忆**。

## 文件说明

### 身份文件

| 文件 | 用途 | 是否需要定制 |
|------|------|------------|
| `SOUL.md` | AI 的灵魂和人格准则 | 可选（默认已有不错的通用人格） |
| `IDENTITY.md` | 名字、Emoji、气质 | **推荐**（给你的 AI 一个身份） |
| `USER.md` | 你的个人信息和偏好 | **推荐**（帮 AI 更好地服务你） |

### 行为规范

| 文件 | 用途 | 是否需要定制 |
|------|------|------------|
| `AGENTS.md` | 工作区操作规范 | 可选（默认规范已够用） |
| `TOOLS.md` | Cursor 原生能力清单 + 自定义工具备忘 | 按需添加你的特定工具信息 |

### 记忆与自动化

| 文件 | 用途 | 是否需要定制 |
|------|------|------------|
| `MEMORY.md` | 长期记忆 | AI 自动维护，也可手动编辑 |
| `HEARTBEAT.md` | 心跳检查清单 | 按需添加你的检查项 |
| `TASKS.md` | 定时任务说明 | 参考文档 |

### Cursor 规则

| 文件 | 用途 |
|------|------|
| `.cursor/rules/agent-identity.mdc` | 身份加载 + 能力声明 |
| `.cursor/rules/memory-protocol.mdc` | 记忆读写协议 |
| `.cursor/rules/scheduler-protocol.mdc` | 定时任务创建协议 |
| `.cursor/rules/cursor-capabilities.mdc` | Cursor 原生能力使用引导 |

## 使用方式

1. 运行 `bash setup.sh`，模板会自动复制到你配置的工作区
2. 编辑 `IDENTITY.md` 和 `USER.md`，填入你的个人信息
3. `MEMORY.md` 和 `memory/*.md` 会随着使用自动积累
4. `.cursor/rules/` 下的规则文件告诉 Cursor 如何使用这些文件

## 记忆体系

灵感来自 [OpenClaw](https://github.com/openclaw/openclaw) 的记忆体系：

- **双层记忆**: `MEMORY.md`（长期精华） + `memory/YYYY-MM-DD.md`（每日日记）
- **向量搜索**: 语义相似度检索（需配置嵌入 API）
- **自动注入**: 每次新对话前自动搜索相关记忆并注入上下文
- **会话日志**: `sessions/*.jsonl` 记录所有对话

## 自定义

所有文件都可以自由编辑。AI 也会根据交互自动更新 `MEMORY.md` 和日记文件。

`SOUL.md` 是灵魂文件——如果 AI 要修改它，它会先告诉你。
