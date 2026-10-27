# 单聊天页模板

`chat-only` 面向只需要一个单聊页面的业务工程，例如从订单、挂号或职位详情直接联系客服、医生或顾问。完整 `demo/` 用于展示完整 IM 与扩展能力；如果只需单聊，从 Demo 手工删减页面和接线反而增加接入成本，因此模板预先保留了最小工程结构、登录恢复、聊天页和微信小程序 SDK 分包。

模板只包含登录页和一个单聊页面，不含会话列表、通讯录、群组或聊天信息页。它是可复制、可修改的宿主工程，不是独立 SDK，也不免除接入配置。

## 适用边界

- **适合**：已有明确业务入口和对端 userId，希望直接进入 1v1 会话，或先跑通最小单聊链路再逐步扩展。
- **不适合**：需要会话列表、通讯录、群聊、聊天信息页，或希望直接查看全部组件与业务插槽示例；这些场景请使用完整 `demo/`。
- **仍需宿主完成**：配置 appkey、token 接口与对端资料，并按自己的登录态方案替换本地会话存储；生产环境的 token 仍必须由业务服务端签发。

## 使用

1. 复制 `templates/chat-only` 为独立工程。仓库内开发时，`uni_modules/easemob-uikit-uni` 已软链到当前插件；复制到仓库外时，改为从插件市场导入或复制 `uni_modules/easemob-uikit-uni`。
2. 执行 `npm install`，然后填写 `common/im-config.ts` 的 `appkey`、`tokenEndpoint` 和默认对端资料。
3. 用 HBuilderX 运行到浏览器或微信开发者工具，输入当前用户与对方 userId。token 接口接收 `POST { userId }`，返回 `{ "token": "..." }`。
4. 登录成功后自动进入聊天页。模板会请求新 token 恢复会话，不直接复用可能过期的本地 token。

生产环境必须由业务服务端签发 token。`common/session.ts` 是普通本地存储示例，不是安全存储；请将这里替换为宿主认可的安全存储/自有登录态方案，不要保存 AppSecret、管理员密码或长期 token。

## 构建

仓库根目录执行：

```bash
npm install --prefix templates/chat-only
node scripts/check-template.mjs
```

该命令构建 H5 和微信小程序，并执行 SDK 分包与主包体积检查。单独构建后处理：

```bash
node scripts/prepare-sdk-subpackage.mjs templates/chat-only/unpackage/dist/build/mp-weixin templates/chat-only
node scripts/check-mp-size.mjs templates/chat-only/unpackage/dist/build/mp-weixin templates/chat-only
```

聊天页是根页，已关闭返回箭头和详情入口。需要详情页时将 `show-action` 改回 `true` 并接 `open-info`；需要返回时打开 `show-back`。`em-chat-page` 面向整页使用，嵌入半屏/弹窗请使用原子组件自行组合。
