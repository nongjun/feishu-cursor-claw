# Git 提交和推送命令

当用户调用此命令时，执行以下操作：

## 目标仓库

- **默认仓库**：`/root/瑞小美AiOS`（瑞小美 AiOS 项目）
- 该仓库配置了两个远程：origin (Gitea) 和 github (GitHub)
- Cursor 的 git 扩展已禁用（`git.enabled: false`），所有 git 操作通过本命令执行

## 操作步骤

> **设计原则**：先提交再拉取，本地更改始终安全保存在提交中

### 0. 健康检查（自动执行，有问题才输出）

用一条命令完成，有修复才显示：

```bash
cd /root/瑞小美AiOS \
  && (test -n "$(git stash list)" && git stash clear && rm -f .git/refs/stash .git/logs/refs/stash && echo "⚠️ 已清理 stash" || true) \
  && (test -n "$(git ls-files -u)" && rm -f .git/index && git checkout -f HEAD && echo "⚠️ 已重建 index" || true)
```

### 1. 检查 Git 状态

- 运行 `git status` 查看当前工作区
- 如果没有任何更改，提示用户并结束

### 2. 提交代码

- `git add -A`
- 分析改动内容，生成提交信息：
  - 格式：`[类型] 简要描述`
  - 类型：feat / fix / docs / style / refactor / chore
  - **多模块改动时**：第一行概括，下方按模块列出要点
- `git commit -m "提交信息"`

### 3. 拉取远程更新

- `git pull --rebase origin <当前分支>`
- rebase 保持线性历史，不同文件会自动合并

### 4. 推送到远程

- 并行推送到 origin 和 github
- github 设置 45 秒超时（国内网络不稳定），超时不阻塞，提示后续手动重试即可
- 新分支使用 `git push -u`

### 5. 输出结果表格

```
| 步骤 | 状态 |
|------|------|
| 健康检查 | ✅ / ⚠️ 已修复 |
| 提交 | ✅ commit_hash — 文件数, +增/-删 |
| 拉取更新 | ✅ / 合并了 N 个提交 |
| 推送 origin | ✅ / ❌ |
| 推送 github | ✅ / ⏳ 超时 |
```

## 示例提交信息

单模块：
```
[feat] 添加用户登录功能
```

多模块：
```
[feat] 老带新政策优化与会话存档增强

老带新:
- 政策模型新增字段
- 回调服务优化

会话存档:
- 新增质检服务
```

## 注意事项

- 显示操作的每一步结果，让用户了解进度
- 某个仓库推送失败不影响其他仓库的推送
- **禁止使用 git stash**：本项目采用"先提交再拉取"策略
- **合并/切分支前先停容器**：`docker stop referral-backend` 等挂载了源代码的容器，操作完再 `docker start`
- **冲突标记搜索排除** node_modules 和 .git 目录
- **Cursor git 扩展已禁用**（`settings.json` 中 `git.enabled: false`），请勿恢复，避免自动 stash 污染 index

## Git 认证配置

- **账号**: nongjun
- **邮箱**: nongjun@163.com
- 远程仓库已配置 Personal Access Token 认证，推送无需再次输入凭据
- 如认证失效，参考 `github-credentials.md`（本地文件，不被 Git 跟踪）重新配置
