---
name: uniapp-x-vapor-structure
description: Use when creating or debugging a uni-app x 蒸汽模式（vapor）工程, especially when App 端黑屏、报 "pagesMap.get(...) is not a function"、页面字节码缺失、web dev 白屏, or when deciding entry file conventions (main.uts vs main.ts, .uvue vs .vue).
---

# uni-app x 蒸汽工程结构配方

## Overview

uni-app x 蒸汽（vapor）工程有一套已实测验证的文件结构约定。偏离它会在 App 端出现黑屏 + `pagesMap.get(...) is not a function`，在 web dev 模式出现白屏。结构正确性先于一切业务代码排查。

## 必备结构（逐项核对）

| 文件 | 要求 | 偏离后果 |
|---|---|---|
| `main.uts` | 入口必须是 `.uts`（内容可纯 ts 写法：`createSSRApp(App)`） | App 端入口解析异常 |
| `App.uvue` | 必须 `.uvue`；`onLaunch` 等生命周期**全局直接调用**，禁止 `import { onLaunch } from '@dcloudio/uni-app'`（App 端编译目标无此导出，初始化抛错→pagesMap 未建立→黑屏） | 黑屏 + pagesMap 报错 |
| 页面文件 | `.uvue`，`<script setup lang="ts">` 保持纯 ts 纪律 | App 端页面字节码缺失 |
| `manifest.json` | `"uni-app-x": { "vapor": true, "vapor-render-target": "bytecode", "styleIsolationVersion": "2" }` | 蒸汽管线不生效 |
| `uni.scss` | 空占位也要有 | 编译告警/异常 |
| `index.html` | web 端必需；`<script src>` 必须指向真实入口（改 main.uts 后同步改） | 「根目录缺少 index.html」或入口 404 |

## 常见报错 → 根因

- `pagesMap.get(...) is not a function` + 黑屏 → 先查 App.uvue 生命周期 import（头号嫌疑），再核对上表
- `Module '"@dcloudio/uni-app"' has no exported member 'onLaunch'` 编译告警 → 就是上表第 2 行，别当无害告警放过
- 蒸汽工程编到 web/小程序显示「VDOM模式」→ 官方预期行为，不是 bug

## 验证配方来源

github.com/myZhangDong/uniappX-demo（同事实测五端跑通的 easemob websdk 集成示例）。

## 页面级补充

- `.vue` 在编译器解析列表里（uni_app_x_extensions 含 .vue），但已验证跑通的配方是 `.uvue`；`.vue` 页面在 App 蒸汽端的行为未验证，不要赌
- list-item 复用纪律（v-for :key、不拆组件）只与 list-view 相关，见 PLAN.md
