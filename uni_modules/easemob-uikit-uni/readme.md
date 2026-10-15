# easemob-uikit-uni

环信 IM 的 uni-app 版 UIKit（uni-app x 蒸汽模式）。

> 开发中。已包含登录接入、会话列表页、聊天页（5 种气泡 + 长按菜单/引用/撤回/重发/已读回执）、聊天详情页、联系人页（通讯录 + 好友申请）与日志导出；逻辑层在 `libs/`，组件层在 `components/`。

## 使用方式（目标形态）

```ts
import { EmKit } from '@/uni_modules/easemob-uikit-uni/libs'

EmKit.init({ appkey: 'your-appkey' })
await EmKit.login({ userId, token })
```

页面级组件（`em-conversation-page` / `em-chat-page` / `em-chat-info-page` / `em-contact-page` / `em-contact-list-page` / `em-contact-requests-page` / `em-group-page`）位于 `components/pages/`，需在宿主工程 `pages.json` 配置 easycom custom 规则自动导入（原子组件走内置规则，零配置）：

```json
{
  "easycom": {
    "autoscan": true,
    "custom": {
      "^em-([a-z-]+)-page$": "@/uni_modules/easemob-uikit-uni/components/pages/em-$1-page/em-$1-page.vue"
    }
  }
}
```

peer 依赖：`easemob-websdk`（npm 安装）。

## 微信小程序主包体积优化（SDK 分包异步化）

小程序主包 2MB 限制下，websdk（IIFE ~873KB）静态导入会占满主包。UIKit 已内置**分包异步化注入口**（`libs/client/sdk.ts`，MP-WEIXIN 条件编译）：小程序端不静态依赖 websdk，运行时经微信原生跨分包 `require(path, cb, fail)` 从普通分包加载；其它端保持静态导入直通，零行为变更。

宿主接入三步：

1. **构建期把 SDK IIFE 放进普通分包**：把 `node_modules/easemob-websdk/bundle/im-sdk-web.iife.js` 尾部追加 `module.exports = IMSDK;`，做 ES2017 语法降级（IIFE 内含 `?.`/`??`，旧基础库真机会 SyntaxError），输出为分包内 `sub-sdk/im-sdk.js`（参考本仓库 `scripts/prepare-sdk-subpackage.mjs`，零依赖、可整段拷贝；每个分包至少配一个占位页）。
2. **pages.json 声明分包 + 预下载**：

```json
{
  "subPackages": [{ "root": "sub-sdk", "independent": false, "pages": ["pages/placeholder/placeholder"] }],
  "preloadRule": { "pages/login/login": { "network": "all", "packages": ["sub-sdk"] } }
}
```

3. **代码无需改动**：`EmKit.init()` / `login()` 会自动等待 SDK 分包就绪（`EmKit.whenReady()` 可向宿主暴露「加载消息服务…」占位态）。如需自管理加载（如自行预下载、自定义分包路径），注入：

```ts
EmKit.init({
  appkey: 'your-appkey',
  // 二选一：sdkModule 优先；返回 websdk 根导出（允许 { default } 包装）
  sdkLoader: () => myLoadSdk(),
  sdkModule: preloadedSdk
})
```

约束：默认分包路径为产物根下 `sub-sdk/im-sdk.js`（相对于 `uni_modules/easemob-uikit-uni/libs/client/sdk.js` 的 `../../../../sub-sdk/im-sdk.js`），自定义路径请走 `sdkLoader` 注入。完整实施指引（关键步骤、分包成功验证方法、报错排查表、SDK 升级与回滚流程）见仓库 `docs/GUIDE-WEAPP-SDK-SUBPACKAGE.md`；编译器行为实测记录见 `docs/SPIKE-SDK-SUBPACKAGE.md`。

详见仓库根 README 与 PLAN.md。
