# 单聊天页模板

`chat-only` 面向只需要一个单聊页面的业务工程，例如从订单、挂号或职位详情直接联系客服、医生或顾问。模板预置登录恢复、聊天页，以及微信小程序的 `sub-im` 页面分包和 `sub-sdk` SDK 分包。完整 `demo/` 用于展示完整 IM 与扩展能力。

模板只包含登录页和一个单聊页面，不含会话列表、通讯录、群组或聊天信息页。它是可复制、可修改的宿主工程，不是独立 SDK，也不免除接入配置。

## 使用

1. 复制 `templates/chat-only` 为独立工程。仓库内开发时，`uni_modules/easemob-uikit-uni` 已软链到当前插件；复制到仓库外时，改为从插件市场导入或复制 `uni_modules/easemob-uikit-uni`。
2. 执行 `npm install`，然后填写 `common/im-config.ts` 的 `appkey`、`tokenEndpoint` 和默认对端资料。
3. 输入当前用户与对方 userId。token 接口接收 `POST { userId }`，返回 `{ "token": "..." }`。
4. 登录成功后自动进入 `sub-im` 中的聊天页。模板会请求新 token 恢复会话，不直接复用可能过期的本地 token。

生产环境必须由业务服务端签发 token。`common/session.ts` 是普通本地存储示例，不是安全存储；请替换为宿主认可的安全存储/自有登录态方案，不要保存 AppSecret、管理员密码或长期 token。

## 微信小程序

在模板根目录执行：

```bash
# 开发：同时启动 HBX dev 编译和 SDK 分包 watch
npm run dev:mp

# 构建：HBX build + SDK 后处理 + 完整分包检查
npm run build:mp

# 单独复查 build 产物
npm run check:mp
```

用微信开发者工具打开 `unpackage/dist/dev/mp-weixin`（开发）或 `unpackage/dist/build/mp-weixin`（构建）。

如果坚持使用 HBuilderX GUI 的“运行到微信开发者工具”，另开一个终端保持以下命令运行，再在 HBX 中重新运行：

```bash
npm run watch:mp
```

watch 会在 dev 重编译删除 SDK、或微信开发者工具改写项目配置后自动恢复正确产物。不要在 `unpackage/` 中手工维护这些文件。

模板已配置：

- `sub-im`：聊天页，普通分包，`independent: false`。
- `sub-sdk`：SDK 文件与加载页，普通分包，`independent: false`。
- `preloadRule`：登录页预下载 `sub-sdk`。
- 后处理：同时维护 `project.config.json` 与已存在的 `project.private.config.json`，避免异步加载的 SDK 被“忽略未使用文件”剔除。

HBuilderX 不在默认安装位置时，设置 `HBUILDERX_PATH`；需要单独指定 esbuild 时设置 `ESBUILD_BIN`。

## 仓库内完整门禁

仓库根目录执行：

```bash
npm install --prefix templates/chat-only
node scripts/check-template.mjs
```

该命令检查脚本同步和双分包结构，并构建 H5 与微信小程序。也可单独运行 `npm --prefix templates/chat-only run build:mp` 验证小程序链路。

聊天页是根页，已关闭返回箭头和详情入口。需要详情页时将 `show-action` 改回 `true` 并接 `open-info`；需要返回时打开 `show-back`。`em-chat-page` 面向整页使用，嵌入半屏/弹窗请使用原子组件自行组合。
