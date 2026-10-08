# easemob-uikit-uni

环信 IM 的 uni-app 版 UIKit（uni-app x 蒸汽模式）。

> 早期开发中。当前仅包含 SDK 连通性 spike 所需的最小逻辑层（`libs/`：EmKit 门面 + 平台适配），页面级组件（em-conversation-page / em-chat-page）将随里程碑 M1–M3 沉淀。

## 使用方式（目标形态）

```ts
import { EmKit } from '@/uni_modules/easemob-uikit-uni/libs'

EmKit.init({ appkey: 'your-appkey' })
await EmKit.login({ userId, token })
```

peer 依赖：`easemob-websdk`（npm 安装）。

详见仓库根 README 与 PLAN.md。
