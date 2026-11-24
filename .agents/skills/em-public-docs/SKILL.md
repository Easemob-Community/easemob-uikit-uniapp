---
name: em-public-docs
description: Use when writing, updating, or reviewing the public documentation of easemob-uikit-uni under docs/ for the easemob-community-docs portal — new guide/page/component/API page, changelog, sidebar or manifest change, or a public-boundary audit. Covers the source-of-truth map, page taxonomy, external-only writing rules (no P0/P1/milestone/planning language), templates, manifest registration, and validation with scripts/check-docs.mjs plus the community-docs sync/build.
---

# em-public-docs — uniApp UIKit 对外文档生成与维护

> 本 skill 只服务**对外发布**的文档：`docs/` 下由 `docs/docs.manifest.mjs` 显式登记的页面，以及 `uni_modules/easemob-uikit-uni/changelog.md`。
> 内部材料（`PLAN.md`、`docs/STATUS.md`、`docs/SPIKE-*`、`docs/REVIEW-*`、`docs/RELEASE-*`、`docs/EVAL-*`）永远不进入公开内容；不要把它们的内容原样搬进公开页。

## 1. 三条铁律

1. **只写已经可用、可验证的对外能力。** 不写路线图、里程碑、优先级、待验证项、内部评审结论、未发布计划。
2. **公开内容必须显式登记。** 新页面 = `docs/<FILE>.md` + `docs/docs.manifest.mjs` 的 `pages` 清单（entries/sidebar/editLink/markdownReplacements 由清单派生）；未登记的文件不会被同步。
3. **组件/API 契约以源码为唯一真源。** 先读组件 `defineProps` / `defineEmits` / `<slot>` 与 `libs/index.ts`、`libs/types`、`libs/constants`，再写文档；不以 `STATUS.md` 或旧文档中的描述代替源码。

## 2. 真源映射（写之前先读）

| 文档内容 | 唯一真源 |
|---|---|
| 页面组件 props / emits / 插槽 | `uni_modules/easemob-uikit-uni/components/pages/<name>/<name>.vue` |
| 原子组件 props / emits / 插槽 | `uni_modules/easemob-uikit-uni/components/<name>/<name>.vue` |
| 组件样式与 token 用法 | 同名 `.css`、`libs/style/variables.css` |
| EmKit 方法签名 | `libs/index.ts`（`class EmKitImpl`） |
| 公开类型 | `libs/types/index.ts` |
| 枚举/常量 | `libs/constants/index.ts` |
| 配置项与默认值 | `libs/types/index.ts` 的 `EmKitConfig` / `EmUiConfig`、`libs/store/config.ts` |
| 平台能力差异 | `libs/platform.ts` 的 `PLATFORM_CAPABILITIES`、各组件条件编译 |
| 主题与 i18n | `libs/use/useTheme.ts`、`libs/use/useLocale.ts`、`libs/locale/*` |
| 宿主接线示例 | `demo/pages/**`、`demo/sub-im/pages/**`（只取面向接入方的部分） |
| 版本号 | `uni_modules/easemob-uikit-uni/package.json` |
| 已发布变更 | `uni_modules/easemob-uikit-uni/changelog.md`（对外口径需重写） |

快速提取命令（只读）：

```bash
# 组件契约
for f in uni_modules/easemob-uikit-uni/components/*/*.vue; do
  echo "### $f"; sed -n '1,140p' "$f" | grep -nE 'interface Props|^  [a-zA-Z].*[?:]|defineProps|defineEmits|slot name='
done

# EmKit 方法
grep -nE '^  (async )?[a-zA-Z][a-zA-Z0-9]*\(' uni_modules/easemob-uikit-uni/libs/index.ts

# 配置字段
sed -n '/interface EmKitConfig/,/^}/p' uni_modules/easemob-uikit-uni/libs/types/index.ts
```

## 3. 公开文档地图

所有源文件在 `docs/`。指南站点路径在 `uniapp/guide/`，API 参考同时提供 `uniapp/api/` 命名空间（首页映射到 `uniapp/index.md`）。

| 源文件 | 站点路径 | 内容边界 |
|---|---|---|
| `HOME.md` | `/uniapp/` | 产品定位、能力总览、文档入口 |
| `QUICKSTART.md` | `/guide/quickstart` | 空工程到收发消息的最小链路 |
| `CONCEPTS.md` | `/guide/concepts` | 分层架构、生命周期、数据流、页面模型、接入形态 |
| `GUIDE-AGENT-SKILLS.md` | `/guide/agent-skills` | Agent Skills 安装与技能地图；由 `skills/README.md` 生成 |
| `SKILLS-*.md` | `/guide/skills-*` | 各接入技能全文；由对应 `skills/em-host-*/SKILL.md` 生成，编辑回源技能文件 |
| `PAGES-CONVERSATION.md` | `/guide/pages-conversation` | 会话列表页 |
| `PAGES-CHAT.md` | `/guide/pages-chat` | 聊天页 |
| `PAGES-CHAT-INFO.md` | `/guide/pages-chat-info` | 聊天信息/群资料页 |
| `PAGES-CONTACTS.md` | `/guide/pages-contacts` | 通讯录入口、好友列表、好友申请 |
| `PAGES-GROUPS.md` | `/guide/pages-groups` | 群组列表与建群 |
| `COMPONENTS.md` | `/guide/components` | 组件总览与选型 |
| `COMPONENTS-BASIC.md` | `/guide/components-basic` | 基础原子组件 |
| `COMPONENTS-CONVERSATION.md` | `/guide/components-conversation` | 会话与导航组件 |
| `COMPONENTS-CHAT.md` | `/guide/components-chat` | 聊天输入/气泡/消息组件 |
| `COMPONENTS-CONTACT.md` | `/guide/components-contact` | 联系人/群组/选人组件 |
| `API.md` | `/uniapp/api/` | API 总览与分类入口 |
| `API-COMPONENTS.md` | `/uniapp/api/components` | 组件家族索引，不复制 props 表 |
| `API-COMPOSABLES.md` | `/uniapp/api/composables` | 主题、语言、未读与聊天输入行为 |
| `API-UTILS.md` | `/uniapp/api/utils` | 展示、平台、媒体、存储与日志工具 |
| `API-KIT.md` | `/guide/api-kit` | EmKit 兼容索引与共同约束 |
| `API-KIT-STATE/LIFECYCLE/MESSAGES/MESSAGE-OPERATIONS/CONVERSATIONS/CONTACTS/GROUPS/LOGS.md` | `/uniapp/api/kit-*` | 按业务域拆分的 EmKit 方法、参数、返回值与示例 |
| `API-TYPES.md` | `/guide/api-types` | 类型兼容索引与导入说明 |
| `API-TYPES-MESSAGES/CONVERSATIONS/CONTACTS-GROUPS/COMPONENTS/THEME/PLATFORM.md` | `/uniapp/api/types-*` | 按领域拆分的类型、字段与常量 |
| `CONFIG.md` | `/guide/config` | 初始化/行为/UI 配置 |
| `MESSAGING.md` | `/guide/messaging` | 消息模型、发送、引用/@/自定义/通知/流式协议 |
| `THEME-I18N.md` | `/guide/theme-i18n` | 主题、明暗模式、国际化 |
| `DESIGN-TOKENS.md` | `/guide/design-tokens` | `--em-*` 设计变量 |
| `PLATFORM.md` | `/guide/platform` | 五端能力矩阵与差异 |
| `PLATFORM-DEVICES.md` | `/guide/platform-devices` | 设备与端差异：影响范围、归因、状态与处理 |
| `FAQ.md` | `/guide/faq` | 常见问题与排错 |
| `AI-STREAM.md` | `/guide/ai-stream` | AI 流式消息 |
| `GUIDE-MULTI-SCENARIO.md` | `/guide/multi-scenario` | 多场景（客服/医疗/招聘/交易）接入 |
| `GUIDE-WEAPP-SDK-SUBPACKAGE.md` | `/guide/weapp-sdk-subpackage` | 微信小程序 SDK 分包 |
| `GUIDE-ON-DEMAND.md` | `/guide/on-demand` | 按需接入与包体积：什么自动裁剪、什么始终全量、怎么自查 |
| `HARMONY-REALDEVICE-RUN.md` | `/guide/harmony-realdevice-run` | 鸿蒙真机与签名 |
| `DEMO.md` | `/guide/demo` | Demo 工程与场景实验室 |
| `SCREENSHOTS.md` | `/guide/screenshots` | 按 Android／HarmonyOS 切换的真机截图（核心界面 + 页面主流程 + 特性专题），图放 `docs/assets/shots/<platform>/` |
| `../uni_modules/easemob-uikit-uni/changelog.md` | `/guide/changelog` | 对外更新日志 |

新增页面时同步更新本表、`docs/docs.manifest.mjs` 的 `pages` 清单、以及同组页面的交叉链接。

## 4. 对外写作规范

### 4.1 禁止出现的内部词汇

以下词汇/写法只属于内部协作，公开页面一律不出现：

- 优先级/批次：`P0`、`P1`、`P2`、`P3`
- 里程碑：`M0`…`M9`、`M2.8`、`Phase 1`、`一期`、`二期`、`三期`
- 状态：`待验`、`待验证`、`挂账`、`遗留`、`未落地`、`占位`、`TODO`、`FIXME`
- 规划：`规划`、`路线图`、`后续里程碑`、`后续版本`、`即将支持`、`计划支持`
- 内部材料：`PLAN.md`、`STATUS.md`、`SPIKE`、`REVIEW`、`RELEASE`、`EVAL`、`评审`、`内部`
- 实现过程：`本轮`、`本轮整改`、`复刻`、`对齐 vue 源码`、`临时方案`、`兜底方案`（描述机制时用“实现方式”即可）

**表达限制的正确方式**：陈述当前事实 + 平台范围 + 替代路径，例如：

- ✅ “当前版本中，视频播放入口仅在 H5 显示；App 与小程序展示封面和时长。”
- ✅ “文件发送入口在 App 端隐藏；小程序与 H5 可用。”
- ✅ “如需自定义卡片，使用 `EmKit.sendCustom` + `#custom-message` 插槽，整卡由宿主渲染。”
- ❌ “视频播放 P1 再做。” / “文件下载待验。” / “规划支持群已读。”

### 4.2 语言与结构

- 简体中文，第二人称对宿主开发者说话；术语首次出现给英文/代码名。
- 每页开头一段“这页解决什么问题”，再进入能力/用法/契约/限制。
- 组件契约统一用表格：`属性 | 类型 | 默认值 | 说明`、`事件 | 载荷 | 说明`、`插槽 | 作用域 | 说明`。
- 代码示例统一 Vue 3 + `<script setup lang="ts">`，从 `@/uni_modules/easemob-uikit-uni/libs` 导入；页面根节点带 `themeClass`、`height:100%` 与 flex 链。
- 不写真实 appkey/token/用户 id；示例用 `your-appkey`、`user-a`、`user-b`。
- 不引用本机绝对路径，不写“见某台机器上的 vue 源码”。
- 链接一律使用同目录相对源文件名（如 `./PAGES-CHAT.md`），由 manifest 的 `markdownReplacements` 改写到站点 slug；不使用 `/Users/...`、不使用 `../README.md`。
- **例外：`HOME.md`**（映射到 `/uniapp/index.md`，与 guide 不同目录）正文链接用站点绝对路径（如 `/uniapp/guide/pages-chat`），避免相对路径改写后指向 `/uniapp/quickstart`。
- 图片放 `docs/assets/`，在 manifest 里已整体映射到 `uniapp/guide/assets`。公开页统一使用 `DocsImage`，填写图片真实像素宽高等比例展示，例如 `<DocsImage src="assets/example.webp" alt="示例界面" :width="750" :height="1625" />`；首屏主图可添加 `eager`，其余图片保持默认懒加载。

### 4.3 页面模板

```markdown
# 会话列表页（em-conversation-page）

一句话说明这个页面解决什么问题，以及它在宿主工程中的位置。

## 能力

- 能力 1
- 能力 2

## 最小用法

```vue
<template>
  <view class="page" :class="themeClass">
    <em-conversation-page @select="onSelect" />
  </view>
</template>
```

## Props

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|

## Events

| 事件 | 载荷 | 说明 |
|---|---|---|

## Slots

| 插槽 | 作用域 | 说明 |
|---|---|---|

## 宿主接线

...

## 行为与边界

...
```

### 4.4 组件模板

```markdown
## em-avatar

用途一句话。导入路径 / easycom 说明。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `src` | `string` | `''` | ... |

| 事件 | 载荷 | 说明 |
|---|---|---|

| 插槽 | 作用域 | 说明 |
|---|---|---|

```vue
<em-avatar src="https://..." name="张三" :size="40" />
```
```

### 4.5 API 模板

```markdown
### `EmKit.sendText(to, chatType, text, quote?, mentions?, ext?)`

发送文本消息。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `to` | `string` | 是 | 单聊为对方 userId，群聊为 groupId |
...

返回：`Promise<EmMessageItem>`。
```

## 5. 生成/更新流程

1. **确认范围**：读 `git diff` / `git log`，列出新增或变更的组件、API、配置、平台能力、页面。
2. **提取契约**：按第 2 节读源码；不要从旧文档反推。
3. **对照文档地图**：确定要改的页面；新能力若是独立主题，新增页面并登记，而不是把内容塞进 QUICKSTART。
4. **写作**：套用模板；限制只用“当前版本 + 平台范围”陈述；补最小可运行示例。修改 `skills/` 后不手改对应公开页，运行 `node scripts/sync-skills-docs.mjs` 重新生成总览与详情。
5. **登记 manifest**：`docs/docs.manifest.mjs` 的 `pages` 增加 `{ source, to, group, text }`；API 页同时声明 `apiGroup`，由同一元数据派生 `/uniapp/guide/` 与 `/uniapp/api/` 两套 sidebar，不另写重复链接清单。首页 `sidebar:false`。生成页用 `editSource` 指向 Skills 源文件。entries/sidebar/editLink/markdownReplacements 自动派生；`editLink` 函数内的 `sourcePath` 字面量映射也要补一行（函数必须自包含）。新增侧边栏分组时，还要在门户 `.vitepress/theme/docs-context.ts` 登记分类与路由匹配，否则页面可打开但分类导航和左侧页面树为空。
6. **跑校验**：`node scripts/check-docs.mjs`。它会检查内部术语、链接、侧边栏/编辑链接、组件与 EmKit/配置覆盖；改 Skills 时同时运行 `node scripts/check-skills.mjs` 检查生成新鲜度。
7. **同步站点**：在 `easemob-community-docs` 仓库执行 `node scripts/sync-content.mjs`（或 `pnpm content:sync`），确认 `.content/uniapp/` 出现新页面。
8. **构建**：`pnpm build`（需要 Vue 仓库依赖；会重建 `.content`）。至少保证 `content:check` 与 VitePress build 通过。
9. **页面走查**：打开 `pnpm dev` 或 preview，检查侧边栏、页面标题、代码块、内部链接、移动端宽度。
10. **提交**：文档与 manifest、skill 变更同批提交；changelog 同步写对外口径。

## 6. 校验命令

```bash
# 公开边界 + 覆盖检查 + 内部术语
node scripts/check-docs.mjs

# 技能包结构与公开文档新鲜度（改 skills/ 时先重新生成）
node scripts/sync-skills-docs.mjs
node scripts/check-skills.mjs

# 站点同步与构建（在 ../easemob-community-docs）
pnpm content:sync
pnpm content:check
pnpm build
```

`check-docs.mjs` 的覆盖规则：

- `docs/` 下每个 `.md` 要么在 manifest `pages` 中，要么在内部文档白名单（`STATUS/PLAN/SPIKE/REVIEW/RELEASE/EVAL`）；新页面漏登记会报错。
- 每个组件目录名（`em-*`）至少在一篇公开页出现；新增组件必须补文档。
- `EmKitImpl` 的每个公开方法必须在拆分后的 `API*.md` 聚合内容中出现，不再只检查 `API-KIT.md`；`EmKitConfig`/`EmUiConfig` 的每个字段至少在 `CONFIG.md` 出现。sidebar 校验递归读取嵌套分组并规范化 `/index` 路由。
- `UseChatComposerResult` 的每个返回字段必须在 `API-COMPOSABLES.md` 出现，并明确区分 composable 返回值与 `#input-bar` 插槽作用域；`API-KIT-STATE.md` 必须保持 `EmKit.state.userId !== ''` 的登录判断方向。
- 公开 Markdown 里的相对链接必须指向已登记页面或已映射资产。
- 禁止词按第 4.1 节扫描（忽略代码块）。

## 7. 变更触发清单

出现以下任一变更，必须同批更新文档：

- 新增/删除组件，或组件 props/emits/slots 变化 → 对应 `COMPONENTS-*.md` + 组件总览。
- 新增/修改 `EmKit` 方法 → `API-KIT.md`；涉及新类型/常量 → `API-TYPES.md`。
- 新增 `EmKitConfig` / `uiConfig` 字段 → `CONFIG.md`。
- 新增页面组件或页面行为 → `PAGES-*.md` + `QUICKSTART.md` 的步骤/排错。
- 平台能力变化（`PLATFORM_CAPABILITIES`、条件编译）→ `PLATFORM.md` + 相关组件页的“平台范围”。
- 主题/i18n 行为变化 → `THEME-I18N.md` + `DESIGN-TOKENS.md`。
- 消息协议/扩展点变化 → `MESSAGING.md` + `GUIDE-MULTI-SCENARIO.md` / `AI-STREAM.md`。
- 版本发布 → `changelog.md`（对外措辞，不含里程碑编号）。

## 8. 发布前质量清单

- [ ] 页面标题、首段、导航条目一致；没有“待补/占位/TODO”。
- [ ] props/emits/slots 与源码逐项一致，默认值来自 `withDefaults`。
- [ ] 每个代码示例都包含必要的 `themeClass`、页面高度、登录守卫（如适用）。
- [ ] 限制写成“当前版本 + 平台范围 + 替代方案”，没有内部优先级/计划。
- [ ] 所有相对链接可在 `docs/` 内解析，且目标已登记。
- [ ] `node scripts/check-docs.mjs` 通过。
- [ ] `easemob-community-docs` 的 `content:sync` + `content:check` + `build` 通过。
- [ ] 没有真实 appkey/token/用户数据；没有本机绝对路径。

## 9. 常见错误

| 错误 | 后果 | 正确做法 |
|---|---|---|
| 直接复制 `STATUS.md` 段落 | 内部术语、待验项、实现细节泄漏 | 按源码重写为对外能力描述 |
| 只改组件、不登记 manifest | 页面不出现/构建报错 | 补 `pages` + sidebar 字面量 + editLink 映射 |
| 把页面组件当原子组件写 easycom | 宿主导入失败 | 页面组件需 `pages.json` custom easycom 规则 |
| 写“P0 能力已支持” | 对外暴露内部优先级 | 写“已支持”并给用法 |
| 声称某端支持但未验证 | 接入方踩坑 | 对照 `PLATFORM_CAPABILITIES` 与条件编译，写清平台范围 |
| 用绝对站点路径 `/uniapp/guide/x` | GitHub 预览与同步链接失效 | 用 `./X.md`，交给 manifest 改写 |
