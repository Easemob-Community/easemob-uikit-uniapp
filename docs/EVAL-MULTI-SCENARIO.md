# EVAL-MULTI-SCENARIO.md — 多场景易用性与扩展支持能力评估（2026-10-15）

> 评估对象：`uni_modules/easemob-uikit-uni`（截至 M2.8，M2.9 群基础已立项未落地）。
> 前提：**H5 移动端交互形态**，暂不考虑 PC Web 形态。
> 性质：评估结论 + 缺口清单 + 落地路线建议，**作为后续立项依据**；实施时须先改 `PLAN.md` 再动代码（AGENTS.md 硬约束 1）。
> 关联：客服单场景初评见会话计划稿；本文为其扩展与定稿。
> **落地状态（2026-10-20）**：P0-1 ~ P0-4 已按 `PLAN.md` M2.11 落地（发送侧 ext/sendCustom、`#banner`、`title`/`showAction`、本地系统提示消息）；P1-1 ~ P1-3 已按 `PLAN.md` M2.12 落地（单会话未读 API、快捷回复条、自定义长按菜单动作）。M2.9 群基础亦已完成，路线 B 的群能力不再阻塞（伪装 UI 开关仍待批次）。详见 §7。

## 1. 共同底座：四场景共享的接入模型

客服、医疗、招聘、二手交易四场景本质同一模型：**业务页面放入口按钮 → 直进 1v1 聊天页**（对端 = 客服/医生/HR/卖家 userId），不需要会话列表页。

底座现状：`em-chat-page` 已是路由无关的页面级组件，唯一必填输入为 `conversationId` prop（单聊 = 对端 userId）；demo 的 `demo/sub-im/pages/chat/chat.uvue` 即为 ~20 行薄包装页，证明「宿主自建页面 + 单组件引入」链路可用。宿主接入序列：`EmKit.init(config)` → `EmKit.login({appkey, userId, token})` → `uni.navigateTo` 到含 `em-chat-page` 的自建页面。

| 底座能力 | 现状 | 依据 |
|---|---|---|
| 单页直进聊天（路由无关，back 走 navigateBack） | ✅ | `components/pages/em-chat-page/em-chat-page.vue:180` |
| 文本/图片/文件收发、撤回、重发、引用、已读回执、typing | ✅ | `docs/STATUS.md` M1–M2.8 基线 |
| 空会话直接进线（无历史也能聊） | ✅ | `em-chat-page.vue` `#empty` 默认空态；`libs/chat/conversation.ts` enterConversation 无害 |
| 对端资料注入（不等 SDK 同步，直接给医生/HR/客服灌昵称头像） | ✅ | `mergeUserInfo`（`libs/index.ts` 导出） |
| 漫游历史（换设备可见沟通/交易记录） | ✅ | `loadHistory` 走漫游 |
| 主题定制（品牌主色 + CSS 变量） | ✅ | `primaryColor` + `--em-*` tokens |
| i18n 扩展 | ✅ | `mergeMessages(locale, table)` |
| 输入栏功能裁剪 | ✅ | `EmKitConfig.inputFeatures` / `emojiList` |
| 系统侧下发卡片消息渲染 | ✅ | `#custom-message` 插槽整卡自绘（作用域 `message`，含 `customEvent`/`customParams`/`ext`）；卡片样式/字段/多语言/动作由宿主决定，UIKit 不内置卡片组件（M2.14 设计结论） |
| 输入栏上方业务发卡入口 | ✅ | `#input-toolbar` 插槽（消息列表与输入栏之间，无作用域、不注入不占位）；入口胶囊/图标/排序/发送逻辑归宿主，点击自行 `sendCustom`（M2.15） |
| SDK 加载/登录就绪门 | ✅ | `EmKit.whenReady()`（含小程序分包异步 SDK） |

**四场景同为 1v1，chatType 未贯通（M2.9 才做群）对直进场景不构成阻碍**（伪装群除外，见 §5）。
**共同接入成本**：宿主服务端需为终端用户签发环信 token（appkey + userId + token 登录）。

## 2. H5 移动端能力边界（前提约束）

| 能力 | H5 移动端 | 备注 |
|---|---|---|
| 选择图片/拍照 | ✅ | |
| 选择文件（PDF 报告/简历） | ✅ | App 端反而不支持 chooseFile（`libs/platform.ts`） |
| 视频消息 | ⚠️ | `chooseVideo` H5 支持有限（依赖浏览器文件选择与元数据解析）；视频预览仅 H5 支持 |
| **录音/语音消息** | ❌ | **H5 物理不支持录音**（可接收播放）。医疗/客服场景影响最大；解法 = 宿主自集成 H5 录音，或引导至小程序/App 端 |
| 键盘避让 | ✅ | 浏览器自管（input `adjust-position` H5 无效但无副作用） |

## 3. 分场景评估

### 3.1 客服场景（易用度 ~75%）

| 特有需求 | 现状 |
|---|---|
| 直进客服会话 | ✅ |
| 进线携带业务上下文（商品/订单/来源页） | ❌ 发送侧无 ext 通道（P0-1） |
| 欢迎语/自助菜单卡片 | ⚠️ 服务端下发 + `#custom-message` 渲染可行；本地自动发不行 |
| 入口未读角标 | ✅ `useUnreadCounts()` 响应式 + `useTabBarBadge()` 原生角标（P1 部分落地） |
| 标题改「在线客服」 | ⚠️ 只能 `mergeUserInfo` hack；nav-bar 本体 `#title` 插槽未透出（P0-3） |
| 人工/机器人切换、排队 | 后端职责，UIKit 无关 |

### 3.2 医疗场景：患者 ↔ 医生（易用度 ~70%）

| 特有需求 | 现状 |
|---|---|
| 患者直进主治医生会话 | ✅ |
| 患处照片/检查报告（图片 + PDF） | ✅ 图片 / ✅ 文件（H5） |
| 患者语音描述病情 | ❌ H5 不支持录音（物理边界，见 §2） |
| 处方/检查单卡片（医生端下发） | ✅ 接收侧 custom 渲染可行 |
| 会话顶部病情摘要条（诊断/过敏史固定展示） | ❌ 无 banner 插槽（P0-2） |
| 隐私撤回、已读回执（确认患者已读医嘱） | ✅ |
| 合规留痕 | ✅ 漫游 + 服务端 |

### 3.3 招聘场景：求职者 ↔ HR（易用度 ~70%）

| 特有需求 | 现状 |
|---|---|
| 求职者直进 HR 会话 | ✅ |
| 简历附件 | ✅ 文件消息（H5） |
| 会话顶部职位条（职位名+薪资，点击跳职位详情，类 BOSS 直聘） | ❌ 无 banner 插槽（P0-2） |
| 快捷回复/常用语（期望薪资、到岗时间） | ❌ 无 inputbar 上方快捷条扩展位（P1） |
| 面试邀约卡片（HR 侧下发） | ✅ 接收侧可行 |
| 换微信/电话 | ✅ 文本 |

### 3.4 二手交易场景：类闲鱼（易用度 ~65%，缺口最多）

| 特有需求 | 现状 |
|---|---|
| 直进卖家会话 | ✅ |
| 商品卡片消息（图+标题+价格） | ⚠️ 接收 ✅ / 发送 ❌（P0-1） |
| 会话顶部「正在咨询的商品」条 | ❌ 无 banner 插槽（P0-2） |
| 砍价/出价卡片（双向发送） | ❌ 发送侧 ext 通道（P0-1） |
| 交易状态提示（「对方已拍下」「已发货」居中小灰条） | ❌ 无系统提示消息能力（P0-4）：既缺本地插入 API，也缺居中灰条渲染型 |
| 位置消息（线下自提） | ❌ 一期明确砍掉（PLAN.md），弱相关 |
| 支付/订单流转 | 宿主业务，UIKit 无关 |

## 4. 扩展支持能力总评

### 4.1 现有扩展点（够用且设计干净）

props（`conversationId`/`avatarShape`）、插槽（`#custom-message`/`#empty`；nav-bar 层 `#title`/`#action`）、13 项 `EmKitConfig` 全局配置、CSS 变量主题、i18n 注入、菜单裁剪（`messageMenuKeys`/`conversationMenuKeys`）、业务事件 emits（`send`/`recall`/`delete`/`open-info`）、`EmKit.onMessage` 订阅、`mergeUserInfo` 用户资料注入。

### 4.2 缺失扩展点（按多场景复用度排序，本评估核心结论）

| 编号 | 优先级 | 缺口 | 覆盖场景 | 改动量 |
|---|---|---|---|---|
| P0-1 | P0 | 发送侧业务 ext + `sendCustom`（`sendText` 增 ext 参，与引用 ext 合并、引用 key 优先） | 4/4 + 伪装群转接卡 | 小 |
| P0-2 | P0 | 消息列表上方 `#banner` 具名插槽（固定位，不随滚动） | 3/4（医疗病情条、招聘职位条、交易商品条） | 小 |
| P0-3 | P0 | chat-page `title` / `showAction` props（nav-bar 插槽透出） | 4/4 | 极小 |
| P0-4 | P0* | 系统提示消息（本地插入 API + 居中灰条渲染型） | 交易/医疗/伪装群成员进出与转接 | 中 |
| P1-1 | P1 | 未读数 API + 未读变更订阅（总未读/请求未读已落地 `useUnreadCounts`；per-conversation `unreadCountOf` 待补） | 客服/交易入口角标 | 小 |
| P1-2 | P1 | 快捷回复条（inputbar 上方扩展位） | 招聘/客服 | 中 |
| P1-3 | P1 | 自定义长按菜单动作注入（现为纯裁剪） | 交易「查看订单」、医疗「查看处方」 | 中 |
| P2-1 | P2 | H5 录音 | 医疗/客服 | 物理边界，二期或宿主自集成 |
| P2-2 | P2 | 位置消息 | 交易自提 | 一期已砍 |

\* P0-4 初评为 P1，因伪装群场景（§5）的成员进出/转接提示同样依赖它，升级为 P0。

## 5. 继承聊天记录与「伪 1v1」（群伪装单聊）

客服/医疗/交易仲裁存在「表面 1v1、实际多人服务」的形态，且要求历史记录继承。拆两条架构路线评估：

### 5.1 路线 A：单聊 + 共享身份账号（轻量，今天可用）

用户侧始终与「同一账号」单聊（「XX 旗舰店客服」「XX 互联网医院」），多个服务方在后端轮流接管该账号。历史天然继承（同一会话）。

- **UIKit 改动：零**。漫游、未读、回执全部现成。
- 局限：用户感知不到换人；人格化呈现只能靠服务端下发 custom 提示卡片（接收侧已支持）。
- 多数客服 SaaS 的实际做法；多路转接/排队是后端路由职责。

### 5.2 路线 B：真群伪装成单聊（阻塞于 M2.9）

用户 + 多服务方成员同群，UI 隐去群特征，历史靠群漫游继承。

- **现状（评估时）：完全阻塞；2026-10-16 M2.9 群基础已落地**——`syncConversations` 不再过滤群聊、`sendText`/`loadHistory`/`enterConversation` 全链路显式 `chatType`、`enableSyncData` 已含 `'group'`。路线 B 的「群能力」已解除阻塞；剩余缺口是下表所列伪装 UI 开关（见 §7）。
- **M2.9 完成 ≠ 伪装场景可用**。M2.9 落地的是正常群形态（群名+人数/成员昵称行/群公告条/@提及），伪装场景要把这些**关掉**，M2.9 之上还需：

| 伪装需求 | 说明 |
|---|---|
| 隐藏群指示（人数/群名/公告条/「群聊」字样），nav 标题显示机构名 | chat-page 需「伪装模式」配置，M2.9 群形态 UI 全部可关 |
| 成员进出渲染为居中小灰条（「客服小环已接入」）或不渲染 | 依赖 P0-4 系统提示消息 |
| 发送者昵称显示档位：隐藏 / 仅换人时显示一行 / 恒显 | M2.9 默认昵称行恒显，需加开关 |
| 服务方统一身份（所有客服同头像同称谓） | `mergeUserInfo` 批量注入，零改动 |
| 转接卡片（「已为你转接至主治医师」） | custom 消息；发送侧依赖 P0-1 |
| `open-info` 不进展群管理，改由宿主接管（服务信息页） | 依赖 P0-3 `showAction` |
| 群已读回执详情 | M2.9 明确不做，伪装场景一般不需要 |

### 5.3 四场景选型建议

| 场景 | 推荐路线 | 说明 |
|---|---|---|
| 客服 | **A 起步，B 备选** | 共享客服账号今天可用；需人格化转接呈现再上 B |
| 医疗（问诊团队） | **B** | 患者需区分主治医生/助手/护士，昵称行是刚需——即 M2.9 标准群形态，伪装度要求最低 |
| 招聘 | **A 足够** | 换 HR 低频，转接卡片即可 |
| 二手交易 | **A 为主 + 仲裁 B** | 买卖双方纯单聊；平台仲裁介入建三人群（低频，可二期） |

**时间线结论**：路线 B 的群能力已随 M2.9 解锁（2026-10-16），客服/招聘/交易仍以路线 A 起步即可；医疗团队与仲裁群的「伪装形态」还需 §6-3 的开关批次，未完成前可按正常群形态上线。

## 6. 落地路线建议

1. **P0 批次（约 1 天，四场景直进全部「可上线」）**：P0-1 sendCustom/ext、P0-2 `#banner` 插槽、P0-3 title/showAction、P0-4 系统提示消息。
2. **P1 批次（「好用」）**：P1-1 未读 API、P1-2 快捷回复、P1-3 自定义菜单动作。
3. **M2.9 增补「伪装模式」**：群形态 UI 全套隐藏开关（人数/公告/昵称行档位/成员事件渲染策略）+ 伪装形态下 `open-info` 由宿主接管。**必须在 M2.9 设计群形态 UI 时预留开关位，事后补易长成硬编码分支**。实施时将本条款同步进 `PLAN.md` M2.9 节。
4. **边界项**（P2-1 H5 录音、P2-2 位置消息）如实写入接入文档，由场景方自行决策。
5. 配套文档：落地时新增 `docs/GUIDE-CUSTOMER-SERVICE-INTEGRATION.md`（或泛化为多场景接入指引），含 init→login→navigateTo 全代码示例、easycom 规则、`whenReady` 加载态、未读角标取法、`mergeUserInfo` 注入对端资料。**已于 2026-10-20 落地为 `docs/GUIDE-MULTI-SCENARIO.md`（泛化版，含 P0 四项能力示例）。**

## 7. 落地状态（2026-10-20 更新）

> §4.2 的缺口清单是 2026-10-15 评估时点快照；**当前状态以本节为准**。

| 编号 | 状态 | 落地内容 |
|---|---|---|
| P0-1 发送侧 ext / sendCustom | ✅ | `EmKit.sendText(to, chatType, text, quote?, mentions?, ext?)` 业务 ext 与 `msgQuote`/`emQuote`/`em_at_list` 合并（内部 key 优先；1.0 引用主协议为 `msgQuote`）；`EmKit.sendCustom(to, chatType, event, params?, ext?)`；`MESSAGE_TYPE.CUSTOM` 一等类型 + `EmMessageItem.customEvent/customParams`；失败重发支持 custom；`#custom-message` 默认占位改「[自定义消息]」 |
| P0-2 `#banner` | ✅ | `em-chat-page` nav-bar 与群公告条之间固定位插槽（不随消息滚动） |
| P0-3 `title` / `showAction` | ✅ | `title` 覆盖导航标题（空串回落昵称链）；`showAction=false` 隐藏右上角详情入口，宿主接管业务信息页 |
| P0-4 系统提示消息 | ✅ | `EmKit.insertLocalNotice(conversationId, chatType, text)` 通用入口；`insertGroupNotice(groupId, text)` 保留为群聊别名；复用 `MESSAGE_TYPE.NOTICE` 居中灰条 + 长按菜单禁用 |
| P1-1 未读 API | ✅ | 总未读：`useUnreadCounts()` / `getUnreadCounts()` / `useTabBarBadge()`；单会话未读：`useConversationUnreadCount(id)`（响应式）/ `conversationUnreadCountOf(id)`（快照）/ `EmKit.conversationUnreadCountOf(id)` |
| P1-2 快捷回复条 | ✅ | 新原子 `em-quick-reply-bar`（label/text 胶囊，横向滚动）；`em-chat-page` 增 `quickReplies` + `quickReplyMode('fill'\|'send')`，输入栏上方渲染，禁用态/空列表自动隐藏 |
| P1-3 自定义菜单动作 | ✅ | `em-chat-page` 增 `extraMessageMenus`（`EmMessageMenuExtra`，支持 `types` 过滤）+ `message-menu(key, message)` emit；追加在内置项之后、删除项之前（删除保持末位），内置 key 保留、NOTICE 不显示 |
| P2-1 H5 录音 / P2-2 位置消息 | — | 按边界项处理（H5 录音入口已隐藏，位置消息一期砍） |
| M2.9 群基础 | ✅ | 2026-10-16 完成（chatType 贯通/群会话/群形态/@提及/群管理/群系统通知） |
| M2.11 / M2.12 | ✅ | 2026-10-20 P0 四项 + P1 三项落地（见上表） |
| M2.14 自定义卡片插槽化 | ✅ | 内核只保留 `sendCustom` + `#custom-message` 插槽；**不内置卡片组件/注册表/schema**。Demo 侧 `demo/components/demo-card` 参考实现（14 种卡片/双动作/手机号脱敏/未知回落）+ 免登录预览页；业务方可整卡替换 |
| M2.15 输入栏业务入口 | ✅ | `em-chat-page` 新增 `#input-toolbar` 插槽（消息列表与输入栏之间，随键盘上移、不注入不占位）；Demo `demo-composer-bar` 注入客服「发订单/发工单」、医疗「发病例/发处方」、招聘「发简历/发邀约/换手机号」等场景入口，点击即 `sendCustom`；入口开关实时生效 |
| Demo 演示 | ✅ | IM 场景实验室：6 场景（客服/医患/交易/招聘/家校/社群）由 `demo/common/scenario-catalog.ts` 配置驱动，列表页 → 业务详情页 → 共享聊天页；每场景 2–3 种宿主自绘卡片（共 14 种）+ 输入栏场景入口条，列表页另有免登录「自定义卡片预览」；详见 `docs/GUIDE-MULTI-SCENARIO.md` §6 |
| 伪装模式（§6-3） | ◐ 预留 | M2.9 已预留群形态独立开关（`showMemberCount`/`senderNameMode`/`showAnnouncement`/`enableMention` + chat-info 三开关），P0-3 `showAction` 可接管 `open-info`；仍缺 `senderNameMode='on-change'` 档、群指示「一键隐藏」组合配置、成员事件渲染策略档位，待伪装批次立项 |

**接入指引**：`docs/GUIDE-MULTI-SCENARIO.md`（四场景 init→login→navigateTo、P0/P1 能力代码示例、平台边界）。

---

*本文档为评估存档；§1–§6 保留评估时点结论，§7 记录落地状态。后续批次（P1/伪装模式）立项时先改 `PLAN.md`。*
