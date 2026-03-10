#!/bin/bash
# TuriX-CUA 一键启动脚本
# 用法：
#   ./turix.sh "打开 Chrome 搜索瑞小美轻医美"
#   ./turix.sh --resume my-task-001
#   ./turix.sh --stop

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/config.json"
CONDA_PATH="/opt/homebrew/bin/conda"
ENV_NAME="turix_env"

export PATH="/usr/sbin:/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[TuriX]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[TuriX]${NC} $1"; }
log_error() { echo -e "${RED}[TuriX]${NC} $1"; }

show_help() {
    cat << EOF
TuriX-CUA 桌面操控代理

用法：
    ./turix.sh "任务描述"              执行桌面操作任务
    ./turix.sh --resume ID            恢复中断的任务
    ./turix.sh --stop                 停止正在运行的 TuriX
    ./turix.sh --status               查看运行状态
    ./turix.sh --no-plan "任务"        不启用规划器
    ./turix.sh --help                 显示帮助

示例：
    ./turix.sh "打开 Safari 搜索瑞小美官网"
    ./turix.sh "打开备忘录，写一段今天的工作总结"
    ./turix.sh "打开系统设置，切换到深色模式"

紧急停止：Cmd+Shift+2
EOF
}

RESUME_ID=""
USE_PLAN=true
USE_SKILLS=true

case "${1:-}" in
    --help|-h)
        show_help
        exit 0
        ;;
    --stop)
        log_info "正在停止 TuriX..."
        pkill -f "python.*main.py.*config" 2>/dev/null && log_info "已停止" || log_warn "没有运行中的 TuriX"
        exit 0
        ;;
    --status)
        if pgrep -f "python.*main.py" > /dev/null 2>&1; then
            log_info "TuriX 正在运行："
            ps aux | grep "python.*main.py" | grep -v grep
        else
            log_info "TuriX 没有在运行"
        fi
        exit 0
        ;;
    --resume)
        RESUME_ID="$2"
        shift 2
        ;;
    --no-plan)
        USE_PLAN=false
        USE_SKILLS=false
        shift
        ;;
esac

if [[ -z "$RESUME_ID" && $# -eq 0 ]]; then
    log_error "请提供任务描述或使用 --resume"
    show_help
    exit 1
fi

TASK_TEXT="$*"

update_config() {
    TASK_ARG="$TASK_TEXT" USE_PLAN="$USE_PLAN" USE_SKILLS="$USE_SKILLS" RESUME_ID="$RESUME_ID" CONFIG_FILE="$CONFIG_FILE" \
        python3 << 'PYEOF'
import json, os

config_path = os.environ["CONFIG_FILE"]
with open(config_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

task_arg = os.environ.get("TASK_ARG", "")
if task_arg:
    data['agent']['task'] = task_arg

resume_id = os.environ.get("RESUME_ID", "")
if resume_id:
    data['agent']['resume'] = True
    data['agent']['agent_id'] = resume_id
else:
    data['agent']['resume'] = False

data['agent']['use_plan'] = (os.environ.get("USE_PLAN", "True") == "True")
data['agent']['use_skills'] = (os.environ.get("USE_SKILLS", "True") == "True")

with open(config_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print('配置已更新')
PYEOF
}

preflight_checks() {
    if ! "$CONDA_PATH" env list 2>/dev/null | grep -q "$ENV_NAME"; then
        log_error "Conda 环境 '$ENV_NAME' 不存在，请先运行 setup.sh"
        exit 1
    fi

    if ! python3 -c "
import ctypes
CoreGraphics = ctypes.cdll.LoadLibrary('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics')
exit(0 if CoreGraphics.CGPreflightScreenCaptureAccess() else 1)
" 2>/dev/null; then
        log_warn "屏幕录制权限可能缺失"
        log_warn "请在 系统设置 → 隐私与安全性 → 屏幕录制 中授权"
    fi
}

main() {
    cd "$SCRIPT_DIR"

    log_info "任务：${TASK_TEXT:-（恢复任务 $RESUME_ID）}"
    update_config
    preflight_checks

    log_info "启动中... 紧急停止按 Cmd+Shift+2"
    "$CONDA_PATH" run -n "$ENV_NAME" python examples/main.py -c "$CONFIG_FILE"
}

main
