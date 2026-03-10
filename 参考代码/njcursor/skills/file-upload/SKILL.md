---
name: file-upload
description: 通用文件上传服务（shared_backend），支持文件保存、缩略图生成、类型检测、安全验证。当需要实现文件上传功能时使用。
---

# 文件上传服务

## 关键方法（FileService）

| 方法 | 用途 |
|------|------|
| save_file(file, subdir, max_size) | 保存上传文件（自动重命名） |
| generate_thumbnail(file_path, max_size) | 生成缩略图（需 PIL） |
| delete_file(file_path) | 安全删除文件 |
| get_file_type(filename) | 根据 MIME 和扩展名判断类型 |

## 安全验证工具（upload_utils）

| 函数 | 用途 |
|------|------|
| validate_file_type(file) | Magic Number 验证（防伪造扩展名） |
| sanitize_filename(filename) | 文件名清理（防路径遍历） |

## 支持的文件类型

| 类型 | 扩展名 |
|------|--------|
| 图片 | jpg, jpeg, png, gif, bmp, webp |
| 视频 | mp4, avi, mov, wmv, flv, mkv |
| 文档 | pdf, doc, docx, xls, xlsx, ppt |

## SOP：集成文件上传

1. 后端通过公共路由自动注册：create_common_router(upload_dir="/app/uploads")
2. 上传端点：POST /api/{module}/common/upload
3. 如需定制，直接实例化 FileService(upload_dir=...)
4. 缩略图生成依赖 Pillow（可选安装）

## 重点关注

- 文件名自动生成：时间戳 + UUID，避免冲突
- 上传目录需在 Docker 中挂载卷持久化
- 部分模块（如内容中心）有独立 FileService 实现

## 参考文件

- 公共模块/shared_backend/services/file_service.py
- 公共模块/shared_backend/utils/upload_utils.py
- 公共模块/shared_backend/api/common.py（/upload 路由）
