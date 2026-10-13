---
name: vue-uikit-design-reference
description: Use when designing/building/polishing ANY UI in easemob-uikit-uni（新组件、气泡、菜单、弹层、列表、页面视觉、样式对齐）。视觉与交互设计的权威依据是本机 easemob-uikit-vue 源码，动手写样式前必须先读对应模块。
---

# vue-uikit 设计参照（定稿约束）

## Overview

uni 版 UIKit 的视觉与交互**不是自由发挥**：权威设计依据是本机的 vue 版 UIKit 源码（设计师定稿已落在它的组件与 token 里）。做任何 UI 工作前，先读对应模块的 vue 源码，再按 ucss 纪律翻译到 uni 端。

## 权威源码位置（本机，只读，禁止修改）

仓库根：`/Users/neohuang/Desktop/WorkCommonUse/UIKIT/easemob-uikit-vue`

| 要做什么 | 先读哪里 |
|---|---|
| 消息气泡/引用卡/各类型消息渲染 | `packages/uikit-im/src/modules/chat/message-item/`（text-message.vue、message-bubble-wrapper.vue 等）+ `chat/quote/`（quote-card.vue 引用卡、quote-bar.vue 输入栏引用条） |
| 长按菜单/消息操作 | `packages/uikit-im/src/modules/chat/message-action-menu/` |
| 输入栏 | `packages/uikit-im/src/modules/chat/message-input/` |
| 会话列表 | `packages/uikit-im/src/modules/conversation/` |
| 设计 token（颜色/字号/间距/圆角） | `packages/uikit-core/src/theme/`；映射口径见本仓库 `docs/DESIGN-TOKENS.md`（`--uikit-*` → `--em-*`） |
| 组件 props/emits/i18n key 契约 | 同路径下对应组件的 `defineProps`/`defineEmits` 与 locale 文件 |

注意：该仓库的 AGENTS.md 规则只约束它自己；我们对它**只读引用，绝不写入**。

## 翻译纪律（vue web CSS → uni ucss 子集）

照抄 web CSS 会在蒸汽端挂掉，必须翻译：

- `gap` → margin（含 self 变体的方向翻转修饰类）
- `-webkit-line-clamp` → `<text>` 的 `lines: N` + `overflow: hidden` + `text-overflow: ellipsis`
- inline 图标/`<span>` 混排 → flex 行内元素 + margin 近似基线对齐；文字样式只落 `<text>`
- 伪元素/hover 媒体查询/scoped/样式继承 → 全部禁用
- 颜色、字号、间距、圆角一律用已映射的 `--em-*` token；token 缺口先补 `libs/style/variables.css` 明暗两块（暗色必须全量），不要在组件里写死色值

## 冲突仲裁

vue 源码与本仓库 PLAN.md/AGENTS.md 冲突时（典型：vue 版的右键定位浮层、tiptap 富文本、合并转发等一期明确不做的功能），**以 PLAN.md 的裁剪清单为准**——vue 源码只管「要做的功能长什么样」，不管「做什么」。
