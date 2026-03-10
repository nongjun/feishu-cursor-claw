---
name: fastapi-common
description: FastAPI 项目通用基础设施（shared_backend），包含 CORS、全局异常处理、请求日志、统一响应格式。当新建 FastAPI 后端模块或需要统一中间件时使用。
---

# FastAPI 公共基础设施

## 模块一览

| 模块 | 导入路径 | 功能 |
|------|---------|------|
| CORS | shared_backend.middleware.cors | 跨域配置（开发/生产自动切换） |
| 异常处理 | shared_backend.middleware.exception_handler | 统一错误格式 |
| 请求日志 | shared_backend.middleware.request_logging | 耗时记录、慢请求告警 |
| 响应格式 | shared_backend.middleware.response | 标准化 API 返回 |

## 统一响应格式

- 成功：{ code: 0, message: "success", data: ... }
- 错误：{ code: 错误码, message: "描述", data: null }
- 分页：{ code: 0, data: { list: [...], total, page, page_size } }

所有异常统一返回 HTTP 200，通过 code 字段区分错误类型。

## 关键函数

| 函数 | 用途 |
|------|------|
| setup_cors(app, app_env) | 配置 CORS（开发允许所有，生产限域名） |
| setup_exception_handlers(app) | 注册全局异常处理 |
| RequestLoggingMiddleware | 请求日志中间件（慢请求阈值 3s） |
| success_response() | 包装成功响应 |
| error_response() | 包装错误响应 |
| paginated_response() | 包装分页响应 |
| paginate_query() | SQLAlchemy 查询分页 |
| APIException | 自定义业务异常 |
| NotFoundException | 404 异常 |

## SOP：新建后端模块

1. 创建 FastAPI 应用
2. 调用 setup_cors()、setup_exception_handlers()
3. 添加 RequestLoggingMiddleware
4. 路由中使用 success_response() / paginated_response() 返回数据
5. 业务异常抛出 APIException

## 参考文件

- 公共模块/shared_backend/middleware/cors.py
- 公共模块/shared_backend/middleware/exception_handler.py
- 公共模块/shared_backend/middleware/request_logging.py
- 公共模块/shared_backend/middleware/response.py
