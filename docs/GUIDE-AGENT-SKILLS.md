<!-- Generated from skills/README.md by scripts/sync-skills-docs.mjs. Do not edit directly. -->

# 接入技能包（Agent Skills）

面向**用 AI 把 `easemob-uikit-uni` 接进宿主工程**的开发者与编码代理。每个目录是一份可独立加载的 `SKILL.md`，包含触发条件、接入步骤、可复制代码、组件契约、坑与验收清单。

> 版本基线：`easemob-uikit-uni` **1.0.0-rc.2** · `easemob-websdk` **5.1.3** · HBuilderX **5.21+**（uni-app x 蒸汽模式）。

## 与仓库 `.agents/skills/` 的区别

| 目录 | 读者 | 内容 |
|---|---|---|
| `skills/`（本目录） | **宿主接入方 / 接入 AI** | 怎么安装、初始化、接页面、扩展业务、排错 |
| `.agents/skills/` | **UIKit 贡献者 / 开发 AI** | 怎么改组件、libs、样式、跨端坑、编译门禁 |

接入方不需要读 `.agents/skills/`；只有要改 UIKit 源码时才需要。

## 安装到宿主工程

把需要的技能目录复制到宿主工程的技能目录即可（按你的 AI 工具选择；不确定就两个都放）：

```bash
# Claude Code
mkdir -p your-app/.claude/skills
cp -R skills/em-host-* your-app/.claude/skills/

# Codex / 通用 Agent Skills 约定
mkdir -p your-app/.agents/skills
cp -R skills/em-host-* your-app/.agents/skills/
```

也可以不复制，直接在对话里把本目录指给 AI：**「按 `easemob-uikit-uni/skills/em-host-integration/SKILL.md` 接入环信 IM」**。

## 推荐用法

1. **从零接入**：先加载 `em-host-integration`，让 AI 先问清 appkey / token 签发接口 / 入口形态 / 目标端，再动代码。
2. **只做聊天页**：直接加载 `em-host-conversation-chat`。
3. **客服/医疗/招聘等业务直进会话**：加载 `em-host-business-extension`。
4. **AI 回复流式输出**：加载 `em-host-ai-stream`。
5. **微信小程序**：在总纲之后加载 `em-host-mp-subpackage`。
6. **出问题**：加载 `em-host-troubleshooting`，按症状表定位。

给 AI 的请求示例：

```text
请阅读 skills/em-host-integration/SKILL.md，把环信 IM 接入当前 uni-app x 工程。
AppKey 用环境变量注入，token 由我们服务端 POST /api/im/token 返回 { userId, token }。
先只接会话列表 + 单聊，H5 和微信小程序都要能跑。
```

## 技能地图

| 技能 | 解决什么 |
|---|---|
| [`em-host-integration`](./SKILLS-INTEGRATION.md) | 总纲：环境、安装、pages.json、初始化、登录、路由、验收、API 地图 |
| [`em-host-conversation-chat`](./SKILLS-CONVERSATION-CHAT.md) | 会话列表 / 聊天页 / 聊天详情：路由参数、高度链、未读、返回、插槽 |
| [`em-host-contacts-groups`](./SKILLS-CONTACTS-GROUPS.md) | 通讯录三入口、好友申请、群列表/建群、群详情管理 |
| [`em-host-business-extension`](./SKILLS-BUSINESS-EXTENSION.md) | 业务直进会话：ext、自定义卡片、banner、输入栏入口、快捷回复、本地提示 |
| [`em-host-ai-stream`](./SKILLS-AI-STREAM.md) | AI 流式消息：分片合并、`#stream-message`、订阅与富文本 |
| [`em-host-theme-i18n`](./SKILLS-THEME-I18N.md) | 深色模式、品牌色、中英文、输入栏/菜单裁剪、日志隐私 |
| [`em-host-mp-subpackage`](./SKILLS-MP-SUBPACKAGE.md) | 微信小程序 SDK 分包异步化、主包体积、`sub-sdk/im-sdk.js` 报错 |
| [`em-host-troubleshooting`](./SKILLS-TROUBLESHOOTING.md) | 白屏/双导航/列表空/登录弹回/发送失败/收不到消息，按症状定位 |
