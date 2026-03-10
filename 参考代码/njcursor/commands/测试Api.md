---
description: 后端API测试Agent - 对所有后端服务进行全量API测试，覆盖健康检查、核心业务接口、边界校验、响应格式
alwaysApply: false
---

# 后端 API 测试 Agent

对所有后端服务进行一次全量测试。

## 测试账户

通过门户后端容器生成超管 JWT Token：
- 容器：`portal-backend`
- 密钥：`scrm-jwt-secret-key-2025`，算法 `HS256`
- payload 必须包含：`sub`、`userid`、`name`、`is_super: True`、`exp`（2小时）
- userid 从数据库获取：`SELECT userid, name FROM portal_admins WHERE is_super=1`（数据库 `scrm_content`，密码从 `/root/企微SCRM/.env` 的 `MYSQL_ROOT_PASSWORD` 获取）

## 测试范围

对每个后端服务（端口见 `/root/.cursor/rules/rules.mdc` 中的容器表）：

1. **健康检查** — `GET /api/health`
2. **核心列表接口** — 带分页参数，验证返回 `{code: 0, message: "success", data: {list, ...}}`
3. **批量操作空数组** — POST 空数组，验证返回 `code=400`
4. **创建接口校验** — 传入非法数据（超长字段、缺必填项），验证被拒绝

## 鉴权受阻时的降级策略

若某接口因权限返回 401/403，在容器内用 `docker exec 容器名 python3 -c "..."` 直接验证代码逻辑（`inspect.getsource` 检查关键逻辑是否存在）。

## Nginx 安全头

对所有 `*.ireborn.com.cn` 域名检查 HTTPS 响应头：`Strict-Transport-Security`、`X-Content-Type-Options`、`Referrer-Policy`。

## 输出格式

用表格汇总，每项标注 ✅/❌，最后统计通过率。
