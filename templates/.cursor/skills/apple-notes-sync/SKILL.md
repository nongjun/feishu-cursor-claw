---
name: apple-notes-sync
description: 将 Mac 备忘录同步到工作区并加入向量索引，实现语义搜索。当用户说"同步备忘录"、"把备忘录加入记忆"、或想搜索备忘录内容时使用。
---

# Mac 备忘录向量化同步

## 前置条件

- macOS 系统
- 备忘录应用中有内容
- `relay-bot/sync-apple-notes.ts` 脚本存在

## 执行步骤

### 1. 同步备忘录

```bash
bun ~/Documents/Ai管理的文件夹/relay-bot/sync-apple-notes.ts
```

首次运行需要授权（系统弹窗），用户需允许访问备忘录。

备忘录数量大（>500 条）时先用 `--limit` 测试：

```bash
bun ~/Documents/Ai管理的文件夹/relay-bot/sync-apple-notes.ts --limit 50
```

### 2. 等待完成

- 约 1000 条需要 15-20 分钟
- 增量同步自动跳过未修改的备忘录
- 输出目录：`~/Documents/Ai管理的文件夹/apple-notes/`

### 3. 加入向量索引

```bash
bun ~/Documents/Ai管理的文件夹/relay-bot/memory-tool.ts index
```

### 4. 验证搜索

```bash
bun ~/Documents/Ai管理的文件夹/relay-bot/memory-tool.ts search "关键词"
```

## 脚本参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `--folder` | 只同步指定文件夹 | `--folder "工作"` |
| `--limit` | 限制每个文件夹处理数量 | `--limit 100` |

## 常见问题

### 数据库锁定 (database is locked)

```bash
lsof ~/Documents/Ai管理的文件夹/.memory.sqlite
kill <PID>  # 杀掉非 server.ts 的进程
```

### AppleScript 超时

备忘录太多导致超时。用 `--limit` 分批处理。

### 授权被拒绝

系统设置 → 隐私与安全性 → 自动化 → 允许终端/Cursor 访问 Notes

## 定时同步（可选）

在 `cron-jobs.json` 添加：

```json
{
  "id": "apple-notes-sync",
  "name": "每日同步 Mac 备忘录",
  "enabled": true,
  "schedule": { "kind": "cron", "expr": "0 3 * * *", "tz": "Asia/Shanghai" },
  "message": "执行 Mac 备忘录同步：\n1. 运行 sync-apple-notes.ts\n2. 运行 memory-tool.ts index\n3. 汇报同步结果"
}
```

## 输出结构

```
apple-notes/
├── Notes/              # 默认文件夹
│   ├── 备忘录1.md
│   └── 备忘录2.md
├── To Do/              # 待办文件夹
└── .sync-manifest.json # 同步状态记录
```
