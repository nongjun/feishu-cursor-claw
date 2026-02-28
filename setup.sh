#!/bin/bash
# 飞书 → Cursor Agent 中继服务 一键安装脚本
# 用法: bash setup.sh
set -e

echo "╔══════════════════════════════════════════════╗"
echo "║  飞书 → Cursor Agent 中继服务 安装向导       ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── 检测系统 ──────────────────────────────────────
if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "❌ 仅支持 macOS"
    exit 1
fi

ARCH=$(uname -m)
if [[ "$ARCH" != "arm64" ]]; then
    echo "⚠️  建议使用 Apple Silicon Mac (当前: $ARCH)"
fi

# ── 检测 Xcode CLT ──────────────────────────────
if ! xcode-select -p &>/dev/null; then
    echo "📋 安装 Xcode Command Line Tools..."
    xcode-select --install
    echo "   安装完成后请重新运行此脚本"
    exit 1
fi

# ── 检测 / 安装依赖 ──────────────────────────────
check_cmd() {
    if command -v "$1" &>/dev/null; then
        echo "  ✅ $1"
        return 0
    else
        echo "  ❌ $1 未安装"
        return 1
    fi
}

echo "🔍 检查依赖..."

NEED_BREW=()
check_cmd brew || { echo "请先安装 Homebrew: https://brew.sh"; exit 1; }
check_cmd bun || { echo "请先安装 Bun: curl -fsSL https://bun.sh/install | bash"; exit 1; }
check_cmd ffmpeg || NEED_BREW+=(ffmpeg)
check_cmd whisper-cli || NEED_BREW+=(whisper-cpp)
check_cmd expect || NEED_BREW+=(expect)

if [[ ${#NEED_BREW[@]} -gt 0 ]]; then
    echo ""
    echo "📦 安装缺少的依赖: ${NEED_BREW[*]}"
    brew install "${NEED_BREW[@]}"
fi

# ── 检测 Cursor Agent CLI ────────────────────────
echo ""
if [[ -f "$HOME/.local/bin/agent" ]]; then
    echo "  ✅ Cursor Agent CLI"
else
    echo "  ❌ Cursor Agent CLI 未找到"
    echo "     请安装 Cursor IDE 并在命令面板中执行 'Install CLI'"
    exit 1
fi

# ── 下载 Whisper 模型 ────────────────────────────
WHISPER_MODEL="$HOME/.cache/whisper-cpp/ggml-tiny.bin"
echo ""
if [[ -f "$WHISPER_MODEL" ]] && [[ $(stat -f%z "$WHISPER_MODEL") -gt 50000000 ]]; then
    echo "  ✅ Whisper 模型已存在 ($(du -h "$WHISPER_MODEL" | cut -f1))"
else
    echo "📥 下载 Whisper 语音识别模型 (~75MB)..."
    mkdir -p "$HOME/.cache/whisper-cpp"

    # 优先国内镜像
    if curl -L --connect-timeout 10 --max-time 600 \
        -H "User-Agent: Mozilla/5.0" \
        -o "$WHISPER_MODEL" \
        "https://hf-mirror.com/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin" 2>/dev/null; then
        echo "  ✅ 模型下载完成 (hf-mirror)"
    elif curl -L --connect-timeout 10 --max-time 600 \
        -o "$WHISPER_MODEL" \
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin" 2>/dev/null; then
        echo "  ✅ 模型下载完成 (huggingface)"
    else
        echo "  ⚠️  模型下载失败，语音识别功能将不可用"
        echo "     请手动下载: https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin"
        echo "     放到: $WHISPER_MODEL"
    fi
fi

# ── 接受 Xcode License ──────────────────────────
echo ""
if ! xcodebuild -version &>/dev/null; then
    echo "📋 需要接受 Xcode License（需要 sudo）:"
    sudo xcodebuild -license accept 2>/dev/null || true
fi

# ── 项目配置 ─────────────────────────────────────
WORK_DIR="$HOME/Documents/Ai管理的文件夹"
BOT_DIR="$WORK_DIR/relay-bot"
INBOX_DIR="$WORK_DIR/inbox"

mkdir -p "$INBOX_DIR"

# ── 检查项目文件 ─────────────────────────────────
if [[ ! -f "$BOT_DIR/package.json" ]]; then
    echo ""
    echo "❌ 项目文件不存在: $BOT_DIR/package.json"
    echo "   请先将项目文件复制到 $BOT_DIR"
    echo "   需要的文件: server.ts, agent-run.exp, package.json, feishu/"
    exit 1
fi

# ── 安装 Node 依赖 ───────────────────────────────
echo ""
echo "📦 安装 Node 依赖..."
cd "$BOT_DIR"
bun install

# ── 配置 .env ────────────────────────────────────
ENV_FILE="$BOT_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
    echo ""
    echo "🔑 配置环境变量"
    echo ""

    read -rp "Cursor API Key: " CURSOR_KEY
    read -rp "飞书 App ID: " FEISHU_ID
    read -rsp "飞书 App Secret: " FEISHU_SECRET
    echo ""
    read -rp "首选模型 [opus-4.6-thinking]: " MODEL
    MODEL=${MODEL:-opus-4.6-thinking}

    # 使用 printf 避免变量中的特殊字符被 shell 展开
    {
        printf '# Cursor Agent CLI\n'
        printf 'CURSOR_API_KEY=%s\n' "$CURSOR_KEY"
        printf '\n# 飞书 Bot\n'
        printf 'FEISHU_APP_ID=%s\n' "$FEISHU_ID"
        printf 'FEISHU_APP_SECRET=%s\n' "$FEISHU_SECRET"
        printf '\n# 模型\n'
        printf 'CURSOR_MODEL=%s\n' "$MODEL"
    } > "$ENV_FILE"
    echo "  ✅ .env 已创建"
else
    echo "  ✅ .env 已存在，跳过配置"
fi

# ── 项目路由配置 ──────────────────────────────────
PROJECTS_FILE="$WORK_DIR/projects.json"
if [[ ! -f "$PROJECTS_FILE" ]]; then
    cat > "$PROJECTS_FILE" <<'EOF'
{
  "projects": {
    "ai": {
      "path": "PLACEHOLDER",
      "description": "默认工作空间"
    }
  },
  "default_project": "ai",
  "note": "飞书消息中用 '项目名: 指令' 格式路由到对应工作目录"
}
EOF
    # 用 sed 替换占位符（安全处理路径中的特殊字符）
    sed -i '' "s|PLACEHOLDER|$WORK_DIR|" "$PROJECTS_FILE"
    echo "  ✅ projects.json 已创建"
else
    echo "  ✅ projects.json 已存在"
fi

# ── 初始化工作区（身份 + 记忆模板）──────────────
echo ""
echo "🧠 初始化工作区身份与记忆体系..."

# 从 projects.json 读取默认工作区路径
if command -v bun &>/dev/null && [[ -f "$PROJECTS_FILE" ]]; then
    DEFAULT_WS=$(bun -e "
        const p = JSON.parse(require('fs').readFileSync('$PROJECTS_FILE','utf8'));
        const def = p.default_project || Object.keys(p.projects)[0];
        console.log(p.projects[def]?.path || '');
    " 2>/dev/null)
fi
DEFAULT_WS="${DEFAULT_WS:-$WORK_DIR}"

TEMPLATE_DIR="$BOT_DIR/templates"
TEMPLATE_FILES=(SOUL.md IDENTITY.md AGENTS.md USER.md TOOLS.md MEMORY.md)
TEMPLATE_RULES=(.cursor/rules/agent-identity.mdc .cursor/rules/memory-protocol.mdc)

mkdir -p "$DEFAULT_WS/memory" "$DEFAULT_WS/sessions" "$DEFAULT_WS/.cursor/rules"

COPIED=0
for f in "${TEMPLATE_FILES[@]}"; do
    if [[ ! -f "$DEFAULT_WS/$f" ]]; then
        cp "$TEMPLATE_DIR/$f" "$DEFAULT_WS/$f"
        echo "  📄 已复制 $f"
        COPIED=$((COPIED + 1))
    else
        echo "  ✅ $f 已存在（保留用户定制版本）"
    fi
done

for f in "${TEMPLATE_RULES[@]}"; do
    if [[ ! -f "$DEFAULT_WS/$f" ]]; then
        cp "$TEMPLATE_DIR/$f" "$DEFAULT_WS/$f"
        echo "  📄 已复制 $f"
        COPIED=$((COPIED + 1))
    else
        echo "  ✅ $f 已存在"
    fi
done

if [[ $COPIED -gt 0 ]]; then
    echo ""
    echo "  💡 建议编辑以下文件完成个性化："
    echo "     $DEFAULT_WS/IDENTITY.md  — 给你的 AI 起个名字"
    echo "     $DEFAULT_WS/USER.md      — 填入你的个人信息"
fi

# ── 完成 ─────────────────────────────────────────
echo ""
echo "============================================="
echo "  ✅ 安装完成！"
echo "============================================="
echo ""
echo "  启动服务:"
echo "    cd \"$BOT_DIR\""
echo "    bun run server.ts"
echo ""
echo "  后台运行:"
echo "    nohup bun run server.ts > /tmp/relay.log 2>&1 &"
echo ""
echo "  更换 Key/模型: 直接编辑 .env（热更换）"
echo ""
echo "  工作区文件位置: $DEFAULT_WS"
echo "    编辑 IDENTITY.md 和 USER.md 完成个性化"
echo "    MEMORY.md 和 memory/ 会随使用自动积累"
echo "============================================="
