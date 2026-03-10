---
name: chat-viewer
description: 企微聊天记录查看方案，后端统一处理消息同步/解密/媒体下载/语音转文字，前端按业务场景分散在各模块。当需要展示聊天记录、实现会话历史查看或消息渲染时使用。
---

# 聊天记录查看器

## 架构

- **后端统一**：会话存档模块的 ChatService 处理消息同步、解密、媒体下载
- **前端分散**：各业务模块按需实现查看组件

## 后端核心服务（ChatService）

| 方法 | 用途 |
|------|------|
| sync_messages_from_wecom() | 从企微批量同步+解密+入库 |
| get_customer_messages() | 获取指定客户/群聊的聊天记录 |
| _download_media_if_needed() | 自动下载媒体文件 |
| _recognize_voice_message() | 语音转文字（腾讯云 ASR） |

## 支持的消息类型

| msgtype | 渲染方式 |
|---------|---------|
| text | 文字气泡 |
| image | 缩略图 + 点击放大 |
| voice | 播放按钮 + 转文字 |
| video | video 播放器 |
| file | 文件图标 + 下载链接 |
| emotion | 表情图片 |
| link | 链接卡片 |
| weapp | 小程序链接 |

## 前端组件位置

| 模块 | 组件 | 用途 |
|------|------|------|
| 撩回搭子 | ChatPreview.vue | 客户聊天预览 |
| 联系人侧边栏 | ChatDetailDrawer.vue | 完整聊天详情 |
| 联系人侧边栏 | ChatSummaryByUserCard.vue | 聊天摘要卡片 |

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| /api/archive/messages | GET | 获取聊天记录（分页） |
| /api/media/{msgid} | GET | 获取媒体文件 |

## 重点关注

- 语音转码依赖 FFmpeg（AMR → MP3），Docker 中需安装
- 语音识别使用腾讯云 ASR，需配置 SecretId/SecretKey
- 消息同步后会触发下游事件（撩回搭子通知、AI标签等）
- 单聊查询需同时查 from_userid 和 external_userid 双向

## 参考文件

- 会话存档/后端服务/app/services/chat_service.py
- 联系人/前端-侧边栏/src/components/ChatDetailDrawer.vue
