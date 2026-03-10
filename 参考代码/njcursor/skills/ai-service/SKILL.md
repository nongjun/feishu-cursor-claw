---
name: ai-service
description: 统一 AI 调用服务，三服务商策略（4sapi+sodao+OpenRouter），支持文本对话、图片理解、PDF/音视频分析、图像生成、流式输出、智能降级。当需要接入大语言模型或实现多模态 AI 功能时使用。
---

# AI Service

## 架构概览

调用方 → AIService → 门户模型注册表 → 4sapi（首选）/ sodao（次选）/ OpenRouter（备选），按 function_code 匹配绑定模型。

## 核心能力

| 方法 | 用途 |
|------|------|
| `chat()` | 文本对话（支持智能降级） |
| `chat_stream()` | 流式输出 |
| `chat_stream_thinking()` | Thinking 模型专用流式接口 |
| `vision()` | 图片理解 |
| `analyze_pdf()` | PDF 分析 |
| `analyze_audio()` | 音频分析 |
| `analyze_video()` | 视频分析 |
| `generate_image()` | 图像生成 |

## SOP：接入 AI 功能

1. 导入：`from shared_backend.services.ai_service import AIService`
2. 实例化：`AIService(module_code="模块名", db_session=db)`
3. 注册提示词（可选）：用于日志追踪
4. 调用对应方法，传入 `prompt_name` 用于统计

## 重点关注

### 三服务商 + 降级链

- 首选 **4sapi**，次选 **sodao**（苏打API），备选 **OpenRouter**
- 降级链（三阶段）：
  - Phase 1（4sapi）：Claude Opus 4.6 Thinking → Gemini 3.1 Pro → Gemini Flash
  - Phase 2（sodao）：Gemini 3.1 Pro → Gemini Flash（**不重试 opus**）
  - Phase 3（OpenRouter）：DeepSeek Chat V3 → Qwen 2.5 72B（国产模型兜底）
- 降级缓存机制：某模型连续失败后暂时跳过

### 门户模型注册表（v2）

- 管理员在门户「AI 配置 → 模型管理」注册可用模型（`ai_available_models` 表），每个模型自带 `base_url` + `api_key` + `model`
- 各模块在「AI 配置 → 模型绑定」通过 `module_code` + `function_code` 绑定指定模型（`ai_module_model_config` 表）
- 运行时 `AIService(module_code, function_code=, db_session=)` 自动查询绑定，优先使用绑定模型，未绑定时走全局降级链
- 门户后台可动态切换模型，无需改代码

### JSON 解析工具

- `parse_ai_json_response(content)` — 从 AI 回复中提取 JSON
- `safe_parse_ai_json(content, default)` — 带默认值的安全解析
- 自动处理 `<thinking>` 标签、Markdown 代码块、混合文本

### API Key 管理

- 统一从门户系统动态获取（`SAPI_API_KEY` / `SODAO_API_KEY` / `OPENROUTER_API_KEY`），**禁止硬编码**
- 门户地址配置：`PORTAL_API_URL`

## 参考文件

- `公共模块/shared_backend/services/ai_service.py`（主实现）
- `文档/核心信念/AI调用规范.md`
