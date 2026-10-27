# UIKit 反审：易用性、可用性、通用性

> 审阅对象：`uni_modules/easemob-uikit-uni`（1.0.0-rc.2 工作区）
> 审阅视角：一个拿到插件、**不想通读源码**的宿主开发者，任务只有三种——只搭一个聊天页、搭一套完整 IM、按业务场景改配置。
> 方法：源码走查 + 文档逐条对照 + `scripts/audit-usage.mjs` 的编译域数据；**未做真机与真实账号验证**，结论以静态契约与可复现代码路径为准。
> 性质：接入体验评估，不是功能需求清单。`PLAN.md` 明确不做的能力（PC 宽屏、位置消息、H5 录音等）不计入缺陷。
> 整改计划：[`docs/DX-REMEDIATION.md`](./DX-REMEDIATION.md)。

---

## 0. 一页结论

**组件成熟度明显高于接入成熟度。** 页面组件本身是完成品：骨架屏、空态、失败重试、未读清零、草稿、键盘避让、断线提示、已读回执都在；但“把完成品装进一个工程”仍是一次手工装配，而且装配错了不会报错，只会白屏、死按钮或 8 秒后一句“历史消息加载失败”。

| 维度 | 分数 | 判据 |
|---|---:|---|
| 单一聊天页跑通 | **3.0 / 5** | 能跑，但要 4–7 个文件、约 130 行胶水；没有可运行的“只做聊天页”起点 |
| 组合型项目搭建 | **3.5 / 5** | 7 个页面组件齐全，页面间路由与可见控件全部由宿主接线；默认值按“全量套件”给 |
| 单场景个性化 | **4.0 / 5** | props + 8 个聊天页插槽 + 33 项配置 + 95 个 CSS 变量，足够覆盖客服/医疗/交易 |
| 混合场景配置 | **2.5 / 5** | 配置只有全局单例，没有按页面/会话的作用域；同一 App 里两种聊天形态会互相污染 |
| 通用性（形态/租户/端） | **2.5 / 5** | 整页形态很强；嵌入面板、多租户运行时切换、第三语言、PC 都弱或明确不支持 |
| 文档与排错 | **4.0 / 5** | 覆盖广、有 8 份宿主 Skill、有编译域审计；但入口 IA 偏“完整 IM”，且配置表有实质错误 |
| 运行时 UX 完整度 | **4.5 / 5** | 加载/空/错/重试/未读/草稿/键盘/断线都处理了，超出多数开源 IM UI 的平均线 |

**三句话：**

1. “简单配置”目前只能配置 **L2 全局行为**（输入栏、菜单、主题色、日志）；页面、路由、身份、登录仍在 L0–L1，靠手工装配。
2. 三种形态的成本差异，主要不来自代码量，而来自 **默认值假设**（默认按全量套件给）和 **配置作用域**（只有全局，没有页面/会话级）。
3. 最值得做的不是再加能力，而是三件事：**一个可运行的 starter**、**一张“可见控件 → 必须接线”的契约表**、**按作用域的配置**。

### 0.1 三个不该改的设计

先划清边界，避免把“正确的取舍”当成问题：

1. **路由留在宿主**：页面组件只 `emit`，不替宿主 `navigateTo`。这在 uni-app x 下是对的——业务入口、登录态、页面栈都归宿主；问题只是“没有默认接线”，不是“不该由宿主接线”。
2. **卡片只给插槽**：`sendCustom` + `#custom-message` 不内置 card schema/registry。跨端动态实例化宿主组件本来就不可行，强做会破坏零依赖与五端一致性。
3. **不做 Provider / DI**：uni-app x 每页独立，`EmKit` 单入口 + 页面 props 已经够用；引入 provider 只会增加一层生命周期耦合。

本报告的建议都建立在这三条之上：**补默认实现与契约，不改变分层**。

---

## 1. 度量与口径

### 1.1 静态规模

| 指标 | 数值 | 说明 |
|---|---:|---|
| 页面级组件 | 7 | 会话、聊天、聊天信息、通讯录、好友列表、好友申请、群组 |
| 原子组件 | 28 | 含输入栏、5 类气泡、弹层、导航、空态等 |
| `EmKit` 公开方法 | 82 | 单一入口，按域分组 |
| `EmKitConfig` 字段 | 33 | 全局行为配置 |
| 聊天页 props / slots | 16 / 8 | props 含 `customClass/Style`；slots 含 `title/banner/pinned-bar/empty/custom-message/input-toolbar/input-bar/stream-message` |
| 会话页 props / slots | 8 / 2 | props 含 `customClass/Style`；slots 为 `empty/title-extra` |
| CSS 设计变量 | 95 | `--em-*`，明暗两套 |
| 对外文档 | 29 页（`docs/` 全量 9,792 行） | 行数含内部材料；不含 `reports/`、`.agents/` |
| 宿主 Skill | 8 份 / 约 2,300 行 | 分发给接入方 AI，是本项目相对同类 UIKit 的差异化资产 |
| 聊天页源码 | 1,981 行 / 约 91 KB | 单体页面组件；`GUIDE-ON-DEMAND.md` 记录其静态带入 22 个组件 |

### 1.2 三条路径的成本

| 形态 | 宿主需要创建/修改 | 胶水代码 | 外部依赖 | 主要卡点 |
|---|---|---|---:|---|
| 只做聊天页 | `pages.json`、`App.uvue`、`chat.uvue`、`login.uvue`、`manifest.json`（深色再加 `theme.json`） | ≈ 120–150 行 | token 签发接口 | A1–A5 |
| 完整 IM | 上述 + 会话/通讯录/好友列表/好友申请/群组/聊天信息 6 个页面 + tabBar + 主题 chrome | demo 宿主侧核心页约 1.7k 行；最小组合约 500–800 行 | token 接口 | B1–B4 |
| 业务场景 | 上述之一 + 卡片组件 + `#banner` / `#input-toolbar` + 资料注入 + CSS 覆盖 | 每场景 100–300 行 | token + 业务接口 | C1–C3 |

> 注：demo 聊天页 714 行主要是场景实验室的演示逻辑；一个真实的单聊页约 50 行，这个对比本身就说明“宿主侧代码量”不是 UIKit 的问题。

---

## 2. 场景 A：只搭一个聊天页

### 2.1 实际要做的事

| # | 动作 | 落在哪 | 谁提供 |
|---|---|---|---|
| 1 | 安装 `easemob-websdk@5.1.3`，放入 `uni_modules/easemob-uikit-uni` | `package.json` / 目录 | 宿主 |
| 2 | 配页面组件 easycom 规则 | `pages.json` | 宿主（魔法正则） |
| 3 | 声明聊天页并关闭原生导航 | `pages.json` | 宿主 |
| 4 | `initTheme()` + `EmKit.init({ appkey, token 回调 })` | `App.uvue` | 宿主 |
| 5 | 登录页：服务端换 token → `EmKit.login` | `login.uvue` | **宿主从零写**（UIKit 无登录页组件） |
| 6 | 聊天页壳：解参、登录守卫、`themeClass`、高度链、CSS import | `chat.uvue` | 宿主（≈50 行） |
| 7 | 对端昵称/头像注入 | 任意（`setUserPresentation`） | 宿主 |
| 8 | 业务入口路由 | 业务页 | 宿主 |
| 9 | 微信小程序 SDK 分包 + prepare 脚本（若目标含 mp） | `pages.json` / 构建 | 宿主 |

**UIKit 在第 6 步里贡献的是一个标签。** 其余八步都是“必须知道才会做对”的工程约定。

### 2.2 A1｜没有可运行的“只做聊天页”起点（P0）

- `demo/` 是完整应用：登录、会话、通讯录、我的、6 个场景实验室、样式实验室、诊断页，共 22 个页面。想只要一个聊天页的人，面对的是一个需要反向裁剪的完整 App。
- 仓库里确实有一个“最小宿主”：`scripts/fixtures/minimal-host/`。但它的 README 明写 **“不参与编译、不可运行”**，而且 `sub-im/pages/chat/chat.uvue` 里 `const ctype = ref(0)`，与组件要求的 `ConversationTypeValue`（`'singleChat' | 'groupChat'`）类型不符——它没有被编译过，所以错了也没人发现。
- `docs/QUICKSTART.md` 的主线是“登录 → 会话列表 → 聊天页”；“不需要会话列表、业务页直进”被放在 `GUIDE-MULTI-SCENARIO.md` 和 `CONCEPTS.md §7.2`，而这两页从标题看都不像“单一聊天页”的入口。

**影响**：目标用户（只需要一个聊天页的业务方）会先读到一条更长的路径，然后自己删；删错一个 easycom 或高度链就白屏。  
**建议**：提供 `templates/chat-only/`（可编译、含登录/会话恢复/聊天页/README），CI 对 web + mp-weixin 各构建一次；或至少在 QUICKSTART 第 5 节后加一个“只要聊天页？从这里开始”的分支，指向同一份可运行代码。

### 2.3 A2｜对端身份不是 prop，且文档教了会被覆盖的 API（P0）

这是本次审阅里最实在的一个坑。

- `em-chat-page` 只有 `title` prop / `#title` 插槽能改标题区域；气泡头像/群昵称走的是 `userStore` 的回落链，不是 props。
- 想显示“在线客服”“张医生（皮肤科）”这类业务身份，正确入口是 `EmKit.setUserPresentation(userId, { nickname, avatarUrl })`——它写入 `overrideByUserId`，在回落链最前，SDK 资料回推不会冲掉（`libs/store/user.ts:28-56`）。
- 但 `docs/GUIDE-MULTI-SCENARIO.md:378-381` 与 `skills/em-host-business-extension/SKILL.md:40,293-295` 教的都是 `mergeUserInfo`。它写的是 SDK 资料缓存 `infoByUserId`（`libs/store/user.ts:16-25`）；首次因为“已缓存就跳过”往往看起来有效，但 `onUserInfoUpdated`、联系人/群成员同步会把同一用户的资料再 merge 一次，把“在线客服”覆盖成真实昵称（`libs/chat/user-info.ts:33-58`）。`setUserPresentation` 写的是独立 override 层，才不会被冲掉。
- 同一页文档的 §5.6 用 `mergeUserInfo`、§5.7 用 `setUserPresentation`，没有解释两者差异；读者很容易只抄前者。

**影响**：客服/医疗/招聘这类“对端是业务身份而非自然人”的场景，标题或头像会在 SDK 同步后静默回退。正好打在“个性化场景”这个目标上。  
**建议**：公开文档与 Skill 统一改用 `setUserPresentation`；`mergeUserInfo` 在公开导出层标注“SDK 资料缓存，会被同步覆盖，业务注入请用 `setUserPresentation`”；在 `GUIDE-MULTI-SCENARIO` 加一张“两种注入的优先级/生命周期”对照表。

### 2.4 A3｜聊天页不能作为根页，也不能嵌进业务页（P1）

- 聊天页固定渲染 `em-nav-bar`，**没有 `show-nav-bar` 或 `show-back` prop**；`em-nav-bar` 自身有 `showBack`，但聊天页没透出（`em-chat-page.vue:8-12`、`em-nav-bar.vue` props）。
- `autoBack=false` 只阻止组件内部 `navigateBack`，**不会隐藏返回箭头**。当聊天页是应用根页（客服小程序首屏、扫码直达会话）时，箭头在，点了没反应——因为页面栈里没有上一页。
- `em-nav-bar` 设了 `styleIsolation: 'app-and-page'`，宿主页面的 CSS 也进不去，无法用 `custom-class` 把箭头藏掉。
- 同理，页面根节点是 `flex: 1`（`em-chat-page.css:4-8`），没有“面板/半屏/嵌入”形态；想在商品详情页下半屏嵌一段聊天，只能自绘或改库。

**影响**：A 场景最常见的两个变体——“聊天页即首页”和“聊天作为业务页的一块”——都不在支持范围内，而文档没有明确说“不支持”。  
**建议**：`em-chat-page` 透出 `showNavBar` / `showBack`（透传到 `em-nav-bar`）；或在 `PAGES-CHAT.md` 明确写“仅整页形态，嵌入请用原子组件”，并给一个 `#nav` 自定义头部的替代方案。

### 2.5 A4｜白屏三件套由宿主承担（P2，但发生频率最高）

`QUICKSTART.md §3.3` 把“根节点 `height:100%` + flex 链 + `scroll-view` 的 `flex:1;height:0`”列为白屏头号原因。事实确实如此，但这是**页面级组件本可以自己兜住的事**：

- 聊天页根节点是 `display:flex; flex-direction:column; flex:1`，没有高度；父级不给高度就塌成 0。
- 同一页还要记得 `themeClass` 和 `@import variables.css`（宿主自定义区/背景色需要变量；组件自身样式已自带 import）。
- 这三件事没有任何运行时提示，错了就是白屏或半屏。

**建议**：短期在组件根节点补 `min-height: 100%` 或 `height: 100%` 的兜底（需评估嵌套场景），长期提供 `em-page` 壳组件或 `useImPage()` 组合式，把 themeClass + 高度 + token import 收口；至少在白屏时输出一条 dev 警告。

### 2.6 A5｜登录态与会话恢复没有方案（P1）

- UIKit 不提供登录页组件，这可以接受（品牌差异大）；但也没有“冷启动恢复登录”的推荐实现。文档只覆盖“登录成功后 `reLaunch`”。
- demo 的登录页把 `appkey/userId/token` 明文写 `uni.setStorage`（`demo/pages/login/login.uvue:188-190`），并在 `onLoad` 回填。这是开发便利，不是可照抄的生产方案；文档虽然警告“不要明文存 token”，但没有给出替代路径。
- 更关键的是**漏写登录守卫时的失败形态**：聊天页 `loadHistory` 会经 `readyChatManager()` → `waitOnline()` 等 **8 秒**（`libs/client/index.ts:308-323`）才超时，然后弹“历史消息加载失败”，而不是“请先登录”。如果连 `EmKit.init` 都没调，则是 `call EmKit.init() first`，同样被折叠成同一条 toast。

**影响**：新宿主按模板搭完、忘了守卫，会看到 8 秒骨架 + 一句误导性的网络错误，很难定位。  
**建议**：`readyChatManager` 在 `connectionStore.userId === ''` 时立即 reject 一个可识别的 `ERROR_CODE.UNAUTHORIZED`；聊天页对该错误渲染“请先登录”空态并 emit `unauthorized`；文档补“冷启动恢复登录”一节（含安全存储建议）。

### 2.7 场景 A 评价

**能做到，但这不是“配置”，是“按菜谱装配”。** 一个熟悉 uni-app x 的开发者约 1–2 小时能跑通（token 接口现成）；不熟悉蒸汽模式的人会先卡在环境与白屏。最耗时的不是写聊天页，而是补齐 UIKit 没有提供的登录、身份、守卫三块。

---

## 3. 场景 B：组合型项目

### 3.1 页面组件齐全，但“接线”是另一份工作

7 个页面组件都带完整交互与状态，问题在于**页面组件不是路由组件**：所有跨页动作都以事件透出，宿主不接就是死按钮。

| 页面 | 可见控件 | 宿主必须处理 | 不处理的后果 |
|---|---|---|---|
| 会话列表 | 右上「+」→ 发起单聊 | `@select`（组件已 `addConversation`） | 选完人没反应 |
| 会话列表 | 右上「+」→ 创建群组 | `@menu('create-group')` | 菜单项点了没反应 |
| 会话列表 | 条目点击 | `@select` + 跳聊天页 | 点了没反应 |
| 聊天 | 右上「…」 | `@open-info` + 跳聊天信息页 | 点了没反应 |
| 聊天 | 返回 | `autoBack`（默认 true） | 根页时箭头无效 |
| 通讯录 | 右上「+」 | `@add` | 点了没反应 |
| 通讯录 | 新请求/群组/好友列表行 | `@entry-click` | 点了没反应 |
| 聊天信息 | 成员「发消息」 | `@chat-member` + `addConversation` + 跳转 | 点了没反应 |
| 聊天信息 | 删除会话 / 退群 / 删好友 | `@deleted` / `@leaved` / `@contact-deleted` + 退场 | 操作成功但页面停留 |
| 群组 | 建群成功 / 群条目点击 | `@created` / `@click-group` + 跳转 | 建完群停在原地 |
| 好友列表 | 条目点击 | `@select` + 跳转 | 点了没反应 |

这些不是 bug——路由留给宿主是 uni-app x 下正确的选择。问题是**没有一张“接线地图”**，也没有默认处理器；Skill 里零散提到，但宿主需要自己拼。

**建议**：在 `PAGES-*` 每页顶部加“可见控件 / 事件 / 必接 / 不接的后果”四列表；或提供 `useImRouter()` 默认实现（`select` → 聊天页、`open-info` → 信息页…），宿主可覆盖。

### 3.2 默认值按“全量套件”给（P1）

- 聊天页 `showAction` 默认 `true`，指向 `@open-info`；只做聊天页、不做信息页的人，右上角会有一个死入口。
- 会话页「+」菜单里“创建群组”永远在；宿主没接群组页时，它是死项。
- 通讯录右上「+」永远在；宿主没做添加好友弹层时，它是死项。
- 聊天信息页的“发消息”、群组页的“建群”同理。

**根因**：组件无法知道宿主接了哪些页面，默认值只能按 demo 的“全量套件”给。  
**建议**：短期在文档/Skill 的“最小接入”配方里显式写 `:show-action="false"`、说明“+ 菜单需要接 `menu`”；中期给页面组件加能力裁剪 props（如 `actions: []` / `entries: []`），让默认值与宿主接线一致。

### 3.3 配置分散在 6 个地方（P1）

“简单配置”在组合型项目里会变成“改六个文件”：

| 位置 | 配什么 | 漏了会怎样 |
|---|---|---|
| `pages.json` | easycom、页面、分包、tabBar、`navigationStyle` | 组件解析不到 / 双导航栏 |
| `theme.json` + `manifest.json` | 原生 nav/tab 明暗首帧、`darkmode` | 深色下首帧白条 |
| `App.uvue` | `initTheme` + `EmKit.init` | 主题不跟随 / `call EmKit.init() first` |
| 每个页面根节点 | `themeClass`、`height:100%`、`@import variables.css` | 深色背景不对 / 白屏 |
| 每个页面 `onShow` | `syncNativeThemeUI()` | 原生导航栏/ tabBar 不跟随 |
| `demo/common/theme.ts`（仅 demo） | H5 的 `.uni-page-head` / `.uni-tabbar` DOM 同步 | H5 深色 tabBar 不换色 |

其中最后一项最典型：H5 没有 `setNavigationBarColor`，demo 用几十行 DOM 直写补上了，但这段代码不在 `libs` 里，文档只说“H5 的页面 chrome 由宿主 CSS 处理”。也就是说，**最完整的主题接线只存在于 demo，不在产品里**。

**建议**：把 `useDemoTheme` 里的 H5 chrome 同步提升为 `libs/use/useThemeChrome`（或 `syncThemeChrome`），文档补一段“H5 深色三件套”；在 `THEME-I18N.md` 顶部加一张“改主题要动哪几处”的总表。

### 3.4 小程序是“两件分包”，认知负担高（P1）

页面分包（`sub-im`）与 SDK 分包（`sub-sdk`）是两件事，文档已经明确提醒，但仍需要：声明分包、`preloadRule`、构建后跑 `prepare-sdk-subpackage.mjs`、主包 ≤1.5MB。任何一个漏了，报错是 `module 'sub-sdk/im-sdk.js' is not defined`，对新手不直观。

这不是设计问题，是平台复杂度；但可以在 `templates/*` 里预置好，让宿主只改 `appkey`。

### 3.5 场景 B 评价

**组件够全，接线够多。** 一个完整 IM 的页面能力已经超过多数开源方案；真正的工作量在路由、tabBar、主题 chrome、小程序分包这四件事上。它们都有文档，但没有“一次做对”的默认实现。

---

## 4. 场景 C：特别场景个性化

### 4.1 配置金字塔

| 层 | 载体 | 例子 | 作用域 | 谁维护 |
|---|---|---|---|---|
| L0 工程/路由 | `pages.json`、`manifest.json`、`theme.json` | easycom、`navigationStyle`、分包、tabBar | 应用 | 宿主手工 |
| L1 生命周期 | `App.uvue` | `initTheme`、`EmKit.init` | 进程 | 宿主代码 |
| L2 全局行为 | `EmKitConfig`（33 项） | `inputFeatures`、`messageMenuKeys`、`primaryColor`、`enableTyping` | **全局单例** | 宿主代码 |
| L3 页面实例 | 页面 props（聊天 16 / 会话 8 / …） | `title`、`showAction`、`quickReplies`、`extraMessageMenus` | 页面 | 模板 |
| L4 插槽/事件 | 聊天页 8 个 slot | `#banner`、`#custom-message`、`#input-toolbar`、`#input-bar` | 页面 | 宿主组件 |
| L5 视觉令牌 | 95 个 `--em-*` | `--em-bubble-bg-self`、`--em-primary-color` | 页面/子树 | CSS |

**缺口在 L2 与 L3 之间**：没有“某个页面/某个会话使用哪套行为”的作用域。L2 是全局响应式对象，`setConfig()` 会立即影响所有已挂载页面。

### 4.2 能做的（覆盖面很好）

- 输入栏工具裁剪、单/多行模式、菜单项与顺序、emoji 集、撤回窗口、typing 节流、时间分隔、流式合批、发送状态呈现。
- 快捷回复、业务长按动作、整卡自定义消息、AI 流式气泡、输入栏整栏自绘。
- 标题覆盖、详情入口显隐、群公告/成员数/昵称行/@ 提及开关、头像形状。
- 业务 ext、`sendCustom`、本地系统提示、单会话未读、对端/会话/群资料注入。
- 明暗主题、品牌色、中英文、CSS 变量覆盖。

对“客服 / 医疗 / 招聘 / 二手交易”四类单场景，这套配置 + 插槽基本够用，`GUIDE-MULTI-SCENARIO.md §7` 的四张配方表也写得清楚。

### 4.3 三个硬边界

**C1｜同一 App 里不能有两种聊天形态（P1）**  
C 端社交 + 客服入口在同一个 App 里很常见：社交要语音/视频/表情，客服只要文本/图片/快捷话术。当前只能：
- 全局 `setConfig` 后所有会话一起变；或
- 在页面 `onShow` 里 `setConfig`、`onHide` 再改回——依赖页面生命周期顺序，脆弱且没文档。

**建议**：聊天页加 `input-features` / `message-menu-keys` 等 props（缺省回落全局），或提供 `setConfigScope(conversationId, patch)` 的轻量作用域。

**C2｜内置气泡不可替换（P2，设计选择）**  
`#custom-message` 只覆盖 custom 消息，文本/图片/语音/视频/文件气泡不能按类型接管渲染；要改只能 CSS 覆盖或改库。对“只要换一种文本气泡样式”的需求，CSS 变量通常够；对“文本消息要渲染成富文本卡片”的需求，不够。  
**建议**：不强推注册表（会破坏零依赖与跨端）；在文档明确“内置类型只能 CSS/token 定制，结构定制请用 `sendCustom`”。

**C3｜第三语言受类型限制（P2）**  
`EmLocaleName` 是 `'zh-CN' | 'en'`，`mergeMessages` 的签名也只接受这两个值。运行时虽然能挂新 locale，但 TypeScript 层要绕过。  
**建议**：把 `EmLocaleName` 放宽为 `string`（保留内置常量），文档补“新增语言 = 复制一份词条 + `mergeMessages` + `setLocale`”；同时说明暂无 RTL。

### 4.4 文档里两个具体的坑

1. **`docs/CONFIG.md:32-36` 的配置表错位**：`showReadStatus` 与 `enableGroupReadReceipt` 两行没有说明；`messageStatus` 行却写着“单聊已读态图标显隐”（这是 `showReadStatus` 的说明）；`enableGroupReadReceipt` 重复出现两次。想看“怎么打开已读对勾”的人，会读到一个讲 `messageStatus` 的行。建议用类型生成配置表，或至少修表并加一条文档测试。
2. **版本口径漂移**：`AGENTS.md:8` 写 `1.0.0-rc.1`，`docs/QUICKSTART.md:4` 与包元数据是 `rc.2`，`skills/em-host-integration/SKILL.md:8` 又写 `rc.1`。Skill 是分发给宿主 AI 的，版本基线不一致会让 AI 按旧契约生成代码。

### 4.5 场景 C 评价

**单场景够用，混合场景受限。** 定制的“入口”很多（props/插槽/配置/token/i18n），但作用域只有全局与页面两级；身份注入又是全局 mutation 而非 prop。对“一个 App 一种 IM 形态”的项目，体验是 4 分；对“一个 App 多种 IM 形态”的项目，是 2.5 分。

---

## 5. 通用性压力测试

| 形态 | 支持 | 说明 |
|---|---|---|
| 独立 IM App（含 tabBar） | ✅ | demo 即参考；页面齐全 |
| App 内消息中心 | ✅ | 页面组件可放 tab；但 header 是组件自带的 |
| 业务页直进单聊 | ✅ | `em-chat-page` 路由无关；需宿主补守卫与身份 |
| 聊天页作为根页 | ⚠️ | 返回箭头无法隐藏；`autoBack` 只改行为 |
| 聊天嵌入半屏/弹窗/侧栏 | ❌ | 页面组件只有整页形态，nav bar 不可关 |
| 只取数据层自绘 | ✅ | `EmKit` + 响应式 store |
| 只取原子组件 | ✅ | 深路径导入，可不引 `libs` 全量 |
| 多租户/多 appkey 运行时切换 | ❌ | `init()` 每进程一次，appkey 固定，无 `destroy()`；只能重启进程 |
| 多账号同时在线 | ❌ | 单 SDK/单 Kit 实例 |
| 客服工作台/PC 宽屏 | ❌ | 明确只做移动端 |
| 自定义消息类型 | ✅ | `sendCustom` + `#custom-message` |
| 替换内置气泡结构 | ❌ | 只能 CSS/token |
| 第三语言 / RTL | ⚠️ / ❌ | 类型限 zh/en；无 RTL 支持 |
| 主题/品牌 | ✅ | 95 token + `primaryColor`；多品牌需宿主管理变量作用域 |
| 升级 | ✅ | `uni_modules` 覆盖；配置与 token 相对稳定 |

**结论**：这套 UIKit 的“通用性”是**纵向的**——同一套页面在五个端、四种业务场景里复用得很好；不是**横向的**——同一套代码很难同时服务“完整 IM”“嵌入式聊天”“多租户 SaaS”三种产品形态。前者是当前目标，后者是下一阶段要想清楚的。

---

## 6. 问题清单

> 级别：P0 = 直接破坏目标形态或产生错误行为；P1 = 显著摩擦、需要绕行；P2 = 打磨项。

| ID | 级别 | 问题 | 证据 | 影响 | 建议 | 量级 |
|---|---|---|---|---|---|---|
| U-01 | P0 | 没有可运行的“只做聊天页”起点 | `scripts/fixtures/minimal-host/README.md`（不可运行）；`minimal-host/sub-im/pages/chat/chat.uvue` 的 `chatType` 类型错误；demo 为 22 页完整应用 | 目标用户先读长路径、再手工裁剪，白屏率高 | `templates/chat-only/` + CI 构建 + QUICKSTART 分支 | 2–3 人日 |
| U-02 | P0 | 文档/Skill 教 `mergeUserInfo` 注入业务身份，会被 SDK 资料覆盖 | `GUIDE-MULTI-SCENARIO.md:378-381`、`skills/em-host-business-extension/SKILL.md:40,293-295`；`libs/store/user.ts:16-56`；`libs/chat/user-info.ts:33-58` | 客服/医生标题头像静默回退 | 统一改 `setUserPresentation`；公开层标注 `mergeUserInfo` 的覆盖风险 | 0.5 人日 |
| U-03 | P1 | 聊天页不能隐藏导航/返回，不能嵌入 | `em-chat-page.vue:8-12`、props 列表；`em-nav-bar.vue` 有 `showBack` 但未透出；`styleIsolation: 'app-and-page'` | 聊天页做根页时箭头无效；无法嵌业务页 | 透出 `showNavBar`/`showBack`；文档明确整页边界 | 0.5 人日 |
| U-04 | P1 | 默认值按全量套件给，未接线即死按钮 | 聊天页 `showAction` 默认 true；会话页 `create-group` 只 emit；通讯录 `+` 只 emit；聊天信息 `chat-member` 只 emit | 半接线项目出现死入口 | 能力裁剪 props + “可见控件/事件/后果”接线表 | 1 人日 |
| U-05 | P1 | 配置只有全局单例，无页面/会话作用域 | `libs/store/config.ts` 单一 `uiConfig`；聊天页 props 无 `inputFeatures`/`messageMenuKeys` | 混合型 App 无法差异化 | 页面 props 覆盖 + 轻量 `scope` 机制 | 2 人日 |
| U-06 | P1 | 主题配置分散 6 处；H5 chrome 同步只在 demo | `THEME-I18N.md:90-116`；`demo/common/theme.ts`（`syncH5Chrome` 未进 `libs`） | 深色首帧/返回后 chrome 不一致 | `useThemeChrome` 进 `libs`；补“改主题动哪几处”总表 | 0.5–1 人日 |
| U-07 | P1 | 无登录页/会话恢复方案；漏守卫时 8 秒后才报“历史加载失败” | `libs/client/index.ts:308-323`；`libs/chat/message.ts:493-500`；`chat-page.vue:1055-1080` 统一 toast | 新宿主误判为网络问题 | `UNAUTHORIZED` 错误码 + “请先登录”空态 + 冷启动文档 | 1 人日 |
| U-08 | P1 | 对端身份不是 prop，必须全局 mutation | 聊天页仅 `title`；头像/昵称走 `userStore` | 业务身份注入顺序敏感、需手动清理 | `peer-name`/`peer-avatar` props（内部调 `setUserPresentation`） | 0.5 人日 |
| U-09 | P2 | 会话/通讯录/群/聊天信息的 header 不可定制 | 四页 `em-nav-bar` 标题写死 i18n，无 slot/prop | 品牌化只能自绘或改库 | 统一 `#nav` / `show-nav-bar`；或文档给自绘方案 | 2 人日 |
| U-10 | P2 | 白屏三件套由宿主承担 | `QUICKSTART.md §3.3`；`em-chat-page.css:4-8` | 最高频接入故障 | 组件高度兜底 + dev 警告 + `em-page` 壳 | 1 人日 |
| U-11 | P2 | 文档配置表错位、版本口径漂移、类型注释过期 | `CONFIG.md:32-36`；`AGENTS.md:8` vs `QUICKSTART.md:4` vs `skills/em-host-integration/SKILL.md:8`；`libs/types/index.ts:197` “四项” | 读者按错表配置；AI 按旧版本生成 | 修表；配置表由类型生成；统一版本基线 | 0.5 人日 |
| U-12 | P2 | README / 插件 readme / 文档首页零截图 | 三处 `![` 计数均为 0 | 插件市场首屏无视觉证据 | 首页 hero + 3 张场景图/GIF | 0.5 人日 |
| U-13 | P2 | 第三语言受 `EmLocaleName` 类型限制 | `libs/use/useLocale.ts:31-33`；`mergeMessages` 签名 | 海外项目需绕过类型 | 放宽为 `string` + 文档 | 0.5 人日 |
| U-14 | P2 | 配置项在端上不可用时静默失效 | H5 语音入口隐藏；App 文件入口依赖 provider（`CONFIG.md §5`） | `inputFeatures.voice=true` 但没入口，误判为 bug | dev 模式 warning + `capabilities` 查询示例 | 0.5 人日 |
| U-15 | P2 | 运行时细节：无“以下为新消息”分隔、聊天内无搜索、无无障碍/字号缩放 | `em-chat-page.vue` 无 unread divider/search；`variables.css:28` 注明不做缩放 | 长会话/适老场景体验 | 按优先级排期，非 1.0 阻塞 | — |

---

## 7. 建议路线

### 7.1 1.0 之前（低成本、直接改善“简单配置”叙事）

1. **`templates/chat-only/` + CI**（U-01）：包含 `pages.json`、`App.uvue`、`login.uvue`、`chat.uvue`、README；web + mp-weixin 各构建一次。这是投入产出比最高的一项。
2. **修身份注入**（U-02）：文档 + Skill 统一 `setUserPresentation`；`mergeUserInfo` 降级为内部/SDK 缓存语义。
3. **修配置表与版本口径**（U-11）：`CONFIG.md` 的 `showReadStatus`/`messageStatus`/`enableGroupReadReceipt` 三行；`AGENTS`/`QUICKSTART`/Skill 的 rc 版本对齐。
4. **聊天页导航开关**（U-03）：`showNavBar`/`showBack` 两个 prop，成本极低，直接解锁“聊天页即首页”。
5. **未登录快速失败**（U-07）：`UNAUTHORIZED` + “请先登录”空态，避免 8 秒误导。
6. **接线地图**（U-04）：一页表格，按页面列“可见控件 / 事件 / 必接 / 不接的后果”。
7. **首屏截图**（U-12）：README、插件 readme、文档首页各一张主图 + 一张场景图。

### 7.2 1.1（结构性，先想清楚再做）

- **按作用域配置**（U-05）：页面 props 覆盖 → 会话级 scope。不要一上来做 provider/DI，uni-app x 的页面模型不支持，也会破坏零依赖。
- **页面头部可定制**（U-09）：`#nav` 插槽或 `show-nav-bar`，让页面组件能嵌进品牌化宿主。
- **身份 props**（U-08）：`peer-name`/`peer-avatar`，把最常见的定制从全局 mutation 拉回声明式。
- **主题 chrome 收口**（U-06）：`useThemeChrome` 进 `libs`，H5/App/mp 一套。
- **语言类型放宽**（U-13）。
- **默认能力裁剪**（U-04 的组件侧）：`actions` / `entries` props，让默认值与接线一致。

### 7.3 不建议做（避免过度设计）

- **Provider / 依赖注入 / 全局插件安装**：uni-app x 每页独立，收益低、侵入大；保持 `EmKit` 单入口 + 页面 props 更符合当前架构。
- **消息类型注册表 / 卡片 schema**：`sendCustom` + 插槽已经够用，内置 schema 会拖垮跨端与零依赖。
- **自动路由**：页面组件替宿主 `navigateTo` 会锁死业务入口；正确做法是提供默认 handler，而不是替宿主决策。
- **PC 宽屏 / 多窗口**：与当前移动端定位冲突，等有明确产品需求再做。

---

## 8. 附录 A：单一聊天页模板（可直接用）

> 这是按当前 API 写的“最小正确形态”：不依赖会话列表、不做信息页、登录守卫 + 业务身份注入 + 根页返回兜底。宿主只需替换 `peerName/peerAvatar` 与登录页路由。

```vue
<!-- pages/chat/chat.uvue -->
<template>
  <view class="chat-page" :class="themeClass">
    <em-chat-page
      v-if="conversationId !== ''"
      :conversation-id="conversationId"
      :chat-type="CONVERSATION_TYPE.SINGLE_CHAT"
      :title="peerName"
      :show-action="false"
      :auto-back="false"
      @back="onBack"
    />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import {
  CONVERSATION_TYPE,
  EmKit,
  setUserPresentation,
  useTheme
} from '@/uni_modules/easemob-uikit-uni/libs'

const { themeClass } = useTheme()
const conversationId = ref('')
const peerName = ref('在线客服')
const canBack = ref(false)

onLoad((query) => {
  if (EmKit.state.userId === '') {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  conversationId.value = (query?.['conversationId'] ?? '') as string
  peerName.value = (query?.['peerName'] ?? '在线客服') as string
  // 业务身份用 setUserPresentation，不要用 mergeUserInfo：后者会被 SDK 资料覆盖
  setUserPresentation(conversationId.value, {
    nickname: peerName.value,
    avatarUrl: (query?.['peerAvatar'] ?? '') as string
  })
  canBack.value = getCurrentPages().length > 1
})

function onBack(): void {
  if (canBack.value) {
    uni.navigateBack({ delta: 1 })
  } else {
    uni.reLaunch({ url: '/pages/index/index' })
  }
}
</script>

<style>
@import '@/uni_modules/easemob-uikit-uni/libs/style/variables.css';

.chat-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background-color: var(--em-chat-bg);
}
</style>
```

`pages.json` 只多两条：

```json
{
  "easycom": {
    "autoscan": true,
    "custom": {
      "^em-([a-z-]+)-page$": "@/uni_modules/easemob-uikit-uni/components/pages/em-$1-page/em-$1-page.vue"
    }
  },
  "pages": [
    {
      "path": "pages/chat/chat",
      "style": { "navigationStyle": "custom" }
    }
  ]
}
```

**已知限制**（模板无法绕过，需要 UIKit 补 prop）：根页场景下返回箭头仍然可见但不可点；要彻底隐藏，需要 `showBack`/`showNavBar`。模板里的 `/pages/index/index` 与 `/pages/login/login` 需换宿主实际路由；离开时是否清除 `setUserPresentation`（传 `null`）由业务决定——客服身份通常保留，个人资料注入建议清理。

---

## 9. 附录 B：接入检查清单

### A · 只做聊天页

- [ ] `easemob-websdk` 精确 5.1.3；插件在 `uni_modules/`
- [ ] `pages.json` 有页面 easycom 规则 + `navigationStyle: custom`
- [ ] `App.uvue` 调 `initTheme()` + `EmKit.init()`
- [ ] 登录页拿到服务端 token 后 `EmKit.login`
- [ ] 聊天页根节点 `height:100%` + flex + `themeClass`
- [ ] 进入前用 `EmKit.state.userId === ''` 判断，而不是 `status !== 'online'`
- [ ] 业务身份用 `setUserPresentation`，不用 `mergeUserInfo`
- [ ] 不需要详情页时传 `:show-action="false"`
- [ ] 聊天页是根页时处理 `@back`，并接受“箭头仍可见”的现状
- [ ] 需要冷启动保持登录时，自行实现 token 安全存储与恢复

### B · 完整 IM

- [ ] 上述全部
- [ ] 7 个页面组件的 `select/open-info/menu/entry-click/chat-member/created/...` 全部接线
- [ ] tabBar 角标：`useTabBarBadge` + 每个 tab 页在 `onShow` 调 `tabBarBadge.sync()`
- [ ] 会话页 `onShow` 补 `syncConversations()`
- [ ] 深色：`theme.json` + `manifest.darkmode` + 每页 `syncNativeThemeUI()`（H5 另需 chrome 同步）
- [ ] 小程序：页面分包 + SDK 分包 + `preloadRule` + `prepare-sdk-subpackage.mjs`
- [ ] App：相机/麦克风/相册权限、iOS privacyDescription、`uni-video` 模块

### C · 业务场景

- [ ] 选好配方：`title` / `showAction` / `#banner` / `quickReplies` / `extraMessageMenus`
- [ ] 卡片：`sendCustom(event, params, ext)` + `#custom-message` 按 `customEvent` / `rawType` 分发
- [ ] 身份：`setUserPresentation`（对端）/ `setConversationPresentation` / `setGroupPresentation`
- [ ] 业务 ext 不占用 `msgQuote` / `emQuote` / `em_at_list`
- [ ] 混合形态：确认能否接受全局 `setConfig`；不能则等页面级配置
- [ ] 多语言：当前只有 zh/en；新增语言需绕过 `EmLocaleName`
- [ ] AI 流式：`#stream-message` + `onStreamMessage` 订阅要反注册

---

## 10. 边界说明

- 本报告不评价功能是否“该有”。`PLAN.md` 明确砍掉的能力（PC、位置消息、H5 录音、文件打开等）不作为缺陷。
- 未做真机/真实账号验证；U-07 的 8 秒行为由 `waitOnline(8000)` 代码路径推导，U-02 的覆盖行为由 `mergeUserInfo` 与 `ensureUserInfos` 的调用链推导。
- 分数是相对分，不是绝对分：以“同类 uni-app x IM UI 组件”为参照，不是以“成熟商业 IM SDK + 全套脚手架”为参照。
- 本文件为内部材料，已列入 `scripts/check-docs.mjs` 的内部白名单，不进入 `docs/docs.manifest.mjs` 的公开 entries。
