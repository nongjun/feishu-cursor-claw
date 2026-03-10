---
name: websocket-realtime
description: 基于 FastAPI 的 WebSocket 实时通信方案，各模块独立实现 ConnectionManager，支持广播、定向推送、心跳重连、JWT 认证。当需要实时消息推送或多用户协作时使用。
---

# WebSocket 实时通信

## 当前实现（各模块独立）

| 模块 | 管理器 | 特点 |
|------|--------|------|
| 会话存档 | ConnectionManager | 按用户索引、广播新消息/风控告警 |
| 企微托管 | ClientManager | 服务端主动心跳、优雅断连、流式事件推送 |

## 会话存档 WebSocket

端点：/ws/messages，认证：JWT Token（Query 参数），心跳：ping/pong（60 秒超时）

| 方法 | 用途 |
|------|------|
| connect(ws, metadata) | 建立连接并注册 |
| disconnect(ws) | 断开并清理 |
| send_to_user(userid, data) | 定向推送 |
| broadcast(data) | 全局广播 |
| broadcast_new_messages() | 新消息通知 |
| broadcast_risk_alert() | 风控告警 |

## 企微托管 WebSocket

端点：/ws/v1/hosting/client（客户端）、/ws/v1/hosting/monitor（监控端），心跳：服务端主动发送（15 秒间隔，90 秒超时）

| 方法 | 用途 |
|------|------|
| connect() | 建立连接（含数据库状态同步） |
| disconnect() | 优雅断连（先通知后关闭） |
| send_stream_event() | 流式事件推送 |

## SOP：新增 WebSocket 功能

1. 参考会话存档的 ConnectionManager 模式
2. 创建 WebSocket 路由，验证 JWT Token
3. 实现 connect/disconnect/broadcast 等方法
4. 前端使用 WebSocket 类封装，实现自动重连和心跳

## 重点关注

- 当前未统一到公共模块，各模块独立实现
- JWT 认证通过 Query 参数传递（WebSocket 不支持 Header）
- 前端需实现指数退避重连策略
- 心跳超时后服务端主动断开

## 参考文件

- 会话存档/后端服务/app/websocket/__init__.py
- 会话存档/后端服务/app/api/ws.py
- 企微托管/后端服务/app/services/client_manager.py
