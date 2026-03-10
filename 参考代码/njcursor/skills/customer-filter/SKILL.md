---
name: customer-filter
description: 通用客户筛选组件，前后端一体化方案，支持沉默天数、标签、互动时间/次数、手动勾选、上传名单等多条件筛选。当需要 CRM 客户筛选、批量营销圈选、数据分析分群时使用。
---

# 客户筛选器

## 组件分层

| 层级 | 位置 | 特点 |
|------|------|------|
| 基础组件 | shared_frontend/components/CustomerFilterBase.vue | 通用条件框架 |
| 完整组件 | 撩回搭子/前端服务/components/customer-filter/CustomerFilter.vue | 含员工选择、模板、手动勾选 |

## 支持的筛选条件

| 条件 | 基础组件 | 完整组件 |
|------|---------|---------|
| 沉默天数 | Y | Y |
| 客户标签（插槽） | Y | Y |
| 最后互动时间 | Y | Y |
| 客户来源（插槽） | Y | Y |
| 归属员工 | - | Y（必选项） |
| 互动次数 | - | Y |
| 所属企业（B2B） | - | Y |
| 跟进状态 | - | Y |
| 手动勾选客户 | - | Y（V5.2） |
| 上传名单 | - | Y（V5.2） |

## 完整组件暴露方法

| 方法 | 用途 |
|------|------|
| getFilterData() | 获取当前筛选条件 |
| getPreviewCount() | 获取预览数量 |
| validate() | 验证筛选条件 |
| getSelectedCustomers() | 获取已选客户列表 |

## 后端服务（CustomerFilterService）

位于 shared_backend/services/customer_filter_service.py

| 方法 | 用途 |
|------|------|
| build_query() | 构建 SQL 查询 |
| preview() | 预览筛选结果（数量+样本） |
| list_customers() | 分页获取客户列表 |
| get_customer_ids() | 获取 ID 列表 |
| get_count() | 仅获取数量 |

## API 路径

- POST /liaohui/customer-filter/preview
- POST /liaohui/customer-filter/list
- GET /liaohui/customer-filter/templates
- POST /liaohui/customer-filter/match-by-phone
- GET /liaohui/customer-filter/search

## SOP：集成客户筛选

1. 简单场景：直接用 CustomerFilterBase + 插槽
2. 完整场景：引入撩回搭子的 CustomerFilter 组件
3. 后端：实例化 CustomerFilterService(db, current_user)，调用对应方法
4. 新增筛选条件：前端加条件 UI，后端在 build_query() 中扩展

## 参考文件

- 公共模块/shared_frontend/components/CustomerFilterBase.vue
- 公共模块/shared_backend/services/customer_filter_service.py
- 撩回搭子/前端服务/src/components/customer-filter/
