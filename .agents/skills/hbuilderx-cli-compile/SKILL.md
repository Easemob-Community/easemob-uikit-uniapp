---
name: hbuilderx-cli-compile
description: Use when compiling/running uni-app or uni-app x projects from CLI on macOS without the HBuilderX GUI, when HBuilderX dev server shows blank page for .uts entries, or when CI needs web/mp-weixin builds from the HBuilderX-bundled compiler.
---

# HBuilderX 内置编译器 CLI 用法

## Overview

HBuilderX 自带 vite 编译链（`HBuilderX.app/Contents/HBuilderX/plugins/uniapp-cli-vite`），无需 npm 安装 @dcloudio 全家桶即可 CLI 出包。App 端（Android/iOS/鸿蒙）编译仍必须走 HBuilderX GUI 流程。

## 用法（本仓库封装：scripts/uni.sh）

```bash
scripts/uni.sh build web        # H5 出包 → demo/unpackage/dist/build/web
scripts/uni.sh build mp-weixin  # 微信小程序出包 → demo/unpackage/dist/build/mp-weixin
```

环境变量核心：`UNI_APP_X=true`（uni-app x 工程）、`UNI_PLATFORM`、`UNI_INPUT_DIR`（项目根）、`UNI_OUTPUT_DIR`。可用 `HBUILDERX_PATH` 覆盖 HBuilderX 位置。

## 已知限制（实测）

- **`dev web` 不转换 .uts 入口**：dev server 对 main.uts 原样输出 → 浏览器白页。H5 验证走 `build web` + 静态伺服：`cd demo/unpackage/dist/build/web && python3 -m http.server 5180`
- **5.34 解析 websdk 压缩 chunk 失败**：`build web` 统一经 `scripts/web-sdk-build.mjs`，构建期间用内置 esbuild 重打包 SDK 根入口，结束恢复原文件；不要在其他脚本里绕过该包装器直接调 Web CLI。
- **`build -p app` 不可用**：CLI 直编 App 端缺 vue 解析等 GUI 管线环节，别用；App 端一律 HBuilderX GUI「运行/发行」
- 蒸汽工程编 web/mp 输出标注「VDOM模式」→ 官方预期（蒸汽视图层目前仅 App 端）

## 排错顺序

1. 编译报错先看是不是缓存：`rm -rf demo/unpackage/dist/cache/.vite demo/unpackage/cache demo/node_modules/.vite`
2. 「根目录缺少 index.html」→ 补 demo/index.html（script src 指向真实入口）
3. 结构类运行时错（黑屏/pagesMap）→ 用 uniapp-x-vapor-structure 技能核对工程结构
