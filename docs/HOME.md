---
layout: home
hero:
  name: uniApp UIKit
  text: 环信 uni-app x 即时通讯 UI 组件库
  tagline: 基于 uni-app x 蒸汽模式，覆盖 Android、iOS、鸿蒙、H5 与微信小程序，提供会话、单聊、群聊、联系人、群管理与业务扩展能力。
  actions:
    - theme: brand
      text: 快速开始
      link: /uniapp/guide/quickstart
    - theme: alt
      text: 页面指南
      link: /uniapp/guide/pages-conversation
    - theme: alt
      text: 组件参考
      link: /uniapp/guide/components
features:
  - title: 五端统一组件
    details: 一套 em-* 组件覆盖 App 三端、H5 与微信小程序，并处理安全区、软键盘、导航栏与平台能力差异。
  - title: 完整 IM 场景
    details: 会话列表、单聊、群聊、联系人、好友申请、群资料、群成员管理、消息引用、撤回、已读回执与未读角标。
  - title: 业务可扩展
    details: 自定义消息、场景卡片插槽、顶部业务条、输入栏业务入口、快捷回复、业务长按菜单与 AI 流式消息。
  - title: 可定制与可维护
    details: 设计变量、明暗主题、跟随系统、中英文文案、全局行为开关与页面级 props/插槽，按业务边界逐层接管。
---

## 从这里开始

| 目标 | 入口 |
|---|---|
| 从空工程跑到收发消息 | [快速开始](/uniapp/guide/quickstart) |
| 理解分层、生命周期与数据流 | [核心概念与架构](/uniapp/guide/concepts) |
| 接入会话、聊天、通讯录、群组页面 | [页面指南](/uniapp/guide/pages-conversation) |
| 查组件 props / events / slots | [组件参考](/uniapp/guide/components) |
| 查 `EmKit` 方法与类型 | [EmKit API](/uniapp/guide/api-kit) · [类型与常量](/uniapp/guide/api-types) |
| 查初始化与行为配置 | [配置参考](/uniapp/guide/config) |
| 做自定义消息、业务卡片、AI 流式 | [消息与扩展协议](/uniapp/guide/messaging) · [AI 流式消息](/uniapp/guide/ai-stream) |
| 查平台差异与限制 | [平台能力与差异](/uniapp/guide/platform) |

## 能力总览

- **会话与消息**：会话列表、筛选 tab、搜索、置顶、免打扰、未读数、草稿、连接状态条；文本、图片、语音、视频、文件、自定义消息与本地系统提示。
- **聊天交互**：引用、撤回、失败重发、单聊已读回执、正在输入、@ 提及、群公告、全员禁言、历史加载、时间分隔、键盘避让与流式跟随滚动。
- **联系人与群组**：通讯录入口、好友列表、字母索引、好友申请、群邀请、群列表、建群、群资料、成员管理、邀请/移除、转让群主、退群/解散。
- **业务扩展**：`sendText` 业务 ext、`sendCustom` + `#custom-message` 整卡插槽、`#banner`、`#input-toolbar`、`#input-bar` 输入栏整栏自绘、快捷回复、业务长按菜单、单会话未读、AI 流式消息。
- **工程能力**：明暗主题与跟随系统、中英文、设计变量、日志导出、微信小程序 SDK 分包、鸿蒙真机签名指引。

## 兼容性

| 项 | 要求 |
|---|---|
| HBuilderX | 5.21+（推荐 5.26+；蒸汽模式） |
| uni-app x | HBuilderX 4.71+，Vue 3 组合式 API |
| Node.js | 18+（CLI 构建） |
| 环信 SDK | `easemob-websdk` 5.1.3（peer 依赖） |
| App | Android 6+ / iOS 15+ / 鸿蒙 API20+ |
| H5 | 现代浏览器（移动端布局） |
| 小程序 | 微信小程序（SDK 需分包接入） |

> 当前版本 `1.0.0-rc.1`。完整变更见 [更新日志](/uniapp/guide/changelog)。
