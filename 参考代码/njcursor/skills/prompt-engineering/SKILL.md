---
name: prompt-engineering
description: AI 提示词管理与安全清洗工具，包含输入清洗（防注入）、提示词注册、模块功能点绑定。当开发 AI 功能、需要管理提示词或防止提示词注入时使用。
---

# 提示词工程

## 当前能力

| 能力 | 位置 | 说明 |
|------|------|------|
| 输入清洗 | shared_backend/utils/prompt_utils.py | 防 .format() 注入、移除控制字符 |
| 提示词注册 | AIService 内置方法 | scan_and_register_prompts() |
| 模型绑定 | 门户系统 | 按 function_code 绑定模型 |
| 自定义提示词 | 智能回复模块 | 数据库存储，用户可编辑 |

## 安全清洗函数

| 函数 | 用途 |
|------|------|
| sanitize_prompt_input(text) | 转义花括号防 .format() 注入 |
| sanitize_chat_message(text) | 更严格：移除控制字符+长度限制+伪装检测 |

## SOP：新增 AI 功能

1. 定义提示词模板文件（SYSTEM_PROMPT + USER_PROMPT + PROMPT_META）
2. 调用 sanitize_prompt_input() 清洗用户输入后再填充模板
3. 使用 AIService.chat() 调用，传入 prompt_name 用于统计
4. 在门户后台注册功能点并绑定模型

## 提示词模板规范

- PROMPT_META：name、display_name、description、module、variables
- SYSTEM_PROMPT：角色定义和约束
- USER_PROMPT：带变量占位符的任务模板
- 可选：OUTPUT_SCHEMA 定义结构化输出格式

## 重点关注

- 用户输入必须经过 sanitize 后再填充模板，防止注入
- 提示词文件放在模块的 prompts/ 目录下
- 通过门户系统可动态切换某功能点使用的模型
- 日志记录依赖传入 prompt_name 参数

## 参考文件

- 公共模块/shared_backend/utils/prompt_utils.py
- 公共模块/shared_backend/services/ai_service.py
