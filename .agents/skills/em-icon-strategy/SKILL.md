---
name: em-icon-strategy
description: Use when adding/replacing icons in easemob-uikit-uni（选图标方案、加新图标、替换正式 iconfont 字体、或有人提议用 svg/png/图片图标时）。环信 uni UIKit 图标最终定稿策略。
---

# em-icon 图标策略（定稿）

## Overview

图标一律走 **iconfont 字体图标**：本地 ttf 放组件同级目录 + `@font-face` 相对路径引入，由 `em-icon` 原子组件收口「图标名 → unicode 码点」映射并用 `<text>` 渲染。RiceUI `rice-icon` / uni-ui x `uni-icons-x` 同款方案，vapor 五端（Android/iOS/鸿蒙/H5/微信小程序）零条件编译。

**图标选择 = vue 版 1:1**：组件用哪一款 icon 不是自由发挥，必须与本仓库 `easemob-uikit-vue` 对应组件（chat/message-input、conversation、contact、group、quote、message-item 等）里的 `<Icon name>` 逐项同名同字形。字体已含 vue `icons-v2` 全量 287 字形（线性 + filled），组件内部一律写 **vue 同名规范键**（`chevron/left` → `chevron-left`、`filled/pin` → `pin-filled`、`filled/bell/slash` → `bell-slash-filled`）；旧版 uni-icons 别名（`left`/`close`/`compose`/`more`/`sound` 等）只保留给外部接入者兼容，**内部代码禁止再用**。

**禁止打包 svg/png 图片图标**：svg 在小程序/App 端不可行（无内联 svg，image 组件渲染 svg 有平台差异）。复杂图形（如进度环）才允许 view + transform 纯绘制。

**唯一例外：平台原生 tabBar 的 iconPath**。微信小程序/uni-app x 原生 tabBar 只接受 PNG（不支持字体图标），因此 `demo/static/tabbar/*.png` 由 `scripts/build-tabbar-icons.py` 直接从 `em-icons.ttf` 字形生成（81×81、24 设计画布映射 60×60 居中、未选 `#919BA1` / 选中 `#009EFF`，对应 `bubble-rect`、`person-double`、`person-single` 的线性/面性档）。**只用于 pages.json 的原生 tabBar**；自定义 tabBar 或页面内图标仍必须用 `em-icon`。改 tabBar 图标时改脚本 ICONS 表重跑，不要手绘/换库；`em-icons.ttf` 重建后也建议重跑保持 PNG 同步。

## 落地文件（uni_modules/easemob-uikit-uni/components/em-icon/）

| 文件 | 作用 |
|---|---|
| `em-icons.ttf` | 字体本体。由 `scripts/build-icons.py` 从 vue 版 uikit 图标库（`easemob-uikit-vue/packages/uikit-core/src/assets/icons-v2`， sibling 路径）全量构建：描边图标经 skia 转填充轮廓、非 24 画布归一、三次贝塞尔转二次、私用区码点 U+E000 顺序分配。当前为正式版（287 字形 + 旧版别名） |
| `em-icons.ts` | 图标名 → unicode 码点映射表（`EmIcons` + `EmIconName` 类型），新增/替换图标只改这里 |
| `em-icon.vue` | 原子组件：props `name` / `size` / `color`，emits `click`；`@font-face` 相对路径引 ttf，`<text>` 渲染码点，颜色默认走 `--em-icon-muted` token |
| `em-icon.css` | `@font-face` 与 `.em-icon` 字体族声明。**族名带版本号（`em-icons-vN`）**——微信 mp 端 @font-face 按族名持久缓存，ttf 内容更新不重载（2026-10-16 实测：合并新字形后模拟器恒渲染旧字体，重启开发者工具无效，族名升版即恢复）。**每次改动 em-icons.ttf 内容，必须同步递增族名版本号** |

## 常用操作

- **替换/更新正式字体**：vue 版图标库增删图标后，重跑 `.venv-icons/bin/python scripts/build-icons.py`（幂等，全量重建 ttf + `em-icons.ts`，含旧版 uni-icons 命名别名，业务代码零改动）→ **递增 em-icon.css 族名版本号**。`--dry-run` 只校验打印报告（描边转曲相似度、弱匹配别名清单）不出文件。依赖：`.venv-icons`（fonttools / svgpathtools / skia-python）。
- **1:1 对照自检**：`.venv-icons/bin/python scripts/check-icon-parity.py --verbose` —— 校验 vue 每个 SVG 都在 `em-icons.ts` 有规范键、每个键在 ttf 有字形、组件里的字面量图标名全部存在，并把「内部还在用旧别名」单列 WARN（退出码 0/1，可进 CI）。只做名称/来源对照，轮廓一致性由 `build-icons.py --dry-run` 的相似度报告负责。
- **补单个临时字形**：ttf 无对应字形且不想全量重建时，跑 `scripts/patch-icons.py`（从 Remix Icon 合并字形到私用区码点，幂等，JOBS 表加行即可），然后在 `em-icons.ts` 补映射并升族名。
- **原生 tabBar 图标**：`.venv-icons/bin/python scripts/build-tabbar-icons.py`（从 em-icons.ttf 取字形轮廓 → 81×81 PNG，改 ICONS 表即可增换；重构建字体后也重跑）。
- **需要点击的图标**：直接用 `em-icon` 的 `@click`，不要在外层再包 button。

## vue 名 → 规范键（常用）

| vue `<Icon name>` | 本项目规范键 | 典型位置 |
|---|---|---|
| `chevron/left` / `chevron/right` / `chevron/down` / `chevron/up` | `chevron-left` / `chevron-right` / `chevron-down` / `chevron-up` | 导航返回、cell 箭头、公告展开、查看全部 |
| `xmark/bold` | `xmark-bold` | 弹层关闭、已选头像条移除 |
| `circle/xmark` | `circle-xmark` | 引用条关闭（**不是** xmark-bold） |
| `circle/plus` | `circle-plus` | 会话/群组 header「+」、输入栏「+」 |
| `circle/face` | `circle-face` | 输入栏表情入口 |
| `plane` | `plane` | 输入栏发送（有文本时） |
| `mic` / `mic/fill` / `mic/dot` | `mic` / `mic-fill` / `mic-dot` | 语音入口、录音浮层、输入工具栏 |
| `rect/img` / `camera` / `video` / `folder` | `rect-img` / `camera` / `video` / `folder` | 更多面板相册/拍照/视频/文件 |
| `triangle` | `triangle` | 语音播放、视频播放覆盖层 |
| `loading/arc/normal` / `loading/arc/big` | `loading-arc-normal` / `loading-arc-big` | 消息发送中、加载态 |
| `circle/empty-1` / `circle/checked` / `circle/bang` | `circle-empty-1` / `circle-checked` / `circle-bang` | 已读回执/发送失败 |
| `filled/pin` / `filled/bell/slash` | `pin-filled` / `bell-slash-filled` | 会话条目置顶/免打扰徽标 |
| `filled/circle/checked` / `circle/empty` | `circle-checked-filled` / `circle-empty` | 多选 checkbox |
| `file/img` / `file/video` / `file/pdf` / `file/xls` / `file/ppt` / `file/md` / `file/audio` / `file/empty` / `doc` | `file-img` / `file-video` / `file-pdf` / `file-xls` / `file-ppt` / `file-md` / `file-audio` / `file-empty` / `doc` | 引用类型图标、文件消息 |
| `arrow/turn_left` / `arrow/lft_uturn` / `arrow/down_tray` | `arrow-turn-left` / `arrow-lft-uturn` / `arrow-down-tray` | 引用菜单 / 撤回菜单 / 下载 |
| `rects` / `trash` / `vertical` / `board` / `at` | `rects` / `trash` / `vertical` / `board` / `at` | 复制/删除菜单、更多、群公告、@ 空态 |
| `person/plus` / `person/double` / `person/minus` / `person/arrows` / `shield/person` | `person-plus` / `person-double` / `person-minus` / `person-arrows` / `shield-person` | 加好友/群组/成员操作 |
| `bubble/rect/empty` / `bubble/rect/2` / `bubble/circle` / `list/bullet` / `circle/quote` | `bubble-rect-empty` / `bubble-rect-2` / `bubble-circle` / `list-bullet` / `circle-quote` | 新建会话、空态、私聊菜单、引用文本图标 |

## 约束对照（ucss 子集）

- 文字/字形样式只落在 `<text>` 上（em-icon 模板即单 text 节点）。
- `font-size` 用 props 传入的内联 style，不写死 class；颜色优先 `--em-*` token。
- `@font-face src` 必须相对路径，保证 uni_modules 被符号链接/拷贝到任意工程后仍可解析。
