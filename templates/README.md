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

### 生命周期

| 文件 | 用途 | 是否需要定制 |
|------|------|------------|
| `BOOTSTRAP.md` | 出生仪式（首次启动时引导 AI 建立身份，完成后自动删除） | 一般不用改 |
| `BOOT.md` | 启动自检清单（每次服务启动时执行一次） | 可选（添加你的启动检查项） |

### 记忆与自动化

| 文件 | 用途 | 是否需要定制 |
|------|------|------------|
| `MEMORY.md` | 长期记忆 | AI 自动维护，也可手动编辑 |
| `HEARTBEAT.md` | 心跳检查清单 | AI 自动管理，也可手动编辑 |
| `TASKS.md` | 定时任务说明 | 参考文档 |

### Cursor 规则

| 文件 | 用途 |
|------|------|
| `.cursor/rules/soul.mdc` | 灵魂与人格准则 |
| `.cursor/rules/agent-identity.mdc` | 身份加载 + 飞书输出限制 |
| `.cursor/rules/user-context.mdc` | 主人信息与偏好 |
| `.cursor/rules/workspace-rules.mdc` | 安全守则、工具调用风格、操作边界 |
| `.cursor/rules/tools.mdc` | 能力清单 + 飞书桥接 |
| `.cursor/rules/memory-protocol.mdc` | 记忆召回、写入、防丢失、维护协议 |
| `.cursor/rules/scheduler-protocol.mdc` | 定时任务创建协议 |
| `.cursor/rules/heartbeat-protocol.mdc` | 心跳协议 + 状态追踪 |
| `.cursor/rules/cursor-capabilities.mdc` | Cursor 原生能力决策树 |

## 使用方式

1. 运行 `bash setup.sh`，模板会自动复制到你配置的工作区
2. 运行 `bash service.sh install`，安装开机自启动
3. 首次对话时 AI 会通过 `BOOTSTRAP.md` 引导你完成个性化（出生仪式）
4. 也可以手动编辑 `IDENTITY.md` 和 `USER.md` 填入你的个人信息
5. `MEMORY.md` 和 `memory/*.md` 会随着使用自动积累
6. `.cursor/rules/` 下的规则文件告诉 Cursor 如何使用这些文件

## 记忆体系

灵感来自 [OpenClaw](https://github.com/openclaw/openclaw) 的记忆体系：

- **双层记忆**: `MEMORY.md`（长期精华） + `memory/YYYY-MM-DD.md`（每日日记）
- **向量搜索**: 语义相似度检索（需配置嵌入 API）
- **记忆召回**: 回答关于过去的问题前必须先搜索记忆
- **记忆防丢失**: 长对话中主动保存关键信息，防止上下文溢出
- **禁止心理笔记**: 强制文件持久化，杜绝"我会记住"的幻觉
- **会话日志**: `sessions/*.jsonl` 记录所有对话
- **心跳状态**: `memory/heartbeat-state.json` 追踪检查历史

## 安全机制

从 OpenClaw 借鉴的安全守则，内置于 `workspace-rules.mdc`：

- 禁止自我保存/复制/资源获取/权力寻求行为
- 安全和人类监督优先于任务完成
- 不操纵/说服扩大权限或禁用安全措施
- 可恢复操作优先（`trash` > `rm`）

## 自定义

所有文件都可以自由编辑。AI 也会根据交互自动更新 `MEMORY.md` 和日记文件。

`SOUL.md` 是灵魂文件——如果 AI 要修改它，它会先告诉你。
