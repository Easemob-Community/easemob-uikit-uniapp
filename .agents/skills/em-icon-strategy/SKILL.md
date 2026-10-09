---
name: em-icon-strategy
description: Use when adding/replacing icons in easemob-uikit-uni（选图标方案、加新图标、替换正式 iconfont 字体、或有人提议用 svg/png/图片图标时）。环信 uni UIKit 图标最终定稿策略。
---

# em-icon 图标策略（定稿）

## Overview

图标一律走 **iconfont 字体图标**：本地 ttf 放组件同级目录 + `@font-face` 相对路径引入，由 `em-icon` 原子组件收口「图标名 → unicode 码点」映射并用 `<text>` 渲染。RiceUI `rice-icon` / uni-ui x `uni-icons-x` 同款方案，vapor 五端（Android/iOS/鸿蒙/H5/微信小程序）零条件编译。

**禁止打包 svg/png 图片图标**：svg 在小程序/App 端不可行（无内联 svg，image 组件渲染 svg 有平台差异）。复杂图形（如进度环）才允许 view + transform 纯绘制。

## 落地文件（uni_modules/easemob-uikit-uni/components/em-icon/）

| 文件 | 作用 |
|---|---|
| `em-icons.ttf` | 字体本体。当前为占位字体，来自 DCloud uni-icons 的 `uniicons.ttf`（Apache-2.0，https://github.com/dcloudio/uni-ui） |
| `em-icons.ts` | 图标名 → unicode 码点映射表（`EmIcons` + `EmIconName` 类型），新增/替换图标只改这里 |
| `em-icon.vue` | 原子组件：props `name` / `size` / `color`，emits `click`；`@font-face` 相对路径引 ttf，`<text>` 渲染码点，颜色默认走 `--em-icon-muted` token |

## 常用操作

- **加新图标**：在 `em-icons.ts` 的 `EmIcons` 里加一行 `'name': '\ueXXX'`（码点须在 ttf 中存在），业务侧 `<em-icon name="name" />`。不要在组件里写死码点。
- **替换正式字体（一期→正式版）**：设计师在 iconfont.cn 维护项目 → 下载 ttf 覆盖 `em-icons.ttf` → 用其 `iconfont.json` 重新生成 `em-icons.ts`。**只动这两个文件，组件与业务代码零改动**——这正是选字体方案的原因。
- **需要点击的图标**：直接用 `em-icon` 的 `@click`，不要在外层再包 button。

## 约束对照（ucss 子集）

- 文字/字形样式只落在 `<text>` 上（em-icon 模板即单 text 节点）。
- `font-size` 用 props 传入的内联 style，不写死 class；颜色优先 `--em-*` token。
- `@font-face src` 必须相对路径，保证 uni_modules 被符号链接/拷贝到任意工程后仍可解析。
