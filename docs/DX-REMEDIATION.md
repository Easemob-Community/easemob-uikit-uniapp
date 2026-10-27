# 接入体验整改计划（2026-10-27）

> 依据：[`docs/DX-REVIEW.md`](./DX-REVIEW.md)（问题编号 U-01 ~ U-15）。
> 目标：把“能跑通”变成“可复制地跑通”——补 starter、补契约、补作用域；**不扩功能边界、不改分层、不加运行时依赖**。
> 执行纪律：本计划批准后，先按 §8 并入 `PLAN.md`（M2.25 / M2.26），再动 `uni_modules/`；每批过 §6 门禁。
> 基线提醒：当前工作区有 M2.24（附件下载）与网络状态增强的未提交改动，B1 开始前先落基线，避免叠改聊天页与错误归因。

---

## 实施结果（2026-10-27）

评审中的 U-01～U-14 主要证据均经源码复核成立，已按实际代码完成整改。实现时作了两处收敛：页面级 `inputFeatures` 按字段与全局配置合并（不是整个对象替换），页面标题只增加 `title` prop（不新增 `#nav-action`）。

| 问题 | 处置 | 当前验证 |
|---|---|---|
| U-01 无 chat-only 起点 | 新增可运行 `templates/chat-only` 与 `check-template.mjs` | web/mp 构建及分包检查通过，主包约 731KB |
| U-02 身份示例会被覆盖 | 公开文档与 Skill 改用 `setUserPresentation`，补缓存/覆盖层对照 | 文档与 Skill 校验通过 |
| U-03 根页返回与导航 | 新增 `showNavBar/showBack` | web/mp 编译通过；真机视觉未专项验证 |
| U-04 未接线死入口 | 模板关闭无关入口，五类页面文档补接线地图 | 静态契约核对完成 |
| U-05 全局配置污染 | 新增页面级 `inputFeatures/messageMenuKeys` | 双实例运行时未实测，编译与契约检查通过 |
| U-06 H5 chrome 只在 demo | 新增公开 `useThemeChrome`，demo 改为消费 | web/mp 编译通过；运行时视觉未专项验证 |
| U-07 未登录等待超时 | 新增 `UNAUTHORIZED`、独立空态、事件与登录后恢复 | 编译与静态检查通过；真实登录链路未实测 |
| U-08 身份不是 prop | 新增 `peerName/peerAvatar`，安全撤销页面自己的残留覆盖 | 编译与静态检查通过 |
| U-09 页面标题写死 | 四个页面新增 `title`，不加额外 action 插槽 | 编译与契约检查通过 |
| U-10 高度链靠手工 | 模板固化正确高度链，不改组件根高度 | 模板构建通过 |
| U-11 文档表与版本漂移 | 修表、统一 rc.2，新增配置/版本校验 | 所有校验通过 |
| U-12 无首屏素材 | README、插件 readme、文档首页复用现有场景图 | 资源约 110KB，文档校验通过 |
| U-13 第三语言类型与恢复 | 开放扩展字符串，已注册 locale 可持久恢复 | 编译与契约检查通过 |
| U-14 平台不可用配置无提示 | 显式 voice/file 不可用时开发期一次性 warning | web/mp 构建通过；开发期提示次数未做真机核验 |

U-15 的未读分隔、聊天搜索、无障碍与字号缩放属于新增产品能力，本次不实施。真实账号收发、H5 实际视觉、微信开发者工具和 App 三真机专项未在本轮执行，不据此宣称五端到端已解决。完整自动门禁与最终验证记录见 `docs/STATUS.md` 当日条目。

---

## 0. 整改目标（可验收）

| # | 指标 | 现状 | 目标 |
|---|---|---|---|
| G1 | 新宿主从拿到模板到发出第一条消息 | 无模板；4–7 个文件、≈130 行胶水 | 克隆 `templates/chat-only` 后只改 3 个值（appkey / token 端点 / 路由），≤15 分钟 |
| G2 | chat-only 可编译 | 不存在；minimal-host 不可运行且类型错误 | web + mp-weixin 每次发版构建通过，纳入门禁 |
| G3 | 默认可见控件死入口 | 聊天页详情、会话建群、通讯录「+」等未接线即死 | 模板 0 死入口；每页文档 100% 标注“控件/事件/不接的后果” |
| G4 | 未登录进聊天页 | 8 秒骨架 + “历史加载失败” | 立即（<1s）显示“请先登录”，并透出 `unauthorized` 供宿主跳转 |
| G5 | 同一 App 两种聊天形态 | 只能全局 `setConfig` | 聊天页 `input-features` / `message-menu-keys` 页面级覆盖 |
| G6 | 文档一致性 | 配置表错位、版本漂移、身份 API 教错 | 脚本守护；配置表 0 错行、版本 1 处、公开页不再推荐 `mergeUserInfo` |

**验收方式**：G1 用秒表实测并记入 `docs/STATUS.md`；G2/G6 进门禁；G3 用清单逐项勾；G4/G5 用固定测试页与五端冒烟。

---

## 1. 范围

### 1.1 纳入

- 文档纠错、版本单源、配置表生成/校验。
- `templates/chat-only/` 可运行模板（H5 + 微信小程序），及其构建门禁。
- `em-chat-page` 导航开关、身份 props、未登录快速失败。
- 聊天页页面级行为配置（输入栏工具、长按菜单）。
- 主题 chrome 收口、页面标题覆盖、i18n 类型放宽、不可用配置的 dev warning、首屏素材。

### 1.2 不纳入

- Provider / 依赖注入 / 自动路由。
- 消息类型注册表、内置气泡结构接管。
- PC 宽屏、新消息类型、RTL、语音转文字。
- U-15 中的“未读分隔 / 聊天内搜索 / 无障碍与字号缩放”：只登记 backlog，不在本计划排期。
- 大改视觉与交互；视觉仍以 vue 版为权威。

---

## 2. 批次总览

| 批次 | 主题 | 覆盖问题 | 主要产出 | 人日 | 目标版本 |
|---|---|---|---|---:|---|
| **B0** | 止血：文档不骗人 | U-02、U-11 | 身份 API 口径、CONFIG 表、版本单源、接入形态选择 | 1.5 | 下一版（rc.3 / 1.0.1） |
| **B1** | 可复制：模板 + 默认值 + 未登录 | U-01、U-03、U-04、U-07 | chat-only 模板 + 构建门禁、`showNavBar/showBack`、`UNAUTHORIZED`、接线地图 | 6 | 下一版 |
| **B2** | 可组合：身份与作用域 | U-08、U-05 | `peer-name/peer-avatar`、页面级 `inputFeatures/messageMenuKeys` | 3 | 1.1 |
| **B3** | 可品牌化：主题/头部/i18n/首屏 | U-06、U-09、U-12、U-13、U-14 | `useThemeChrome`、页面标题、locale 放宽、dev warning、截图 | 4 | 1.1 |

合计 **14.5 人日**。按 2 人并行约 **8 个工作日**（不含五端真机回归）；按 1 人约 **3 周**。

**切线与顺序**：B0、B1 是“最低可接受整改”，不得砍；时间不足时先砍 B3，再砍 B2-2、B2-1。B0 可与 B1 并行。

---

## 3. 整改前后

| 场景 | 现在 | 整改后 |
|---|---|---|
| 只做聊天页 | 读 QUICKSTART + GUIDE-MULTI-SCENARIO，自己拼 4–7 个文件 | 克隆 `templates/chat-only`，改 3 个值 |
| 对端身份 | 文档推荐 `mergeUserInfo`，SDK 同步后可能回退 | `peer-name/peer-avatar` props，或文档推荐的 `setUserPresentation` |
| 聊天页即首页 | 返回箭头可见但点不动；无法隐藏 | `:show-back="false"` / `:show-nav-bar="false"` |
| 未登录误入 | 8 秒骨架 + “历史加载失败” | 立即“请先登录” + `unauthorized` 事件 |
| 同 App 双形态 | 全局 `setConfig` 互相污染 | 页面级 `input-features` / `message-menu-keys` |
| H5 深色 chrome | 抄 demo 的几十行 DOM 同步 | `useThemeChrome()` 一行接入 |
| 文档 | 配置表错位、版本三处不一致 | 脚本守护，1 处版本源 |

---

## 4. 工作分解

### B0 · 止血（1.5 人日，可与 B1 并行）

| ID | 任务 | 文件 | 做法 | 验收 | 人日 |
|---|---|---|---|---|---:|
| B0-1 | 版本单源 | `AGENTS.md`、`docs/QUICKSTART.md`、`skills/em-host-integration/SKILL.md`、`scripts/check-release.mjs` | 以 `uni_modules/easemob-uikit-uni/package.json` + changelog 首节为唯一源；扩展 `check-release.mjs` 校验这三处引用 | 脚本 0；故意改一处能失败 | 0.3 |
| B0-2 | CONFIG 表修复 + 守护 | `docs/CONFIG.md`、新增 `scripts/check-config-docs.mjs` | 修 `showReadStatus` / `messageStatus` / 重复 `enableGroupReadReceipt` 三处；脚本从 `libs/types/index.ts` 抽 `EmKitConfig` 字段，校验出现且不重复 | 脚本 0；表格人工复核 | 0.4 |
| B0-3 | 身份注入口径 | `docs/GUIDE-MULTI-SCENARIO.md`、`docs/API-KIT.md`、`skills/em-host-business-extension/SKILL.md` | §2/§5.6 改用 `setUserPresentation`；`mergeUserInfo` 标注“SDK 缓存，会被同步覆盖”；补一张两种注入的优先级/生命周期表 | `grep -rn "mergeUserInfo" docs/*.md skills/*` 不再作为推荐 | 0.5 |
| B0-4 | 接入形态选择 | `docs/QUICKSTART.md`、`docs/HOME.md`、`README.md`、插件 `readme.md` | 顶部加 3 行决策表：只聊天页 / 完整 IM / 业务页直进单聊；分别指向模板、demo、GUIDE-MULTI-SCENARIO | 新读者 30 秒内能选路径 | 0.3 |

> B0-4 的模板链接在 B1-3 合并后补齐；公开页不得出现“规划中 / 即将支持”类表述。合并顺序上可先落 B0-1/2/3，B0-4 与 B1-6 一起收尾。

### B1 · 可复制（6 人日）

| ID | 任务 | 文件 | 做法 | 验收 | 人日 |
|---|---|---|---|---|---:|
| B1-1 | 聊天页导航开关 | `em-chat-page.vue`、`em-chat-page.css`、`docs/PAGES-CHAT.md`、`docs/CONFIG.md` | 新增 `showNavBar?: boolean = true`、`showBack?: boolean = true`；`showNavBar=false` 时不渲染 `em-nav-bar` 并让消息区占满；`showBack` 透传；`@back` 语义不变 | 根页隐藏返回；隐藏导航后五端无安全区跳动、输入栏正常 | 0.5 |
| B1-2 | 未登录快速失败 | `libs/constants/index.ts`、`libs/chat/message.ts`、`em-chat-page.vue`、`libs/locale/*`、`docs/PAGES-CHAT.md` | 新增 `ERROR_CODE.UNAUTHORIZED`；`readyChatManager` 在 `connectionStore.userId === ''` 时立即 reject；聊天页渲染“请先登录”空态并 emit `unauthorized`，不再走 8 秒 `waitOnline` 与通用 toast；watch `state.userId` 由空变非空时自动重试一次首次历史 | init 后不 login：<1s 空态；登录后自动恢复；重连中不误报 | 1 |
| B1-3 | `templates/chat-only/` | 新目录 | 完整 uni-app x 工程：`manifest.json`（vapor）、`pages.json`（easycom/聊天页/登录页/`sub-sdk`）、`App.uvue`、`main.uts`、`theme.json`、`pages/login`、`pages/chat`、`common/im-config.ts`（appkey/token 端点/默认 peer）、`common/session.ts`（存储封装 + 安全存储接入点）、README；`uni_modules` 以软链指向仓库插件，README 说明外部使用时从插件市场导入或拷贝 | 按 README 三步可跑；H5 与 mp 均能登录并收发文本；无会话列表 | 2 |
| B1-4 | 模板构建门禁 | `scripts/check-template.mjs`（或 `build-template.sh`） | 以 `UNI_INPUT_DIR` 指向模板，跑 web + mp；mp 跑 `prepare-sdk-subpackage.mjs` + `check-mp-size.mjs`；断言产物含聊天页与 `sub-sdk/im-sdk.js` | 脚本 0；删 `sub-sdk` 或聊天页声明能失败 | 0.5 |
| B1-5 | 接线地图 | `docs/PAGES-CONVERSATION.md`、`PAGES-CHAT.md`、`PAGES-CHAT-INFO.md`、`PAGES-CONTACTS.md`、`PAGES-GROUPS.md` | 每页顶部加四列表：可见控件 / 事件 / 宿主必接 / 不接的后果；与代码 emit 名逐条核对 | 五页齐全；check-docs 通过；事件名与源码一致 | 1.5 |
| B1-6 | 入口与文档接线 | `README.md`、插件 `readme.md`、`docs/QUICKSTART.md`、`docs/CONCEPTS.md` | README/插件页/文档首页/QUICKSTART 四处指向模板；CONCEPTS §7.2 补模板链接；插件页写清 H5/mp 分包步骤 | 四个入口可达；无死链 | 0.5 |

> B1-3 的模板默认 `:show-action="false"`、`:show-back="false"`（聊天页作为根页），并在 README 写明“需要详情页时改回 true 并接 `@open-info`”。

### B2 · 可组合（3 人日，1.1）

| ID | 任务 | 文件 | 做法 | 验收 | 人日 |
|---|---|---|---|---|---:|
| B2-1 | 身份 props | `em-chat-page.vue`、`docs/PAGES-CHAT.md`、`docs/CONFIG.md` | 新增 `peerName?: string`、`peerAvatar?: string`；挂载时写 `setUserPresentation`；卸载时仅当当前 override 仍等于 props 值才清除（避免误删宿主后注入）；语义：props 是初始值，后调 API 优先 | 模板改用 props；不传时行为不变；宿主后注入不被清除 | 0.5 |
| B2-2 | 页面级行为配置 | `em-chat-page.vue`、`em-chat-inputbar` 接线、`docs/CONFIG.md` | 新增 `inputFeatures?: Partial<EmInputFeatures>`、`messageMenuKeys?: MessageMenuKeyValue[]`；计算 `resolvedFeatures/resolvedMenus = page ?? global`；不写回 `uiConfig`；输入栏用 resolved features，长按菜单用 resolved menus | 同 demo 两实例不同配置互不影响；无 prop 时全局 `setConfig` 仍生效 | 1.5 |
| B2-3 | 回归与文档 | 五端冒烟 + `docs/CONFIG.md` | 页面级覆盖的优先级、边界（哪些字段不支持页面级）写清；style-lab 或聊天页 query 增加最小对照 | 配置优先级无歧义；五端通过 | 1 |

### B3 · 可品牌化（4 人日，1.1）

| ID | 任务 | 文件 | 做法 | 验收 | 人日 |
|---|---|---|---|---|---:|
| B3-1 | 主题 chrome 收口 | 新增 `libs/use/useThemeChrome.ts`、`demo/common/theme.ts`、`docs/THEME-I18N.md` | 把 demo 的 `syncNativeThemeUI` + H5 `.uni-page-head/.uni-tabbar` 同步 + `onShow`/watch 收进 `useThemeChrome({ tabBarPages, colors })`；demo 改为消费 | H5 深色 nav/tab 正确；App/mp 行为不变 | 1 |
| B3-2 | 页面标题覆盖 | `em-conversation-page`、`em-contact-page`、`em-group-page`、`em-chat-info-page`、文档 | 新增 `title?: string`（空串回落 i18n）；各页 `#nav-action` 可选插槽（替换默认动作，宿主自担语义） | 标题可覆盖；小程序胶囊避让不回归 | 1.5 |
| B3-3 | i18n 类型放宽 | `libs/types/index.ts`、`libs/use/useLocale.ts`、文档 | `EmLocaleName` 放宽为可扩展字符串（保留 `zh-CN` / `en` 字面量补全）；保留内置常量与回退链；文档补“新增语言 = 词条 + `mergeMessages` + `setLocale`” | 第三方 locale（如 `ja`）编译通过、回退正确 | 0.5 |
| B3-4 | 不可用配置提示 | `libs/store/config.ts` 或 `EmKit.init`、日志 | dev 模式一次性 warning：H5 `voice=true`（无入口）、App `file=true` 但无 provider；生产静默 | console 有且仅一次 warning；不改变行为 | 0.5 |
| B3-5 | 首屏素材 | `README.md`、插件 `readme.md`、`docs/HOME.md`、`docs/assets` | 复用场景实验室主图，必要时压到 <300KB；README 用相对路径，插件页确认市场支持本地图 | 三处有主图；不引入外链依赖 | 0.5 |

### 4.5 问题覆盖对照

| 问题 | 对应任务 | 处理结果 |
|---|---|---|
| U-01 无可运行 chat-only 起点 | B1-3 / B1-4 / B1-6 | 修复：模板 + 门禁 + 四入口 |
| U-02 身份注入文档教错 | B0-3 | 修复：统一 `setUserPresentation`，补注入对照表 |
| U-03 聊天页不能根页/嵌入 | B1-1 | 修复：`showNavBar` / `showBack`；嵌入形态仍不支持（文档写明） |
| U-04 默认值假设全量套件 | B1-3 / B1-5 | 缓解：模板显式关详情入口 + 接线地图；能力裁剪 props 待 1.1 评估 |
| U-05 配置只有全局 | B2-2 | 修复：页面级 `inputFeatures` / `messageMenuKeys` |
| U-06 主题配置分散、H5 chrome 只在 demo | B3-1 | 修复：`useThemeChrome` 进 `libs` |
| U-07 未登录 8 秒后才报错 | B1-2 | 修复：`UNAUTHORIZED` + 立即空态 + `unauthorized` |
| U-08 身份不是 prop | B2-1 | 修复：`peerName` / `peerAvatar` |
| U-09 页面头部不可定制 | B3-2 | 修复：`title` prop + `#nav-action` |
| U-10 白屏三件套由宿主承担 | B1-3 + 文档 | 缓解：模板给正确高度链；组件级高度兜底因嵌套风险未列入本期 |
| U-11 文档表错位/版本漂移 | B0-1 / B0-2 | 修复：脚本守护 |
| U-12 无首屏截图 | B3-5 | 修复 |
| U-13 第三语言受类型限制 | B3-3 | 修复 |
| U-14 不可用配置静默失效 | B3-4 | 缓解：dev warning（不改变运行时行为） |
| U-15 运行时细节（未读分隔/搜索/无障碍） | — | Backlog：不在本计划排期 |

---

## 5. 依赖与关键路径

```text
B0-1 ─┐
B0-2 ─┼─> B0 完成 ──────────────┐
B0-3 ─┘                         │
                                ├─> 下一版（rc.3 / 1.0.1）
B1-1 ─> B1-2 ─> B1-3 ─> B1-4 ──┤
                  └─> B1-5/B1-6 ┘
B1 完成 ─> B2-1 ─> B2-2 ─> B2-3 ─> 1.1
B1 完成 ─> B3-1/B3-2/B3-3/B3-4/B3-5 ─> 1.1
```

- **B1-1 / B1-2 先于 B1-3**：模板要展示“干净的默认值”，否则模板里得写一堆绕行代码。
- **B1-5 可与 B1-3 并行**：接线地图是文档工作，不依赖模板。
- **B2 在 B1 之后**：模板先用 `setUserPresentation`，B2-1 落地后再改成 props，避免模板返工。
- **B3 可与 B2 并行**：文件与知识域不同（主题/页面头部 vs 聊天页配置）。

---

## 6. 门禁与验收

### 6.1 自动门禁（每批提交前）

```bash
scripts/uni.sh build web
scripts/uni.sh build mp-weixin        # 11 项防回归 + 主包 ≤1.5MB
cd demo/unpackage/dist/build/web && python3 -m http.server 5180   # 200
node scripts/check-docs.mjs
node scripts/check-skills.mjs
node scripts/check-release.mjs
node scripts/check-config-docs.mjs    # B0-2 新增
node scripts/audit-usage.mjs demo --check
node scripts/check-template.mjs       # B1-4 新增
```

### 6.2 人工矩阵（B1 必做）

| 用例 | 预期 |
|---|---|
| 聊天页作为根页，`showBack=false` | 无返回箭头；`@back` 不触发；页面不白屏 |
| 聊天页 `showNavBar=false` | 消息区占满；输入栏/键盘/安全区正常；连接条仍可用 |
| init 后不 login 打开聊天页 | <1s 出现“请先登录”，不出现 8 秒骨架；无通用“历史加载失败” |
| 正常 login → 发文本 → 对端回 | 收发正常；未读/已读不回归 |
| 断网重连中打开聊天页 | 不误判未登录；连接条显示重连 |
| 模板 H5 / 微信小程序 | 登录、发文本、返回；mp 主包 ≤1.5MB |
| B2-2 两实例不同 `inputFeatures` | 一个只有文本，一个全开；互不影响；全局 `setConfig` 仍生效 |

### 6.3 真机与真实账号

沿用现有五端矩阵；B1 至少覆盖 Android、iOS、鸿蒙、H5、微信小程序各一次“根页/未登录/正常收发”。未实测端不得在 STATUS 记为已解决。

---

## 7. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| 与 M2.24 / 网络状态改动叠改聊天页 | 冲突、回归难定位 | B1 前先落基线；聊天页改动集中在 props 与错误分支，避开 M2.24 的菜单/下载段 |
| 给 2k 行聊天页加 props | 回归面大 | 只做加法；不改现有默认行为；五端冒烟 + 根页/隐藏导航专项 |
| 模板与产品漂移 | 模板半年后跑不起来 | B1-4 门禁；模板 `package.json` 精确锁 `easemob-websdk@5.1.3`；发版清单包含模板构建 |
| `UNAUTHORIZED` 立即 reject 影响现有宿主 | 登出/切账号瞬间误报 | 仅在 `userId === ''` 时触发；重连（userId 非空）不受影响；补登出流程测试 |
| 页面级配置出现两个真相源 | 宿主困惑 | 明确 `page > global`；不写回 `uiConfig`；文档给优先级表；必要时 dev warning |
| 身份 props 清除误删宿主注入 | 标题头像闪回 | 卸载时做“值仍等于 props”判断；文档说明 props 是初始值 |
| 页面标题/动作插槽影响小程序胶囊 | 双标题/遮挡 | 复用 `em-nav-bar` 既有胶囊避让；只加 `title` prop 与替换式 action 插槽；五端截图 |
| 新增公开文档页触发 manifest/导航 | 门禁失败 | B1-5 只改现有 `PAGES-*`，不新增公开页；内部文档走白名单 |
| 时间不足 | 计划烂尾 | 切线：B3 → B2-2 → B2-1；B0/B1 不砍 |

---

## 8. `PLAN.md` 增补草案（批准后原样并入）

### M2.25：接入体验整改 I——可运行模板、契约默认值与未登录态（2026-10-27 立项，承 `docs/DX-REMEDIATION.md`）

- **背景**：DX 反审（`docs/DX-REVIEW.md`）显示组件完成度高，但接入仍靠手工装配：无 chat-only 起点、身份注入文档教错 API、聊天页无法作为根页、未登录要等 8 秒才报错、默认可见控件未接线即死入口。
- **范围**：①`templates/chat-only/` 可运行模板（登录/会话恢复/聊天页，H5 + 微信小程序分包）与构建门禁；②`em-chat-page` 新增 `showNavBar` / `showBack`；③未登录快速失败：`ERROR_CODE.UNAUTHORIZED` + 聊天页“请先登录”空态 + `unauthorized` 事件；④文档：身份注入统一 `setUserPresentation`、CONFIG 表修复与校验、版本单源、每页“可见控件/事件/必接”接线表、QUICKSTART 接入形态分支。
- **明确不做**：Provider/DI、自动路由、消息类型注册表、PC、新消息类型；不改 `inputFeatures` 的全局语义。
- **门禁**：`build web` + `build mp-weixin` 11 项防回归 + H5 伺服 200 + `check-docs` + `check-skills` + `check-release` + `check-config-docs` + `check-template` + 五端冒烟（根页返回/隐藏导航/未登录/正常收发）。

### M2.26：接入体验整改 II——身份 props、页面级配置与主题 chrome（2026-10-27 立项，目标 1.1）

- **背景**：同一 App 内“社交 + 客服”两种聊天形态无法差异化；业务身份只能靠全局 mutation；H5 主题 chrome 的完整实现只在 demo；页面标题无法覆盖。
- **范围**：①`em-chat-page` 新增 `peerName`/`peerAvatar` props；②新增页面级 `inputFeatures`/`messageMenuKeys` 覆盖（`page > global`，不写回全局）；③`libs/use/useThemeChrome.ts` 收口 H5/App/mp 主题 chrome；④会话/通讯录/群/聊天信息页新增 `title` prop 与 `#nav-action` 插槽；⑤`EmLocaleName` 放宽为可扩展字符串；⑥不可用配置 dev warning；⑦README/插件页/文档首页首屏素材。
- **明确不做**：会话级 `setConfigScope`（先验证页面级需求）、内置气泡渲染接管、RTL、PC。
- **门禁**：`build web` + `build mp-weixin` 11 项防回归 + H5 伺服 200 + `check-docs` + `check-skills` + 五端冒烟（双实例不同配置、标题覆盖、H5 深色 chrome、第三方 locale 编译）。

---

## 9. 需要拍板的四件事

| # | 问题 | 建议 | 影响 |
|---|---|---|---|
| D1 | 1.0 GA 排期是否已锁？ | 若 2 周内发 GA：B0 随 GA 一并发布（仅文档），B1 进 1.0.1；若可延后：B0+B1 进 rc.3 | 决定 B1 是否阻塞 GA |
| D2 | 模板放本仓库 `templates/` 还是独立 starter 仓库？ | 本仓库 `templates/chat-only`，与 `uni_modules` 同版本演进 | 影响 CI 与分发方式 |
| D3 | 页面级配置先做 props 还是 `setConfigScope`？ | 先 props（声明式、易回滚）；有真实会话级需求再做 scope | 影响 B2-2 设计 |
| D4 | 页面头部只加 `title`，还是连 `#nav-action` 一起？ | 1.1 先 `title`；`#nav-action` 待品牌化需求明确 | 影响 B3-2 范围 |

---

## 10. 批准后 48 小时

1. 把 §8 的 M2.25 / M2.26 并入 `PLAN.md`，仓库结构补 `templates/`。
2. B0-1 / B0-2 / B0-3 三条文档改动先落（不碰 `uni_modules/`），跑 `check-docs` + `check-release`。
3. 建 `feat/dx-remediation` 分支；先做 B1-1 / B1-2 两个聊天页改动，并补五端冒烟脚本入口。
4. B1-3 模板起骨架（登录/聊天/配置/README），先跑通 H5，再接 mp 分包。
5. 每完成一条，在 `docs/STATUS.md` 追加“改了什么 + 验证到哪一步”；未实测端写“待验”，不写成已解决。
