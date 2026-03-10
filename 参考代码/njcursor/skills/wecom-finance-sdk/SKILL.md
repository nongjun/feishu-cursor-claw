---
name: wecom-finance-sdk
description: 企业微信会话存档 SDK Python 封装（ctypes 调用 C++ SDK），支持增量拉取聊天记录、解密消息、分块下载媒体文件。当需要获取企微聊天记录或下载媒体文件时使用。
---

# WeCom Finance SDK

## 核心特性

- **ctypes 调用 C++ SDK**：`libWeWorkFinanceSdk_C.so`
- **线程安全单例**：`get_finance_sdk()` 获取全局实例
- **崩溃自恢复**：`reset_finance_sdk()` 重置损坏的 SDK 实例
- **分块下载**：媒体文件循环调用直到 `is_finish == 1`

## 关键方法（WeComFinanceSDK）

| 方法 | 用途 |
|------|------|
| `get_chat_data(seq, limit)` | 增量拉取加密聊天记录 |
| `decrypt_data(aes_key, encrypt_chat_msg)` | AES 解密消息内容 |
| `get_media_data(sdkfileid)` | 分块下载媒体文件 |

## 消息拉取流程

1. 调用 get_chat_data(seq=0) 获取加密消息
2. RSA 私钥解密 encrypt_random_key 得到 AES 密钥
3. 调用 decrypt_data() 解密消息内容
4. 保存 seq，下次从新 seq 继续增量拉取

## 重点关注

- **仅支持 Linux x86_64**，需手动下载 `libWeWorkFinanceSdk_C.so`
- 服务器 IP 必须加入企微白名单
- 消息**仅保留 5 天**，必须及时拉取
- SDK 偶发段错误，已通过 `reset_finance_sdk()` 处理
- 媒体文件下载必须循环调用直到完成

## 配合服务

`ChatService`（会话存档模块）封装了完整的同步流程：
- `sync_messages_from_wecom()` — 批量同步+解密+入库
- `_download_media_if_needed()` — 媒体文件自动下载
- `_recognize_voice_message()` — 语音转文字（腾讯云 ASR）

## 参考文件

- `会话存档/后端服务/app/sdk/wecom_finance_sdk.py`
- `会话存档/后端服务/app/services/chat_service.py`
