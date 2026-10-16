# easemob-uikit-uniapp

环信 IM 的 uni-app 版 UIKit（uni-app x 蒸汽模式），面向 DCloud 插件市场社区分发。MIT 开源。

> 当前状态：**一期开发中（M2.9 群基础已落地）**。一期执行依据见 [PLAN.md](./PLAN.md)，逐日进度与各端验证状态见 [docs/STATUS.md](./docs/STATUS.md)。

## 开发环境（锁定）

- HBuilderX **5.26+**（或 HBuilder V 5.21+，蒸汽模式硬性要求）
- Node.js 18+（CLI 编译用）
- 目标平台：Android 6+ / iOS 15+ / 鸿蒙 API20+ / 现代浏览器 / 微信小程序

## 仓库结构

```
uni_modules/easemob-uikit-uni/   # UIKit 插件本体（组件前缀 em-）
demo/                            # 演示工程（uni-app x，manifest.json 开启 vapor）
docs/                            # 文档（含 SDK 五端连通性 spike 记录）
scripts/                         # 编译/发布脚本
```

## 快速开始（最小可验证用例）

最小用例是 `demo/pages/spike/spike.vue`：手填 appkey/userId/token 登录环信，给指定 peer 发文本消息并显示收发流，用于验证 SDK 各端连通性。

方式一（HBuilder）：用 HBuilderX / HBuilder V 打开 `demo/` 目录，运行到浏览器 / 微信开发者工具 / 真机。

方式二（CLI，走 HBuilderX 内置编译器）：

```bash
cd demo && npm install        # 安装 easemob-websdk
cd ..
scripts/uni.sh build web      # H5 出包
scripts/uni.sh build mp-weixin # 微信小程序出包（用微信开发者工具打开 demo/unpackage/dist/build/mp-weixin）
# H5 本地验证：dev 模式暂不支持 .uts 入口，用构建产物 + 静态伺服
cd demo/unpackage/dist/build/web && python3 -m http.server 5180
```

> appkey 与测试 token 从环信控制台获取（仅限开发用途），**不要**把真实凭据提交进仓库。

## 路线图与能力边界

已落地（一期，里程碑与验收口径见 [PLAN.md](./PLAN.md)，逐日进度见 [docs/STATUS.md](./docs/STATUS.md)）：

- 单聊全链路：会话列表（置顶/免打扰/未读/草稿）、聊天页（文本/图片/语音/视频/文件、引用/撤回/失败重发/已读回执/typing）、聊天详情、通讯录（好友列表/好友申请）
- **群基础（M2.9）**：群列表、建群、群聊（公告条 / @ 提及 / 成员昵称行）、群详情管理（公告编辑 / 改名 / 管理员 / 转让 / 退群解散 / 全员禁言 / 成员管理 / 邀请入群）、联系人页入口化（新请求 / 群组 / 好友列表三入口）

二期（M4 起，另行立项）：单条转发、联系人详情页/黑名单、文档站等，见 PLAN.md 第 5 节。一期范围外的功能会在发版时逐条冻结公示，避免重复 issue。

### 不做什么（一期，群侧裁剪）

黑名单/白名单管理页、群共享文件、公开群入群申请审批、群名片、群已读回执详情、群聊消息搜索、群公告富文本、presence 在线状态。完整裁剪清单见 PLAN.md 第 2 节与各里程碑「明确不做」。

### 已知限制

- **@ 提及为追加式插入**：选人后追加到草稿尾部，不支持光标处插入——uni `<input>` 无光标位置 API（无 selectionStart），属平台物理上限。
- 其余平台降级项（蒸汽端 CSS 动画、H5 录音等）见 docs/STATUS.md 各条目「已知降级」。

### 迁移说明（M2.9 breaking 变更）

- `em-contact-page` 由「好友主页」重构为「入口页」（新请求/群组/好友列表三入口，emits `entry-click` + `add`）；原好友列表零回归平移至新页面级组件 `em-contact-list-page`（emits `select`/`back`），宿主按入口 key 接线路由。
- `em-chat-page` / `em-chat-info-page` 新增**必传** `chatType` prop（`'singleChat' | 'groupChat'`）；消息/会话域 API 同步增必传 `chatType` 参数，`EmMessageItem`/`EmConversationItem` 增 `chatType` 字段。
