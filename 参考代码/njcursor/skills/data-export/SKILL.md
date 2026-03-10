---
name: data-export
description: 异步数据导出服务，支持 Excel/CSV/JSON 格式导出、进度追踪、任务管理。当需要大数据量报表导出或后台异步任务处理时使用。
---

# 数据导出

## 核心能力

| 功能 | 说明 |
|------|------|
| 异步导出 | 后台线程处理，不阻塞请求 |
| 多格式 | Excel (.xlsx) / CSV / JSON |
| 多维度 | 按员工 / 客户 / 群导出 |
| 进度追踪 | progress 字段实时更新 |
| 任务管理 | 列表、取消、删除 |
| Excel 美化 | 表头样式、自适应列宽、边框 |

## 关键函数

| 函数 | 用途 |
|------|------|
| run_export_in_background() | 启动后台导出线程 |
| process_export_task() | 处理导出任务主逻辑 |
| _export_to_excel() | 导出 Excel |
| _export_to_csv() | 导出 CSV |
| _export_to_json() | 导出 JSON |
| get_export_list() | 获取任务列表（分页） |
| cancel_export_task() | 取消进行中的任务 |
| delete_export_task() | 删除任务及文件 |

## SOP：新增导出类型

1. 在 export_service.py 中新增导出处理逻辑
2. 创建 ExportTask 记录（task_id, export_type, format, status=pending）
3. 调用 run_export_in_background(task_id) 启动后台处理
4. 前端轮询任务状态或用 WebSocket 推送完成通知
5. 完成后通过 /download/{task_id} 下载文件

## 重点关注

- 依赖 openpyxl 库处理 Excel
- 大数据量导出需分批查询，避免内存溢出
- 导出文件存放在容器内，需挂载卷持久化

## 参考文件

- 会话存档/后端服务/app/services/export_service.py
