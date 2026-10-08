#!/bin/bash
# 用 HBuilderX 内置编译器（uniapp-cli-vite）编译 demo 工程
# 用法: scripts/uni.sh <dev|build> <web|mp-weixin>
# 可用 HBUILDERX_PATH 覆盖 HBuilderX 安装位置
set -e

MODE="${1:-dev}"
PLATFORM="${2:-web}"
HBX="${HBUILDERX_PATH:-/Applications/HBuilderX.app/Contents/HBuilderX}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLI_DIR="$HBX/plugins/uniapp-cli-vite"

if [ ! -d "$CLI_DIR" ]; then
  echo "未找到 HBuilderX 内置编译器: $CLI_DIR" >&2
  echo "请安装 HBuilderX 5.21+，或设置 HBUILDERX_PATH" >&2
  exit 1
fi

if [ "$MODE" = "dev" ]; then
  export NODE_ENV=development
  export UNI_OUTPUT_DIR="$ROOT/demo/unpackage/dist/dev/$PLATFORM"
else
  export NODE_ENV=production
  export UNI_OUTPUT_DIR="$ROOT/demo/unpackage/dist/build/$PLATFORM"
fi

export UNI_APP_X=true
export UNI_PLATFORM="$PLATFORM"
export UNI_INPUT_DIR="$ROOT/demo/"

cd "$CLI_DIR"
if [ "$MODE" = "dev" ]; then
  exec node node_modules/.bin/uni -p "$PLATFORM"
else
  exec node node_modules/.bin/uni build -p "$PLATFORM"
fi
