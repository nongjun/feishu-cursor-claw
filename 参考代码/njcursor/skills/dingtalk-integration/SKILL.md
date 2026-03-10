---
name: dingtalk-integration
description: 钉钉群机器人 Webhook 消息推送，用于定时日报播报和异常告警。当需要发送钉钉群通知、日报统计、任务告警时使用。
---

# 钉钉 Webhook 集成

## 当前能力范围

仅 **Webhook 群机器人**，不涉及 OAuth/JSAPI/免登录。

| 能力 | 说明 |
|------|------|
| 日报播报 | 每日定时发送业务统计（多巴胺配色 Markdown） |
| 异常告警 | 任务卡住、提交失败等实时告警 |
| 消息格式 | text / markdown |

## SOP：新增钉钉通知

1. 在钉钉群创建自定义机器人，获取 Webhook URL
2. 在模块 config.py 中添加 Webhook 环境变量
3. 参考 DingtalkService 实现消息发送
4. 调用 send_webhook_message() 发送消息

## 关键方法（DingtalkService）

| 方法 | 用途 |
|------|------|
| send_webhook_message() | 发送群机器人消息（text/markdown） |
| send_daily_report() | 完整日报播报流程 |
| send_submit_failure_alert() | 任务提交失败告警 |
| send_stuck_task_alert() | 任务卡住告警 |
| get_daily_statistics() | 获取当日统计数据 |

## 重点关注

- Webhook URL 放环境变量，禁止硬编码
- 告警与日报用独立 Webhook（可配置）
- Markdown 消息有字数限制（约 20000 字节）
- 机器人安全设置建议用「自定义关键词」模式

## 环境变量

- DINGTALK_MOMENT_DAILY_WEBHOOK — 日报 Webhook
- DINGTALK_ALERT_WEBHOOK — 告警 Webhook（可选，默认复用日报）
- DINGTALK_MOMENT_DAILY_ENABLED — 是否启用日报
- DINGTALK_PADDING_WEBHOOK — 智能铺垫提醒 Webhook

## 参考文件

- 朋友圈/后端服务/app/services/dingtalk_service.py
- 联系人/后端服务/app/services/padding_reminder_service.py
