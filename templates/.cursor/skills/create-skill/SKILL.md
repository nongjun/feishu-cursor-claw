---
name: create-skill
description: 指导创建符合 Cursor 官方规范的 Agent Skill。当用户要求创建技能、编写 SKILL.md、或问到 skill 结构和最佳实践时使用。
---

# 创建 Cursor Agent Skill

## 开始之前：收集需求

1. **目的和范围**：这个 skill 帮助完成什么任务？
2. **存放位置**：个人 skill（`~/.cursor/skills/`）还是项目 skill（`.cursor/skills/`）？
3. **触发场景**：什么时候 agent 应该使用这个 skill？
4. **领域知识**：agent 需要什么它本身不知道的专业信息？
5. **输出格式**：有没有特定的模板或样式要求？

如果有 AskQuestion 工具可用，用结构化问题收集；否则直接对话式询问。

---

## 目录结构

```
skill-name/
├── SKILL.md              # 必须 — 主指令文件
├── reference.md          # 可选 — 详细文档
├── examples.md           # 可选 — 使用示例
└── scripts/              # 可选 — 工具脚本
    └── helper.sh
```

### 存放路径

| 类型 | 路径 | 作用域 |
|------|------|--------|
| 个人 | `~/.cursor/skills/skill-name/` | 所有项目可用 |
| 项目 | `.cursor/skills/skill-name/` | 跟随仓库共享 |

**禁止**在 `~/.cursor/skills-cursor/` 下创建，该目录为 Cursor 内置技能保留。

### SKILL.md 格式

```markdown
---
name: your-skill-name
description: 简要描述做什么以及何时使用
---

# Skill 标题

## 使用方法
清晰的分步指导。

## 示例
具体的使用范例。
```

### 元数据字段

| 字段 | 要求 | 用途 |
|------|------|------|
| `name` | 最长 64 字符，仅小写字母/数字/连字符 | 唯一标识 |
| `description` | 最长 1024 字符，非空 | agent 据此决定是否应用该 skill |

---

## 写好 description

description 是 skill 被发现和应用的关键。agent 根据它决定何时使用。

### 原则

1. **第三人称**（description 会被注入系统提示词）：
   - 好：`"处理 Excel 文件并生成报表"`
   - 差：`"我可以帮你处理 Excel 文件"`

2. **具体 + 包含触发词**：
   - 好：`"从 PDF 提取文字和表格，填写表单，合并文档。当处理 PDF 文件时使用。"`
   - 差：`"帮助处理文档"`

3. **同时包含 WHAT 和 WHEN**：
   - WHAT：skill 做什么（具体能力）
   - WHEN：什么时候应该用（触发场景）

---

## 核心写作原则

### 1. 简洁为王

上下文窗口与对话历史、其他 skill、请求共享。每个 token 都在竞争空间。

**默认假设**：agent 已经很聪明。只添加它不知道的上下文。

### 2. SKILL.md 控制在 500 行以内

详细参考放入单独文件，agent 需要时再读取。

```markdown
## 更多资源
- API 详情见 [reference.md](reference.md)
- 使用示例见 [examples.md](examples.md)
```

**引用保持一层深度** — 从 SKILL.md 直接链接到参考文件。

### 3. 匹配自由度

| 自由度 | 何时使用 | 示例 |
|--------|---------|------|
| **高**（文字指导） | 多种有效方案，依赖上下文 | 代码审查指南 |
| **中**（伪代码/模板） | 有首选模式但允许变通 | 报告生成 |
| **低**（具体脚本） | 脆弱操作，一致性关键 | 数据库迁移 |

---

## 常用模式

### 模板模式 — 提供输出格式

```markdown
## 报告结构
\`\`\`markdown
# [标题]
## 摘要
## 关键发现
## 建议
\`\`\`
```

### 示例模式 — 靠示例保证输出质量

```markdown
## 提交消息格式
**示例 1：**
输入：添加了 JWT 用户认证
输出：`feat(auth): implement JWT-based authentication`
```

### 工作流模式 — 分步检查清单

```markdown
## 执行步骤
- [ ] 步骤 1: 分析输入
- [ ] 步骤 2: 生成映射
- [ ] 步骤 3: 验证结果
```

### 反馈循环模式 — 质量关键任务

```markdown
1. 执行操作
2. **立即验证**: `python scripts/validate.py output/`
3. 验证失败 → 修复 → 重新验证
4. **验证通过后才继续**
```

---

## 反模式

| 反模式 | 正确做法 |
|--------|---------|
| Windows 路径 `scripts\helper.py` | `scripts/helper.py` |
| 选项过多 "可以用 A 或 B 或 C..." | 给一个默认方案，加逃逸口 |
| 时间敏感信息 "2025年前用旧API" | 用"当前方法"+"已废弃"分区 |
| 术语不一致 混用"端点/URL/路由" | 全文统一一个术语 |
| 模糊名称 `helper`, `utils` | 具体名称 `processing-pdfs` |

---

## 创建流程

### 阶段 1: 发现
收集目的、存放位置、触发场景、约束条件、现有模式。

### 阶段 2: 设计
1. 拟定 skill 名（小写、连字符、≤64 字符）
2. 写 description（第三人称、包含 WHAT + WHEN）
3. 确定需要哪些部分和支持文件

### 阶段 3: 实现
1. 创建目录结构
2. 编写 SKILL.md（含 frontmatter）
3. 创建支持文件和脚本

### 阶段 4: 验证
- [ ] SKILL.md < 500 行
- [ ] description 具体且包含触发词
- [ ] description 包含 WHAT 和 WHEN
- [ ] 第三人称描述
- [ ] 术语一致
- [ ] 示例具体非抽象
- [ ] 文件引用一层深度
- [ ] 无时间敏感信息
