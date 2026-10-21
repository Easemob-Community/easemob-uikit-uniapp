---
name: em-host-mp-subpackage
description: Use when 在微信小程序接入 easemob-uikit-uni 遇到主包超 2MB、需要把 websdk 做分包异步化，或报 “module 'sub-sdk/im-sdk.js' is not defined”、真机 “SyntaxError: Unexpected token .”、ChatClient undefined、登录一直加载。
---

# 微信小程序：SDK 分包异步化

> 基线：UIKit `1.0.0-rc.1` · websdk `5.1.3` · 微信基础库 **≥ 2.11.2**。
> 只有微信小程序需要这一步；H5 / App 跳过。UIKit 已内置跨分包加载器，宿主**不改业务代码**。

## 1. 为什么必须做

微信小程序主包上限 2MB，而 websdk 的 IIFE 产物约 873KB，静态 `import` 会被整包收进主包 `vendor.js`。

做法不是「删 SDK 代码」，而是把 SDK 作为**普通分包**里的自包含 CJS 模块，运行时用微信原生跨分包 `require(path, cb, fail)` 按需加载：

```text
主包（约 0.5MB）                     分包 sub-sdk（约 1.2MB）
├── app.js                          ├── pages/placeholder/   （占位页，声明必需）
├── 会话 tab 页                      └── im-sdk.js            （SDK IIFE + module.exports）
├── UIKit 组件/库（无 SDK 静态依赖）
└── 加载器 libs/client/sdk.ts ──require──▶ 分包下载 → 模块导出 → ChatClient.init → login
```

**核心纪律**：主包代码里**零 websdk 静态导入**。UIKit 已经把运行时导入收口到 `libs/client/sdk.ts`，宿主不要再 `import 'easemob-websdk'`。

## 2. 代价（先和用户确认能接受）

| 代价 | 说明 |
|---|---|
| 首次进 IM 有等待 | 分包约 1MB，首次使用前需下载；`preloadRule` 可藏进登录页停留时间 |
| 下载失败 = IM 不可用 | 必须给重试与提示；静态打包没有这种失败模式 |
| 整包不减反略增 | SDK 降级后约 1.2MB，总包变大；**只看主包那一行** |
| 多一个构建后处理 | HBuilderX GUI 的 dev 编译不会自动跑钩子，需要 `--watch` 或手动跑 |
| 调试模型变化 | SDK 不在主包依赖图里，断点要打进分包文件 |

如果业务是「打开 App 首屏就是 IM」，可评估「启动即预加载分包」换零等待。

## 3. 前置检查

| # | 条件 | 验证 |
|---|---|---|
| 1 | 微信基础库 ≥ 2.11.2 | 开发者工具模拟器设置 |
| 2 | SDK 精确锁版（无 `^`/`~`） | `package.json` 为 `"5.1.3"` |
| 3 | 已声明**普通分包**（`independent: false`） | 见第 4 节 |
| 4 | 能拿到 IIFE | `node_modules/easemob-websdk/bundle/im-sdk-web.iife.js` |
| 5 | 主包零 SDK 静态导入 | 全文搜 `from 'easemob-websdk'` |
| 6 | 有 esbuild（HBuilderX 自带） | 见第 5 节 |

## 4. pages.json：声明分包与预下载

```json
{
  "subPackages": [
    {
      "root": "sub-sdk",
      "name": "sub-sdk",
      "independent": false,
      "pages": [
        { "path": "pages/placeholder/placeholder", "style": { "navigationBarTitleText": "SDK Loader" } }
      ]
    }
  ],
  "preloadRule": {
    "pages/login/login": { "network": "all", "packages": ["sub-sdk"] }
  }
}
```

要点：

- **`root` 必须是 `sub-sdk` 且位于工程根目录**：UIKit 默认加载路径写死为编译产物根下的 `sub-sdk/im-sdk.js`。改根名/嵌套层级需要自定义 `sdkLoader`（见 6.3）。
- 每个分包至少一个页面：占位页永不跳转，只为满足微信结构要求。
- `independent` 必须 `false`（独立分包不能被外部引用）。
- `preloadRule` 的 key 是**登录页真实路径**；`network: "all"` 表示非 WiFi 也预下载。
- 页面分包（聊天页）与 SDK 分包相互独立，可同时存在。

## 5. 生成 `sub-sdk/im-sdk.js`

### 5.1 使用随技能提供的脚本

把 `scripts/prepare-sdk-subpackage.mjs` 复制到宿主工程的 `scripts/`，构建后执行：

```bash
# 默认：当前工程 + unpackage/dist/build/mp-weixin
node scripts/prepare-sdk-subpackage.mjs

# 显式指定路径（CI / 多环境）
node scripts/prepare-sdk-subpackage.mjs \
  --project . \
  --out unpackage/dist/build/mp-weixin

# HBuilderX 不在默认位置时
HBUILDERX_PATH="/path/to/HBuilderX" node scripts/prepare-sdk-subpackage.mjs
# 或
node scripts/prepare-sdk-subpackage.mjs --esbuild /path/to/esbuild
```

`--out` / `--sdk` / `--esbuild` 的相对路径按 `--project` 解析；HBuilderX 不在默认位置时优先用 `HBUILDERX_PATH`。

脚本做 5 件事：

1. 校验 IIFE 全局名仍是 `IMSDK`；
2. 追加 `module.exports = IMSDK;`；
3. 用 esbuild 降级到 **es2017 + cjs**（IIFE 内含 `?.`/`??`，旧基础库会 `SyntaxError`）；
4. 写入 `<out>/sub-sdk/im-sdk.js`；
5. 用 Node 真正 `require` 一遍，校验 `ChatClient/ChatManager/...` 导出齐全，并关闭 `project.config.json` 的两个 ignore 开关。

### 5.2 挂到构建流程

HBuilderX CLI：

```bash
# 构建后
scripts/uni.sh build mp-weixin   # 本仓库脚本已内置后处理
# 宿主工程可写成 npm script / CI step
node scripts/prepare-sdk-subpackage.mjs
```

HBuilderX GUI / dev：

- GUI 的 dev 编译**不会**自动跑构建后处理（产物会被整体重发，`im-sdk.js` 被抹掉）；
- 开发期另开一个终端跑 `node scripts/prepare-sdk-subpackage.mjs --watch`，它轮询产物 `app.json`，重编译后自动补文件；
- 或每次 dev 编译后手动跑一次（不推荐，容易忘）。

### 5.3 不要手改产物

`sub-sdk/im-sdk.js`、`project.config.json` 都是构建产物；每次编译会重新生成。所有改动必须放在后处理脚本里。

## 6. 业务代码：不需要改

### 6.1 默认加载

UIKit 的 `libs/client/sdk.ts` 在 MP-WEIXIN 下：

- 无任何 websdk 静态依赖；
- `EmKit.init()` 后异步 `require('../../../../sub-sdk/im-sdk.js', cb, fail)`；
- 失败清缓存，允许重试；
- `EmKit.login()` 等入口自动 `await whenReady()`。

所以宿主保持原代码：

```ts
EmKit.init({ appkey: 'YOUR_APPKEY' })
await EmKit.login({ userId, token })
```

### 6.2 加载态与失败重试

```ts
import { ref } from 'vue'

const ready = ref(false)
const loadError = ref('')

EmKit.whenReady()
  .then(() => { ready.value = true })
  .catch((e) => {
    loadError.value = '消息服务加载失败，请检查网络后重试'
    console.error('[im] sdk load failed', e)
  })
```

- 登录按钮在 `!ready` 时给 loading 或禁用；
- 失败后 UIKit 已清初始化缓存，用户点「重试」可再次 `EmKit.init(...)`；
- 不要把加载失败静默掉（表现为「点了没反应」）。

### 6.3 自定义分包路径（可选）

只有不用 `sub-sdk` 根目录时才需要：

```ts
EmKit.init({
  appkey: 'YOUR_APPKEY',
  sdkLoader: () => new Promise((resolve, reject) => {
    // @ts-ignore 微信模块作用域注入的 require；路径相对「编译产物中的调用文件」
    require('../../sub-sdk/im-sdk.js', (mod: any) => resolve(mod?.default ?? mod), reject)
  })
})
```

- 路径是**产物路径**，不是源码路径；写错只会在真机暴露。
- 也可以用 `sdkModule` 注入已加载好的模块（优先级高于 `sdkLoader`）。
- 不要用动态 `import()`（uni-app x 不支持）。

## 7. 验证（每层都过才算稳）

### 7.1 产物静态检查

```bash
ls -lh unpackage/dist/build/mp-weixin/sub-sdk/im-sdk.js   # 存在且非 0 字节
grep -c "module.exports" unpackage/dist/build/mp-weixin/sub-sdk/im-sdk.js
# 主包 vendor 不应出现 SDK 特征串（如 msync）
grep -c "msync" unpackage/dist/build/mp-weixin/common/vendor.js || true
```

### 7.2 开发者工具

1. **项目配置 → 基本信息**：分包列表出现 `/sub-sdk/`（约 1.2MB），主包约 0.5MB；
2. **预览 → 代码包明细**：主包 ≪ 2MB，SDK 体积在 `/sub-sdk/` 行；
3. **Console**：出现 `preloadSubpackages: sub-sdk` + `success`；`No. of subpackages: 2`。

### 7.3 运行时冒烟

登录 → 会话列表有真实数据 → 进聊天页发一条文本 → 对端收到。Console 有 SDK 日志即链路通。

### 7.4 真机

iOS/Android 各扫一次预览码，重点看旧机型（es2017 就是为旧 JSC 准备）；首次进 IM 等待可接受。

## 8. 报错 → 根因 → 修复

| 报错 | 根因 | 修复 |
|---|---|---|
| `module 'sub-sdk/im-sdk.js' is not defined` | ① 文件不在当前打开的产物目录；② 依赖分析把文件剔除；③ dev 编译抹掉了文件 | 先 `ls` 确认文件存在；再查 `ignoreDevUnusedFiles`/`ignoreUploadUnusedFiles`；dev 跑 `--watch` |
| 真机 `SyntaxError: Unexpected token .` | 分包产物仍含 `?.`/`??` | 确认 esbuild 降级真的执行（检查产物） |
| `ChatClient is undefined` | IIFE 全局名变了 / 没追加 `module.exports` / 模块被 default 包装 | 核对全局名；`mod?.default ?? mod` |
| 登录报「call EmKit.init() first」 | 没等到 whenReady 就调 SDK 方法 | 业务入口统一 `await whenReady()`（UIKit 已做，检查是否绕过） |
| 分包声明了但面板没有 | `subPackages` 层级错 / `pages` 为空 / 大小写写成 `subpackages` | 对照第 4 节 |
| 总包变大 | 正常，SDK 搬进分包 | 只看主包一行 |
| `require is not a function` | 基础库 < 2.11.2 | 升级微信或做特性检测降级提示 |

## 9. 升级 websdk 检查清单

1. `npm install easemob-websdk@<版本> --save-exact`，核对 lockfile；
2. 确认 IIFE 路径仍是 `bundle/im-sdk-web.iife.js`；
3. 确认全局名仍是 `IMSDK`（脚本会校验）；
4. 确认必需 Manager 导出齐全（脚本会 require 探针）；
5. 重新构建 + 跑后处理 + 静态检查；
6. 模拟器 + iOS/Android 真机回归登录、收发、断网重连、token 过期。

## 10. 回滚

- **只回滚 SDK 版本**：装回旧版，重新构建。
- **放弃分包**：移除 `sub-sdk` 声明与 `preloadRule`，删后处理钩子，恢复静态导入（需要改 UIKit 的 sdk 加载器或改回非 MP 直通实现）。回滚后必须重新核对主包仍 < 2MB——这通常正是当初做分包的原因。

## 11. 验收清单

- [ ] 主包 ≤ 1.5MB（留余量），分包面板出现 `/sub-sdk/`
- [ ] `sub-sdk/im-sdk.js` 存在、非 0 字节、含 `module.exports`
- [ ] `project.config.json` 两个 ignore 开关为 `false`
- [ ] 模拟器登录、收发、断网重连通过
- [ ] iOS/Android 真机各一次冒烟
- [ ] 弱网/首次未预下载时有加载态，失败可重试
