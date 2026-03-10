---
name: wecom-integration
description: 企业微信统一对接，包含 Token 共享管理、JSSDK 签名、OAuth 登录（含跨域名中转）、JWT 认证、一次性授权码。当开发企微应用、侧边栏或需要企微认证时使用。
---

# 企微对接

## 架构概览

- 后端：各模块 → shared_backend.WeComAuthService → 门户 Redis 缓存（首选）→ 企微 API（回退）
- 前端：@wecom/jssdk npm 包 → ww.register() 一次初始化

## 核心服务

### WeComAuthService（公共模块）

| 方法 | 用途 |
|------|------|
| `get_access_token()` | 获取 Token（优先门户缓存，回退直调企微） |
| `generate_signature()` | JSSDK 签名（wx.config） |
| `generate_agent_config_signature()` | agentConfig 签名 |
| `get_user_info_by_code()` | OAuth 授权码换用户信息 |
| `upload_media()` | 上传临时素材（支持图片自动压缩） |
| `get_external_contact_detail()` | 获取外部联系人详情 |
| `send_welcome_msg()` | 发送新客户欢迎语 |

### Token 获取策略

门户 Redis 共享缓存（多模块复用，避免限频）→ 失败回退 → 直调企微 API（本地内存缓存）。配置 `PORTAL_API_URL` 即可启用共享缓存。

## SOP：JSSDK 初始化

### 前端（强制使用 @wecom/jssdk npm 包）

1. `npm install @wecom/jssdk`
2. `import * as ww from '@wecom/jssdk'`
3. 调用 `ww.register()` 传入 corpId、agentId（**数字类型**）、签名获取函数
4. 注册后直接调用 API，SDK 自动等待 config 完成

**禁止使用旧版 CDN 脚本**（jweixin/jwxwork）。

### 后端需提供的接口

- `POST /api/wecom/jsapi-signature` → `{ timestamp, nonceStr, signature }`
- `POST /api/wecom/agent-config-signature` → `{ timestamp, nonceStr, signature }`

## SOP：OAuth 登录

### 标准流程

前端请求 OAuth URL → 跳转企微授权 → 回调带 code → 后端换 userid → 生成 JWT

### 跨域名中转方案（侧边栏等）

侧边栏检测无 userid → 跳转门户 /api/auth/wecom/authorize → 门户重定向企微授权（回调地址固定为门户 callback） → callback 换 userid → 重定向回原始 URL 附带 userid

### 一次性授权码（goto_code）

门户跳转子系统时使用，避免 Token 泄露到浏览器历史：
- `POST /api/auth/create-goto-code` → 创建（60 秒过期）
- `POST /api/auth/exchange-code` → 兑换 JWT Token

## 常见坑

| 问题 | 解决 |
|------|------|
| `invalid signature` | URL 必须 `decodeURIComponent` 后再签名 |
| `invalid agentid` | agentId 必须是**数字类型** |
| `code已使用` | code 只能用一次，用后清除 URL 参数 |

## 环境变量

- WECOM_CORP_ID / WECOM_SECRET / WECOM_AGENT_ID
- JWT_SECRET_KEY / JWT_ALGORITHM / JWT_EXPIRE_HOURS
- PORTAL_API_URL（启用 Token 共享）

## 参考文件

- `公共模块/shared_backend/services/wecom_auth.py`
- `公共模块/shared_backend/services/auth_service.py`
- `门户系统/后端服务/app/services/wecom_auth.py`
- `门户系统/后端服务/app/api/auth.py`
