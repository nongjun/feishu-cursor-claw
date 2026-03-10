---
name: employee-selector
description: 员工选择器组件，支持部门树形展示、部门级联全选、多选/单选、搜索过滤。当需要任务分配选择员工、可见范围设置、数据权限配置或群发消息选择接收人时使用。
---

# 员工选择器

## 组件分层

| 层级 | 位置 | 特点 |
|------|------|------|
| 基础组件 | shared_frontend/components/EmployeeSelector.vue | 通用、API 解耦 |
| 业务组件 | 各模块自有版本（如撩回搭子 EmployeeSelectorDialog.vue） | 定制化 |

## 基础组件 Props

| 属性 | 类型 | 说明 |
|------|------|------|
| modelValue | Boolean | 控制弹窗显示（v-model） |
| selected | Array | 已选中项回显 |
| userOnly | Boolean | 确认结果只包含员工 |
| fetchApi | Function | 获取部门员工数据的函数（API 解耦） |

## 关键设计决策

- **不使用 check-strictly**：级联模式，勾选部门自动选中所有子员工
- **部门复选框可点击**：用于批量选中，非禁用
- **getCheckedNodes(true)**：仅获取叶子节点，再按 type=user 过滤
- **countEmployees 递归统计**：部门显示 (N人)
- **nodeKey 格式**：dept_{id} / user_{id}，避免部门和员工 ID 冲突

## 数据格式

- API 返回：树形结构，节点含 type(department/user)、id、name、children
- 确认结果：[{ type: 'user', id, name }]

## 后端 API

通过公共路由工厂注册：

- 路径：/api/{module}/common/departments/with-employees
- 实现：shared_backend.api.create_common_router()

## SOP：使用员工选择器

1. 前端引入 shared_frontend 的 EmployeeSelector 组件
2. 传入 fetchApi 函数（指向本模块的公共路由）
3. 监听 confirm 事件获取选中员工列表
4. 如需定制（如禁用级联），在业务模块创建独立版本

## 参考文件

- 公共模块/shared_frontend/components/EmployeeSelector.vue
- 公共模块/shared_backend/api/common.py（create_common_router）
