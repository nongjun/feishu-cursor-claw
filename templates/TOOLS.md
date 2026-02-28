# TOOLS.md - 工具备忘

_记录你的工具配置和使用备忘。Agent 会参考这个文件来正确使用工具。_

## Cursor Agent CLI

- 通过 `agent` 命令执行任务
- 支持 `--resume` 恢复会话
- 支持 `--workspace` 指定工作区
- 支持 `--model` 指定模型
- 使用 `stream-json` 输出格式获取实时进度

## 飞书集成

- WebSocket 长连接模式（无需公网地址）
- 互动卡片 + 消息更新
- 支持文字、图片、语音、文件

## 语音识别

- **主引擎:** 火山引擎豆包大模型 STT（流式 WebSocket）
- **备用:** 本地 whisper-cpp
- 飞书语音消息 → OGG → WAV → STT

## 浏览器能力

如果配置了 Playwright MCP，可以：
- 打开网页、填写表单、点击按钮
- 抓取网页内容和数据
- 截图保存

_在下面添加你自己的工具备忘（SSH 地址、设备名、API 端点等）。_
