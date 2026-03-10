# TuriX-CUA — 桌面操控代理插件

> AI 的「眼睛和手」——用自然语言操控 macOS 桌面

## 这是什么

TuriX 是一个 AI 桌面操控代理。你用中文告诉它要做什么，它会自动截屏理解画面、操控鼠标键盘完成操作。

## 工作原理

```
用户说："打开 Chrome 搜索瑞小美"
         ↓
截屏 → AI 看图理解 → 生成操作指令 → 执行鼠标/键盘 → 再截屏验证 → 循环
```

### 四个 AI 角色

| 角色 | 职责 |
|------|------|
| Planner | 把大任务拆成小步骤 |
| Brain | 看截图，决定下一步目标 |
| Actor | 把目标转成具体鼠标键盘操作 |
| Memory | 记住已做的事，避免重复 |

## 快速使用

```bash
# 执行任务
./turix.sh "打开 Safari 搜索瑞小美官网"

# 恢复中断的任务
./turix.sh --resume my-task-001

# 查看运行状态
./turix.sh --status

# 停止运行
./turix.sh --stop
```

**紧急停止：** `Cmd+Shift+2`

## 前置条件

- Conda 环境 `turix_env`（Python 3.12）
- macOS 辅助功能 + 屏幕录制权限（终端和 Cursor）
- API Key 已配置在 `config.json`

## 支持的操作

鼠标点击、右键点击、拖拽、鼠标移动、键盘输入、快捷键组合、滚动、打开应用、AppleScript、搜索网页、记录信息到文件

## 目录结构

```
plugins/turix-cua/
├── turix.sh          ← 一键启动脚本
├── config.json       ← AI 模型配置
├── examples/main.py  ← Python 入口
├── src/              ← 核心代码
├── skills/           ← AI 技能手册
├── requirements.txt  ← Python 依赖
└── LICENSE           ← MIT 开源协议
```

## 来源

基于 [TuriX-CUA](https://github.com/TurixAI/TuriX-CUA) 开源项目，MIT 协议。
