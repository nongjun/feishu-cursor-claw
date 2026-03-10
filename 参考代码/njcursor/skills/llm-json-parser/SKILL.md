---
name: llm-json-parser
description: 从 AI 回复中提取和解析 JSON 数据，处理 thinking 标签、Markdown 代码块、混合文本。当解析 AI 返回的 JSON 失败或需要从 LLM 回复中提取结构化数据时使用。
---

# LLM JSON 解析

## 当前实现

位于 AIService 内部，使用正则表达式提取（非 json-repair 库）。

## 关键函数

| 函数 | 用途 |
|------|------|
| parse_ai_json_response(content) | 提取并解析 JSON，返回 (dict, thinking_text) |
| safe_parse_ai_json(content, default) | 带默认值的安全解析 |

## 处理流程

1. 提取并移除 thinking 标签内容
2. 识别 Markdown 代码块（json 或无标记）
3. 从混合文本中用正则提取 JSON 对象
4. 标准 json.loads() 解析

## 适用场景

- AI 回复包裹在 thinking 标签中
- AI 回复被 Markdown 代码块包裹
- AI 回复中混有自然语言和 JSON

## 重点关注

- 当前实现不使用 json-repair 库，仅做正则提取
- 对于中文标点、未闭合引号等格式问题暂无自动修复
- 如需更强容错能力，可引入 json-repair 库增强

## 导入路径

`shared_backend.services.ai_service` 中导出 `parse_ai_json_response` 和 `safe_parse_ai_json`。

## 参考文件

- 公共模块/shared_backend/services/ai_service.py
