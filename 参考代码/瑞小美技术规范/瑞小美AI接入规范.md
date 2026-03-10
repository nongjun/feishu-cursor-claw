# 瑞小美 AI 接入规范

> 适用于瑞小美全团队所有 AI 相关项目  
> **最后更新**：2026-01-21

---

## 核心原则

| 原则 | 要求 |
|------|------|
| **优先最强** | 所有 AI 任务**默认使用 Claude Opus 4.5**，失败后自动降级 |
| **智能降级** | Claude → Gemini Pro → Gemini Flash（每级重试 2 次） |
| **多 Key 策略** | **通用 Key**（Gemini/DeepSeek）+ **Anthropic Key**（Claude 专属） |
| **服务商策略** | **首选 4sapi.com → 备选 OpenRouter.ai**（自动降级） |
| **统一配置** | 从**门户系统**统一获取 Key，各模块**禁止独立配置** |
| **统一服务** | 通过 `shared_backend.AIService` 调用，禁止直接请求 API |

### 瑞小美 SCRM 配置入口

- **配置管理**：https://scrm.ireborn.com.cn → AI 配置
- **调用统计**：查看各模块 Token 使用量、成本、服务商分布
- **调用日志**：按模块、服务商、状态筛选历史调用

---

## 服务商配置

### 降级策略（强制）

```
请求流程：4sapi.com → (失败) → OpenRouter.ai
```

| 优先级 | 服务商 | API 地址 | 说明 |
|--------|--------|----------|------|
| **1（首选）** | 4sapi.com | `https://4sapi.com/v1/chat/completions` | 国内优化，延迟低 |
| **2（备选）** | OpenRouter.ai | `https://openrouter.ai/api/v1/chat/completions` | 模型全，稳定性好 |

**降级触发条件**（宽松策略，首选失败就尝试备选）：
- 连接超时（默认 30s）
- 服务端错误（5xx）
- 客户端错误（4xx）：余额不足、Key 无效、模型不存在等
- 网络异常

> ✅ **说明**：只要首选服务商调用失败，就会自动尝试备选服务商

### 4sapi.com 配置

**API 端点**：
```
https://4sapi.com/v1/chat/completions
```

**测试阶段 Key**（仅限开发环境）：

| Key 类型 | Key | 说明 |
|---------|-----|------|
| **通用 Key** | `***REMOVED-4SAPI-KEY***` | 支持几乎所有模型（Gemini/DeepSeek 等），**不支持 Claude** |
| **Claude 专用 Key** | `***REMOVED-4SAPI-KEY***` | 仅用于 Claude 模型调用 |

> ⚠️ **注意**：
> - 测试 Key 仅用于开发调试，正式环境 Key 在门户后台配置
> - 通用 Key 不能调用 Claude 模型，需使用 Claude 专用 Key
> - 生产环境需在门户系统配置两种 Key 以支持完整的模型降级策略

**官方文档**：
- [图片生成](https://4sapi.apifox.cn/359535008e0)
- [图片修改](https://4sapi.apifox.cn/359535009e0)
- [音频理解](https://4sapi.apifox.cn/359535011e0)
- [视频理解](https://4sapi.apifox.cn/359535012e0)
- [文档理解](https://4sapi.apifox.cn/359535013e0)
- [TTS 语音合成](https://4sapi.apifox.cn/382937873e0)
- [语音转文字](https://4sapi.apifox.cn/382936341e0)
- [Embeddings](https://4sapi.apifox.cn/359535014e0)

### OpenRouter.ai 配置（备选）

**API 端点**：
```
https://openrouter.ai/api/v1/chat/completions
```

**测试阶段 Key**（仅限开发环境）：
```
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
```

**官方文档**：[Images](https://openrouter.ai/docs/guides/overview/multimodal/images) | [PDFs](https://openrouter.ai/docs/guides/overview/multimodal/pdfs) | [Audio](https://openrouter.ai/docs/guides/overview/multimodal/audio) | [Videos](https://openrouter.ai/docs/guides/overview/multimodal/videos)

---

## Key 管理规范

### ⚠️ 强制要求

1. **禁止**在代码中硬编码 API Key
2. **必须**从门户系统统一获取配置
3. **必须**同时配置两个服务商的 Key（支持降级）

> 测试阶段 Key 见上方「服务商配置」章节

### 配置架构（瑞小美 SCRM）

```
┌───────────────────────────────────────────────────────────────┐
│  门户系统 (scrm.ireborn.com.cn)                                │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  AI 配置页面（仅超管可访问）                              │ │
│  │  - 首选服务商：4sapi.com（API Key + Base URL）           │ │
│  │  - 备选服务商：OpenRouter（API Key + Base URL）          │ │
│  │  - 默认模型                                              │ │
│  └─────────────────────────────────────────────────────────┘ │
│                              │                                 │
│                              ▼                                 │
│         GET /api/ai/internal/config （内部 API，无需鉴权）      │
└──────────────────────────────┬────────────────────────────────┘
                               │
       ┌───────────────────────┼───────────────────────────────┐
       │                       │                               │
       ▼                       ▼                               ▼
┌─────────────┐        ┌─────────────┐                ┌─────────────┐
│  会话存档    │        │  智能回复    │                │  撩回搭子    │
│  AIService  │        │  AIService  │                │  AIService  │
└─────────────┘        └─────────────┘                └─────────────┘
```

### 配置 API（门户系统已实现）

**端点**：`GET http://portal-backend:8000/api/ai/internal/config`

**返回格式**：
```json
{
  "code": 0,
  "data": {
    "primary": {
      "provider": "4sapi",
      "api_key": "sk-xxx...",
      "base_url": "https://4sapi.com/v1"
    },
    "fallback": {
      "provider": "openrouter",
      "api_key": "sk-or-v1-xxx...",
      "base_url": "https://openrouter.ai/api/v1"
    },
    "anthropic_api_key": "sk-xxx...",
    "models": {
      "primary": "claude-opus-4-5-20251101-thinking",
      "standard": "gemini-3-pro-preview",
      "fast": "gemini-3-flash-preview",
      "image": "gemini-2.5-flash-image-preview",
      "video": "veo3.1-pro"
    }
  }
}
```

**说明**：
- 各模块通过 Docker 内网访问 `portal-backend:8000`
- 配置有 **5 分钟缓存**，避免频繁调用
- 如需自定义端点，设置环境变量：`PORTAL_CONFIG_API=http://...`

---

## 支持的能力

| 能力 | 方法 | 说明 |
|------|------|------|
| 文本聊天 | `chat()` | 基础对话，支持多轮 |
| 图片理解 | `vision()` | PNG/JPEG/WebP/GIF |
| PDF 分析 | `analyze_pdf()` | 文档理解、OCR |
| 音频分析 | `analyze_audio()` | 语音转文字 |
| 视频分析 | `analyze_video()` | 视频内容理解 |
| 图像生成 | `generate_image()` | 文生图 |
| 流式输出 | `chat_stream()` | 逐字返回 |

> 官方文档见上方「服务商配置」章节

---

## 模型策略（智能降级）

### 核心原则：优先使用最强模型

**所有 AI 调用默认使用 Claude Opus 4.5，失败后在 4sapi 内部降级，4sapi 全部失败才切换 OpenRouter**

```
┌─────────────────────────────────────────────────────────────┐
│  4sapi (首选服务商)                                          │
│  Claude → 2次失败 → Gemini Pro → 2次失败 → Gemini Flash     │
└─────────────────────────────────────────────────────────────┘
                              ↓ 全部失败
┌─────────────────────────────────────────────────────────────┐
│  OpenRouter (备选服务商) - 不支持 Claude                     │
│  Gemini Pro → 2次失败 → Gemini Flash                        │
└─────────────────────────────────────────────────────────────┘
```

### 降级触发条件

| 条件 | 说明 |
|------|------|
| **首字超时** | 流式输出 **10 秒**内没有收到首字 |
| **请求失败** | 网络错误、API 错误、余额不足等 |
| **重试次数** | 每个模型最多 **2 次**，然后降级到下一个模型 |
| **服务商切换** | **4sapi 全部模型都失败后**才切换到 OpenRouter |

### 模型配置

| 等级 | 模型 | 4sapi | OpenRouter | 说明 |
|------|-----|-------|------------|------|
| 🥇 **首选** | `claude-opus-4-5-20251101-thinking` | ✅ | ❌ 不支持 | 所有任务首先尝试 |
| 🥈 **标准** | `gemini-3-pro-preview` | ✅ | ✅ | Claude 失败后降级 |
| 🥉 **快速** | `gemini-3-flash-preview` | ✅ | ✅ | 最终保底 |
| 🖼️ **生图** | `gemini-2.5-flash-image-preview` | ✅ | ✅ | 图像生成（不参与降级） |
| 🎬 **视频** | `veo3.1-pro` | ✅ | - | 视频生成（不参与降级） |

> ✅ 已验证可用（2026-01-20）

### 代码中使用

```python
from shared_backend.services.ai_service import (
    MODEL_PRIMARY,   # Claude Opus 4.5（默认）
    MODEL_STANDARD,  # Gemini 3 Pro
    MODEL_FAST,      # Gemini 3 Flash
    MODEL_IMAGE,     # 生图
    MODEL_VIDEO,     # 视频
    DEFAULT_MODEL,   # = MODEL_PRIMARY
)

# 默认调用（自动智能降级）
response = await ai.chat(messages, prompt_name="analysis")
# 4sapi: Claude → Gemini Pro → Gemini Flash
# 全部失败 → OpenRouter: Gemini Pro → Gemini Flash

# 指定从某个等级开始降级
response = await ai.chat(messages, model=MODEL_STANDARD, prompt_name="reply")
# 从 Gemini Pro 开始

# 禁用智能降级（只做简单服务商降级）
response = await ai.chat(messages, model=MODEL_FAST, auto_fallback=False, prompt_name="quick")

# 流式输出（同样支持智能降级 + 首字超时检测）
async for chunk in ai.chat_stream(messages, prompt_name="stream"):
    print(chunk, end="", flush=True)
```

### 降级日志示例

```
[archive] 4sapi claude-opus-4-5-20251101-thinking 第1次失败: timeout
[archive] 4sapi claude-opus-4-5-20251101-thinking 第2次失败: timeout
[archive] 4sapi claude-opus-4-5-20251101-thinking 失败2次，降级
[archive] 4sapi gemini-3-pro-preview 第1次失败: 502
[archive] 4sapi gemini-3-pro-preview 第2次失败: 502
[archive] 4sapi gemini-3-pro-preview 失败2次，降级
[archive] 4sapi gemini-3-flash-preview 第1次失败: 502
[archive] 4sapi gemini-3-flash-preview 第2次失败: 502
[archive] 4sapi 全部失败，切换到 OpenRouter
[archive] OpenRouter google/gemini-3-pro-preview 调用成功
```

---

## 调用示例

### 基础用法

```python
from shared_backend.services.ai_service import AIService

# module_code 标识你的模块，用于统计
ai = AIService(module_code="your_module", db_session=db)

# Key 自动从系统后台获取，无需手动指定
response = await ai.chat(
    messages=[
        {"role": "system", "content": "你是助手"},
        {"role": "user", "content": "你好"}
    ],
    prompt_name="greeting"  # 必填，用于调用统计
)
print(response.content)
```

### 图片理解

```python
response = await ai.vision(
    prompt="描述这张图片",
    images=["https://example.com/image.jpg"],  # URL / base64 / bytes
    prompt_name="image_analysis"
)
```

### PDF 分析

```python
response = await ai.analyze_pdf(
    prompt="总结要点",
    pdf="https://example.com/doc.pdf",
    pdf_engine="pdf-text",  # 免费 | "mistral-ocr" 收费
    prompt_name="pdf_summary"
)
```

### 音频/视频

```python
# 音频
response = await ai.analyze_audio(
    prompt="转录并总结", audio=audio_bytes, mime_type="audio/mp3"
)

# 视频
response = await ai.analyze_video(
    prompt="描述内容", video="https://example.com/video.mp4"
)
```

### 图像生成

```python
response = await ai.generate_image(
    prompt="一只橘猫",
    model=MODEL_IMAGE,  # 图像生成专用模型
    prompt_name="cat_gen"
)
for img in response.images:
    print(img)
```

### 流式输出

```python
async for chunk in ai.chat_stream(messages, prompt_name="stream_test"):
    print(chunk, end="", flush=True)
```

---

## 多模态消息格式

```python
# 图片
{"type": "image_url", "image_url": {"url": "https://..." or "data:image/jpeg;base64,..."}}

# PDF
{"type": "file", "file": {"filename": "doc.pdf", "file_data": "..."}}

# 音频
{"type": "input_audio", "input_audio": {"url": "..."}}

# 视频
{"type": "input_video", "input_video": {"url": "..."}}
```

---

## 工具函数

```python
from shared_backend.services.ai_service import (
    file_to_base64,   # 文件转 base64
    make_data_url,    # 构建 data URL
    get_mime_type,    # 获取 MIME 类型
)
```

---

## 返回结构

所有调用返回 `AIResponse` 对象（对服务商原始响应的统一封装）：

```python
@dataclass
class AIResponse:
    content: str          # ← choices[0].message.content
    model: str            # ← model
    provider: str         # ← 实际使用的服务商（4sapi / openrouter）
    input_tokens: int     # ← usage.prompt_tokens
    output_tokens: int    # ← usage.completion_tokens
    total_tokens: int     # ← 计算值
    cost: float           # ← usage.total_cost（如有）
    latency_ms: int       # ← 本地计算
    raw_response: dict    # ← 完整原始响应
    images: List[str]     # ← 图像生成结果
    annotations: dict     # ← PDF 解析注释
```

**使用示例**：
```python
response = await ai.chat(messages, prompt_name="test")

print(response.content)       # AI 回复
print(response.provider)      # 实际服务商（4sapi / openrouter）
print(response.total_tokens)  # 消耗 token
print(response.cost)          # 费用（美元）
print(response.latency_ms)    # 延迟（毫秒）

# 需要原始响应时
print(response.raw_response)  # 服务商完整返回
```

---

## 提示词规范

### 文件位置（强制）

```
{模块}/后端服务/prompts/{功能名}_prompts.py
```

### 文件结构（强制）

```python
"""功能描述"""

PROMPT_META = {
    "name": "policy_analysis",       # 唯一标识，用于统计
    "display_name": "政策解读",       # 后台显示名称
    "description": "解析政策文档",    # 功能描述
    "module": "your_module",         # 所属模块
    "variables": ["content"],        # 变量列表
}

SYSTEM_PROMPT = """你是专业分析师..."""

USER_PROMPT = """请分析：{content}"""
```

### 元数据自动注册（可视化）

`PROMPT_META` 会**自动注册到数据库**，实现后台可视化管理：

```python
# 模块启动时扫描并注册
from shared_backend.services.ai_service import scan_and_register_prompts

scan_and_register_prompts(
    module_path="/path/to/your_module",
    module_code="your_module"
)
```

**注册流程**：
```
prompts/*_prompts.py  →  PROMPT_META  →  ai_prompts 表  →  后台可视化
```

**后台功能**：
- 查看所有已注册的提示词
- 按模块筛选
- 查看变量定义
- 点击"同步"手动刷新

> 提示词**内容**由开发维护（Git 版本控制），后台**仅展示元数据**，不支持在线编辑

---

## 调用日志与统计

### ⚠️ 强制要求

**必须传入 `db_session`** 才能记录调用日志到 `ai_call_logs` 表：

```python
# ❌ 错误：无法记录日志，统计页面无数据
ai = AIService(module_code="my_module")

# ✅ 正确：日志会写入数据库
ai = AIService(module_code="my_module", db_session=db)
```

### 独立模块配置

如果模块运行在独立容器中，无法直接获取数据库会话，需配置环境变量：

```bash
# docker-compose.yml
environment:
  - DATABASE_URL=mysql+pymysql://user:pass@scrm-mysql:3306/scrm_content?charset=utf8mb4
```

然后在代码中自动创建会话：

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

def get_db_session():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        return None
    engine = create_engine(database_url, pool_pre_ping=True)
    Session = sessionmaker(bind=engine)
    return Session()

# 使用
db = get_db_session()
ai = AIService(module_code="my_module", db_session=db)
```

### 查看统计

**入口**：https://scrm.ireborn.com.cn → AI 配置 → 调用统计

**统计维度**：
- 按模块：各模块调用次数、Token 消耗、成本
- 按服务商：4sapi / OpenRouter 使用分布（观察降级频率）
- 按日期：调用趋势图

**自动记录字段**（`ai_call_logs` 表）：
| 字段 | 说明 |
|------|------|
| `module_code` | 模块标识 |
| `prompt_name` | 提示词名称 |
| `provider` | **实际使用的服务商**（4sapi / openrouter） |
| `model` | 使用的模型 |
| `input_tokens` / `output_tokens` | Token 消耗 |
| `cost` | 费用（美元） |
| `latency_ms` | 响应延迟 |
| `status` | 调用状态（success / error） |
| `error_message` | 错误信息（失败时） |
| `created_at` | 调用时间 |

**降级监控**：通过 `provider` 字段筛选，可观察降级发生频率，评估首选服务商稳定性

---

## AI 响应解析规范（2026-01-18 新增）

### 公共解析函数（强制使用）

各模块解析 AI JSON 响应时，**必须**使用公共函数，禁止自行编写解析逻辑：

```python
from shared_backend.services.ai_service import parse_ai_json_response, safe_parse_ai_json

# 方式1：会抛异常（需 try-catch）
try:
    result, thinking = parse_ai_json_response(ai_response.content)
except json.JSONDecodeError:
    # 处理解析失败
    pass

# 方式2：不抛异常（返回默认值）
result, thinking = safe_parse_ai_json(ai_response.content, default={"status": "error"})
```

### 处理能力

| 输入格式 | 示例 | 能否处理 |
|---------|------|---------|
| thinking 标签 | `<thinking>分析中...</thinking>{"key": "value"}` | ✅ |
| JSON 代码块 | ` ```json {"key": "value"} ``` ` | ✅ |
| 普通代码块 | ` ``` {"key": "value"} ``` ` | ✅ |
| 混合文本 | `分析结果如下：{"key": "value"}` | ✅ |
| 纯 JSON | `{"key": "value"}` | ✅ |

### 返回值

```python
result, thinking = parse_ai_json_response(content)
# result: dict - 解析后的 JSON 对象
# thinking: str - thinking 标签中的内容（可用于调试/展示）
```

---

## 检查清单

### 配置检查（门户系统）

- [ ] 配置 **4sapi.com 通用 Key**（用于 Gemini/DeepSeek 等）
- [ ] 配置 **Anthropic 专属 Key**（用于 Claude 模型）
- [ ] 配置 **OpenRouter API Key**（备选服务商）
- [ ] 配置**按用途的模型**（测试/分析/创意/生图/视频）
- [ ] 确认所有 Key 都有效（门户页面显示"已配置"）

### 代码检查（各模块）

- [ ] 使用 `shared_backend.AIService`，未直接调用 API
- [ ] 未硬编码 API Key
- [ ] 创建 `prompts/{功能}_prompts.py`
- [ ] 包含 `PROMPT_META`（name, display_name, module, variables）
- [ ] 调用时传入 `prompt_name`（用于统计）
- [ ] 初始化时传入 `db_session`（记录日志）

### 验证

```bash
# 检查门户配置 API 是否可访问
curl http://portal-backend:8000/api/ai/internal/config

# 检查 AI 调用日志是否记录
SELECT * FROM ai_call_logs ORDER BY created_at DESC LIMIT 10;
```

---

*瑞小美 AI 团队 · 2026-01-20*
