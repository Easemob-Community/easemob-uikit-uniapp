# easemob-uikit-uni

环信 IM 的 uni-app 版 UIKit（uni-app x 蒸汽模式）。

> 开发中。已包含登录接入、会话列表页、聊天页（5 种气泡 + 长按菜单/引用/撤回/重发/已读回执）、聊天详情页、联系人页（通讯录 + 好友申请）与日志导出；逻辑层在 `libs/`，组件层在 `components/`。

## 使用方式（目标形态）

```ts
import { EmKit } from '@/uni_modules/easemob-uikit-uni/libs'

EmKit.init({ appkey: 'your-appkey' })
await EmKit.login({ userId, token })
```

页面级组件（`em-conversation-page` / `em-chat-page` / `em-chat-info-page` / `em-contact-page` / `em-contact-requests-page`）位于 `components/pages/`，需在宿主工程 `pages.json` 配置 easycom custom 规则自动导入（原子组件走内置规则，零配置）：

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

详见仓库根 README 与 PLAN.md。
