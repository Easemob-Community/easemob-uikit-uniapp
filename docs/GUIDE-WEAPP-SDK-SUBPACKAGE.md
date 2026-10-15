# 微信小程序 SDK 分包异步化实施指引

> 适用对象：接入 easemob-uikit-uni（或自行接入 easemob-websdk）的 uni-app x / 原生 / Taro 微信小程序工程。
> 本指引基于本仓库 M2.8 落地实践沉淀（2026-10-15），所有路径、脚本、体积数字均为实测值。
> 配套材料：`docs/SPIKE-SDK-SUBPACKAGE.md`（编译器行为 spike 记录）、`scripts/prepare-sdk-subpackage.mjs`（可直接拷贝的构建脚本）、`scripts/check-mp-size.mjs`（防回归检查）。

---

## 1. 背景与原理

### 1.1 要解决什么问题

微信小程序主包限制 **2MB**。环信 websdk 5.1.3 的 IIFE 产物就有 873KB，经 npm 静态导入后会被打包器整个收进主包 `vendor.js`：

```text
改造前：                    改造后：
┌─ 主包 1.77MB ─┐          ┌─ 主包 0.49MB（压缩后 0.52MB）─┐
│ vendor.js 942KB │        │  业务页面 + UIKit 组件        │
│ （含整个 SDK）  │   →    ├─ 分包 sub-sdk 1.23MB ────────┤
│ 页面 + 组件     │        │  im-sdk.js（SDK 整体）        │
└────────────────┘         └───────────────────────────────┘
```

而 IM 的业务场景里**消息列表页通常是 tabBar 页、无法移入分包**，静态导入意味着 SDK 永远进主包。Tree Shaking 在这一层基本无效（`ChatClient` 从根入口导入、Manager 注册制、SDK 内部模块组织不利于静态裁剪）。

### 1.2 核心思路

> 不再要求构建工具从 SDK 里删代码，而是让 SDK 完整代码**不进主包**，运行时通过小程序「分包异步化」能力按需加载。

微信小程序基础库 2.11.2+ 支持**跨分包 JS 引用**：用小程序原生的回调式 `require(path, successCb, failCb)` 引用另一个分包（含主包引用分包）里的 JS 模块，引用时自动触发分包下载。体积归属从「SDK → 主包」变成「SDK → 普通分包」。

三个关键认知：

1. **体积不消失，只是搬家**。SDK 还是 1.2MB，但首启只下载主包（几百 KB），分包在用到 IM 前后台预下载。
2. **运行时加载，不是构建时拆包**。SDK 文件以「自包含 CJS 模块」形式物理放在分包目录里，不走 bundler。
3. **加载链路必须全异步**。SDK 加载 → ChatClient.init → login 是三件事，各缓存一个 Promise。

### 1.3 不适用场景

- 期望缩小 SDK 本体体积（这是搬家不是减肥）；
- 宿主所有页面都必须在首帧可用 IM（异步化必然带来首次加载等待，只能靠预下载缓解）；
- 微信基础库 < 2.11.2 的老环境。

### 1.4 副作用与权衡（必读）

分包异步化是用「主包体积」换「首次加载体验 + 工程复杂度」，接受方案前请逐条确认能容忍：

**① 首次进入 IM 有真实的加载等待。** SDK 分包 1.2MB（压缩后约 1MB），首次使用 IM 功能前必须下载 + 解析 + 执行：
- 正常网络 + `preloadRule` 预下载命中：等待被藏进登录页停留时间里，用户**无感知**；
- 预下载未完成就点了登录/进入会话：等待显式暴露，表现为登录按钮长时间「登录中…」，弱网下可能 2~5 秒；
- 下载失败（弱网、超包）：IM 直接不可用，**静态打包没有这种失败模式**——必须做失败重试与兜底文案（§4.7）。

**② 整包体积不减反略增。** SDK 从主包 vendor 里移出时带走的是压缩后的体积，进入分包的是 es2017 降级产物（`?.` 展开后比 IIFE 源大 40%，本仓实测 873KB→1234KB）。整包上传口径：改造前 1336KB → 改造后 1621KB（多出来的约 300KB 是降级膨胀 + 产物未压缩所致）。**判断收益永远看主包那一行，不看总包。**

**③ 构建链路多了一个产物后处理环节。** IIFE 拷贝降级、project.config.json patch 都挂在构建后，意味着：HBuilderX GUI 起的 dev 编译**不会**自动执行这些钩子（本仓实测踩坑）；CLI dev（`uni.sh dev mp-weixin`）已自动伴随 `prepare-sdk-subpackage.mjs --watch`（轮询产物 app.json，全量重发抹掉 im-sdk.js 后自动重拷），GUI dev 需手动挂一次 `--watch`；SDK 升级必须过 §8 检查清单，不能像普通 npm 依赖一样升完即走。

**④ 调试与报错模型变了。** SDK 代码不再出现在主包依赖图里：微信开发者工具的代码依赖分析、上传时的 unused 检查都会「看不到」它（所以要关 ignore 开关，§4.4）；断点要打进分包文件；报错从「启动即暴露」变成「首次用 IM 才暴露」（且表现形式是 `module is not defined` 这类模块系统错误，不直观）。

**⑤ 代码约束多了一条硬规则。** 全工程运行时（非 `import type`）SDK 导入只能出现在加载器一个文件里；异步 `require` 的路径**相对编译产物**写死，移动调用文件必须同步改路径，无任何编译期校验（错了真机才炸）。新人改这块代码时需要文档护航。

**⑥ 运行时多一次大文件 JS 求值。** 分包下载完成后，微信要把 1.2MB 的 im-sdk.js 当 CJS 模块求值一次，首进 IM 有百毫秒级的解析执行开销（之后模块常驻内存，后续进入零成本）。低端机上如果用户在分包还没下载完就反复点按，注意入口要做幂等（Promise 缓存即为此设，§4.5）。

**⑦ 基础库地板 2.11.2。** 更老的基础库不支持分包异步化，`require` 三参回调不存在——表现是「点了没反应/报 require is not a function」。业务有老基础库存量用户时，加载器里要做特性检测并给降级文案（如提示升级微信），不要静默失败。

一句话总结：**主包从 1.77MB 降到 0.52MB 的收益是真实的，代价是「IM 首次可用时间」从 0 变成「分包下载时间（通常被预下载藏掉）」，外加一条需要维护的产物后处理链路。** 业务形态是「IM 重启动即用」（如客服工作台首屏就要聊天）时，应评估「启动即加载分包」（在 app.js/首页就触发 require，牺牲一部分主包收益换零等待）是否更合适。

---

## 2. 方案总览

```text
主包                          普通分包 sub-sdk
├── app.js                    ├── pages/placeholder/   （占位页，分包声明必需）
├── 消息 tabBar 页             └── im-sdk.js            （SDK IIFE + module.exports，
├── 其它主包页面                                         esbuild 降 es2017）
├── UIKit 组件/库（无 SDK 静态依赖）
└── SDK 异步加载器（libs/client/sdk.ts）
         │  运行时：require('../../../../sub-sdk/im-sdk.js', cb, failCb)
         ▼
  分包下载（或 preloadRule 已预下载）→ 模块导出 → ChatClient.init → login
```

运行流程：

```text
小程序启动
  → 进入登录页（preloadRule 触发 sub-sdk 预下载，后台进行）
  → EmKit.init()（同步部分立即生效；SDK 依赖部分挂就绪门）
  → await EmKit.login()（内部先等 SDK 分包加载 + ChatClient.init）
  → 登录成功，跳会话列表
```

---

## 3. 前置条件 checklist

| # | 条件 | 验证方式 |
|---|---|---|
| 1 | 微信基础库 ≥ 2.11.2（开发者工具模拟器设置里看） | 模拟器右上角 ··· → 设置 |
| 2 | SDK 精确锁版，不用 `^/~` | `package.json` 里是 `"5.1.3"` 这种纯三段式 |
| 3 | 工程已配置普通分包（`independent: false`，**不要独立分包**） | 见 §4.2 |
| 4 | 能拿到 SDK 的自包含 IIFE 产物 | websdk ≥ 5.x：`node_modules/easemob-websdk/bundle/im-sdk-web.iife.js`（**版本敏感路径，升级必核**） |
| 5 | 主包代码里**零 SDK 静态导入**（见 §5.1） | 全文搜 `from 'easemob-websdk'`，运行时导入只允许出现在加载器一个文件里 |
| 6 | 有 esbuild（或 Babel）可做语法降级 | 本方案复用 HBuilderX 内置 esbuild，零新依赖 |

---

## 4. 关键步骤

### 4.1 锁定 SDK 版本

```bash
npm install easemob-websdk@5.1.3 --save-exact
```

锁版的原因：IIFE 文件路径、全局变量名（`IMSDK`）、导出结构都随版本变化。升级流程见 §8。

### 4.2 声明普通分包（pages.json）

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

- **每个分包至少一个页面**——微信要求 `pages` 非空，占位页永不跳转，纯粹为满足结构。
- **`independent` 必须 false**（独立分包不能被子包外的代码引用，官方也不推荐用它承载共享 SDK）。
- **`preloadRule` 是声明式预下载**：进入登录页就后台下载 sub-sdk，把「首次用 IM 的等待」藏进用户填表的时间里。`network: all` 表示非 WiFi 也预下载（按业务取舍）。
- 页面分包（把 chat 等非 tabBar 页挪进另一个分包）是**可选项**，与 SDK 分包互相独立，各算各的体积。

### 4.3 准备可异步加载的 SDK 模块（构建后处理）

微信的异步 `require` 加载的是**包内 CJS 模块**。直接把 SDK 的 ESM 源文件拷进去会缺依赖，必须用自包含 IIFE，并在尾部追加 CJS 导出：

```js
// im-sdk-web.iife.js 头：var IMSDK=function(e){...}({})
// 尾部追加：
module.exports = IMSDK;
```

**语法降级必须做**：实测 websdk 5.1.3 的 IIFE 内含 `?.` 和 `??`（ES2020），旧基础库真机 JSC 会抛 `SyntaxError: Unexpected token .`。用 esbuild 转 es2017（复用 HBuilderX 内置二进制，零新依赖）：

```bash
# 等价命令（实际脚本见 scripts/prepare-sdk-subpackage.mjs，可直接拷贝）
cat im-sdk-web.iife.js <(echo 'module.exports=IMSDK;') | \
  /Applications/HBuilderX.app/Contents/HBuilderX/plugins/uniapp-cli-vite/node_modules/.bin/esbuild \
  --loader=js --target=es2017 --format=cjs > sub-sdk/im-sdk.js
```

降级后产物约 1234KB（比 IIFE 源大是正常的——`?.` 展开成三元表达式会变长，不影响运行）。

### 4.4 关闭「未使用文件忽略」（**头号踩坑**）

`sub-sdk/im-sdk.js` 只被异步 `require` 引用，**不在微信开发者工具的静态依赖图里**。工具默认开启「未使用文件忽略」（依赖分析），会把这个文件从包内剔除，模拟器/真机报：

```text
module 'sub-sdk/im-sdk.js' is not defined, require args is 'sub-sdk/im-sdk.js'
```

必须在产物的 `project.config.json` 里关闭两项（uni-app 工程每次编译会重新生成它，所以这一步要挂在**构建后处理**里做，别手改）：

```json
{
  "setting": {
    "ignoreDevUnusedFiles": false,
    "ignoreUploadUnusedFiles": false
  }
}
```

> 排查此类报错的第一件事：**确认开发者工具打开的产物目录里这个文件真的存在**。本仓实测踩过「工具开着 `dist/dev` 而构建后处理只挂在 build 模式」的坑——dev 编译不触发后处理，SDK 文件根本没被拷进去，报错一模一样。CLI dev 现走 `uni.sh dev mp-weixin` 会自动伴随 `--watch` 重拷（增量重发不抹文件、全量重发自动补）；GUI dev 或手动跑 watch 的场景，确认产物里 `sub-sdk/im-sdk.js` 存在且非 0 字节。

### 4.5 库/业务侧的 SDK 异步加载器

全工程**只允许一个文件**出现 `easemob-websdk` 的运行时（非 `import type`）导入。uni-app x 下用条件编译做双实现（本仓 `libs/client/sdk.ts`）：

```ts
// #ifndef MP-WEIXIN
// 非小程序端：静态直通（现状等价），SDK 随宿主正常打包
import * as staticSdkModule from 'easemob-websdk'
export function ensureSdkModule() {
  return Promise.resolve(staticSdkModule)
}
// #endif

// #ifdef MP-WEIXIN
// 小程序端：无任何 websdk 静态依赖，运行时跨分包异步加载
let modulePromise: Promise<any> | null = null

export function ensureSdkModule(): Promise<any> {
  if (modulePromise != null) return modulePromise
  modulePromise = new Promise((resolve, reject) => {
    // @ts-ignore —— require 是微信模块作用域注入（非全局、非 node），TS 不认识
    require('../../../../sub-sdk/im-sdk.js',
      (mod: any) => resolve(mod?.default ?? mod),
      (err: any) => reject(new Error('IM SDK 分包加载失败: ' + (err?.errMsg ?? '')))
    )
  }).catch((e) => { modulePromise = null; throw e })  // 失败清缓存，允许重试
  return modulePromise
}
// #endif
```

四个必须遵守的细节：

1. **裸 `require(path, cb, failCb)` 三参回调写法**才能存活到产物：uni-app（vue3/vite 管线）与 uni-app x 都不会改写它（路径在源码侧不存在、产物侧才存在，bundler 解析不了就原样保留）。不要用 `import()`（uni-app x 不支持动态 import），不要拼 `globalThis.require`（微信的 `require` 是模块作用域参数，不是全局变量）。
2. **路径是相对于「编译产物中调用文件」的位置**，不是源码位置。经验值：
   - 主包页面 `pages/x/x.uvue` → 产物 `pages/x/x.js` → `../../sub-sdk/im-sdk.js`
   - 库文件 `uni_modules/<id>/libs/client/sdk.ts` → 产物多四层嵌套 → `../../../../sub-sdk/im-sdk.js`
   - 分包内页面 `sub-im/pages/x/x.uvue` → `../../../sub-sdk/im-sdk.js`
   - **移动调用文件必须同步改路径**——没有任何编译期校验，错了只能真机报。
3. **Promise 缓存 + 失败重置**：防并发重复加载；失败后清缓存让下次调用重试。
4. **导出校验**：拿到模块后检查 `ChatClient/ChatManager/ContactManager/UserInfoManager/PushManager/setConsoleLogEnabled/setLogLevel` 是否齐全，缺了立刻抛错（升级 SDK 改了导出结构时，构建期/运行期快速失败，而不是等到 `ChatClient.init` 才报 undefined）。

> 宿主想自管理加载（自定义分包路径、自行 `wx.loadSubpackage` 预下载等），给 `ensureSdkModule` 留一个注入口（本仓为 `EmKitConfig.sdkLoader / sdkModule`，`sdkModule` 优先），**不要**让宿主去改默认路径常量。

### 4.6 初始化三阶段就绪门

SDK 加载、ChatClient 初始化、登录是三个阶段，各自的 Promise 分开缓存（本仓 `libs/client/index.ts` 模式）：

```ts
init(config) {
  // 同步部分保持同步生效：UI 配置、logger 级别
  applyKitConfig(config); setLogLevel(config.logLevel)
  // SDK 依赖部分挂就绪门（非小程序端是微任务级直通，行为不变）
  this.initPromise = this.doInit(config)
}

private async doInit(config) {
  const sdk = await ensureSdkModule()              // 阶段一：SDK 模块（分包异步）
  sdk.setLogLevel(...); sdk.setConsoleLogEnabled(...)
  const client = sdk.ChatClient.init({ ... })      // 阶段二：client 初始化
  client.addEventHandler('emkit-connection', {...})
  return client
}

async login(options) {
  const client = await this.whenReady()            // 等阶段一+二
  await client.login(options)                      // 阶段三：登录
}
```

配套的两个工程细节：

- **所有依赖 SDK 的入口先 `await whenReady()`**（send/loadHistory/sync 等），否则分包还没下载完就调用会误报「未初始化」。
- **bind/事件注册挂在 init 的就绪续体里**，且这个续体在 `init()` 内挂上——Promise 回调按挂载顺序执行，保证 SDK 事件处理器的注册时序先于业务后续调用。
- ChatClient.init 失败（如 appkey 非法）从「同步抛错」变成「经 whenReady 以 rejection 浮现」——业务在 login 处统一 catch 即可；失败后要清缓存允许重试。

### 4.7 加载态 UX

> 本节是 §1.4 副作用① 的缓解手段：等待无法消除，只能藏掉或给足反馈。

首次未预下载成功时（弱网/首次进入即点），用户会真实等待分包下载。至少给出：

```text
正在加载消息服务…   （SDK 分包下载/初始化中，按钮 loading 态即可覆盖）
消息服务加载失败，点击重试   （ensureSdkModule 失败重抛，第二次 init 会重试）
```

进登录页后 `preloadRule` 预下载成功的话，这段等待通常被完全藏掉。判断是否需要重试：catch 到加载失败后重置 init 缓存，允许用户再触发一次 init。

---

## 5. 如何确认分包成功（验证指引）

按顺序做，每层都过才算稳：

### 5.1 产物静态检查（防回归脚本，最便宜）

本仓 `scripts/check-mp-size.mjs`（挂构建后自动跑），11 项断言全绿：

```text
✓ websdk 精确锁版（demo/package.json = "5.1.3"）
✓ SDK 分包文件存在（sub-sdk/im-sdk.js）
✓ 分包含 module.exports
✓ 分包无 ?. 残留（esbuild 降级生效）
✓ 未使用文件忽略已关闭（ignoreDevUnusedFiles/ignoreUploadUnusedFiles = false）
✓ 主包体积 ≤ 1.5MB（主包 493KB，分包合计 1263KB）
✓ 主包 vendor.js 无 SDK 特征串（msync）
✓ 跨分包 require 引用存活（产物中存在 sub-sdk/im-sdk.js 引用）
✓ 语法通过 app.js / vendor.js / im-sdk.js（node --check）
```

自己实现时至少覆盖：**SDK 特征串不在主包**（websdk 协议层特征如 `msync`、版本号 `5.1.3`）、**产物里存在指向分包的 require 引用**、**分包文件存在且语法检查通过**。

### 5.2 开发者工具面板确认

1. **项目配置 → 基本信息**：「路径/大小」列表应把每个分包单独列出来（本仓实测：主包 861KB、/sub-im/ 42.4KB、/sub-sdk/ 1234.7KB，合计与「本地代码」对得上账）。只显示一行「主包 N MB」而没有分包行 = 分包没声明成功。
2. **预览 → 代码包明细**：弹窗里逐包列出**压缩后**上传体积（本仓实测：主包 520.6KB、/sub-sdk/ 1070.4KB、/sub-im/ 30.2KB）。判断标准：主包 ≪ 2MB，SDK 那 1MB 在分包行里。
3. **Console 启动日志**：出现 `preloadSubpackages: sub-sdk` + `preloadSubpackages: success` 说明预下载生效；`No. of subpackages: 2` 说明声明被识别。

### 5.3 运行时冒烟（模拟器即可）

放一个免登录的探针（本仓 demo spike 页「加载 SDK 分包探针」按钮）：

```ts
// @ts-ignore
require('../../sub-sdk/im-sdk.js', (mod) => {
  const sdk = mod?.default ?? mod
  // 校验 ChatClient 等核心导出齐全后提示成功
}, (err) => { /* 展示失败原因 */ })
```

然后再走真实业务链路：登录页提交 → 观察「登录中…」→ 进入会话列表有真实数据、Console 有 SDK 日志——证明「分包加载 → ChatClient.init → login → 数据同步」全通。

### 5.4 真机验收

- iOS / Android 各扫一次预览码，重点看旧机型（语法降级 es2017 就是为旧 JSC 准备的）；
- 首次进入 IM 的等待可接受（预下载成功的标志：进聊天页无感知）；
- 登录、收发消息、断网重连、杀进程重进各过一遍。

---

## 6. 常见报错排查表

| 报错 | 根因 | 处理 |
|---|---|---|
| `module 'sub-sdk/im-sdk.js' is not defined, require args is '...'` | ① 依赖分析把文件剔了（§4.4 开关没关）；② 工具打开的产物目录里没有这个文件（dev/build 目录搞错、后处理没跑） | 先 `ls` 确认文件存在于**当前工具打开的产物目录**，再查 project.config.json 两个 ignore 开关 |
| `SyntaxError: Unexpected token .`（真机） | 分包产物含 `?.`/`??`，旧基础库不支持 | esbuild 降级是否真跑了（检查产物里 `?.` 计数为 0） |
| `ChatClient is undefined` | IIFE 全局名变了 / 没追加 module.exports / 模块被 default 包装 | 核对 SDK 版本的全局名；`mod?.default ?? mod` 兼容 |
| 登录报「call EmKit.init() first」 | SDK 入口方法没走 whenReady 就绪门，分包还没下载完就调用了 | 所有 SDK 依赖入口前置 await 就绪门（§4.6） |
| 分包声明了但面板不显示分包行 | `subPackages` 写错层级 / `pages` 为空 / 写成了 `subpackages`（大小写） | 对照 §4.2，占位页必须有 |
| 预览时整包比改造前还大 | 正常——SDK 搬进了分包，总包 = 主包+分包之和；对比要看**主包**那一行 | 看 §5.2 的逐包明细 |

---

## 7. 体积参考基线（本仓 demo 实测，2026-10-15）

| 指标 | dev 产物（未压缩） | build 产物（压缩） | 预览上传（压缩） |
|---|---|---|---|
| 主包 | 861KB | 493KB | **520.6KB** |
| /sub-sdk/ | 1234.7KB | 1234KB | 1070.4KB |
| /sub-im/（页面分包） | 42.4KB | ~30KB | 30.2KB |
| 合计 | 2139KB | ~1760KB | 1621KB |

结论：主包从 1.77MB 压到 0.52MB（上传口径），距 2MB 上限余量 74%。

---

## 8. SDK 版本升级流程

升级 `easemob-websdk` 时不要只 `npm install` 完事，按清单走：

1. 精确版本安装（`--save-exact`），核对 lockfile；
2. **确认 IIFE 文件路径**（`bundle/im-sdk-web.iife.js` 可能改名）；
3. **确认 IIFE 全局名仍为 `IMSDK`**——本仓 prepare 脚本会校验前缀，变了会在构建期直接抛错（防回归第一关）；
4. 确认所需 Manager 导出齐全（prepare 脚本的 require 探针会替你验）；
5. 重新构建，跑防回归检查（§5.1）；
6. 模拟器 + 双端真机回归：登录、会话/联系人同步、消息收发、断网重连、token 过期。

## 9. 回滚方案

分两层，互不影响：

- **SDK 版本回滚**：`npm install easemob-websdk@<旧版> --save-exact`，重新构建发布。
- **分包架构回滚**（放弃异步化）：移除 `subPackages` 里的 sub-sdk 声明与 preloadRule、删掉产物后处理钩子、库侧加载器恢复静态导入（把 `#ifndef MP-WEIXIN` 的直通实现设为全端通用）、宿主恢复 `EmKit.init` 后同步可用。回滚后务必重新核对主包体积是否仍低于 2MB——这正是当初做分包的原因。

---

## 10. 本仓落地物索引

| 资产 | 位置 | 作用 |
|---|---|---|
| SDK 分包构建后处理 | `scripts/prepare-sdk-subpackage.mjs` | IIFE 校验/追加导出/esbuild 降级/拷入分包/patch project.config.json/导出探针，零依赖可整段拷贝 |
| 防回归检查 | `scripts/check-mp-size.mjs` | §5.1 的 11 项断言，`uni.sh build mp-weixin` 后自动执行 |
| 构建钩子 | `scripts/uni.sh` | build mp-weixin 成功后依次执行上述两脚本 |
| 库侧 SDK 加载器 | `uni_modules/easemob-uikit-uni/libs/client/sdk.ts` | 条件编译双实现 + 默认跨分包 require + 导出校验 |
| 三阶段就绪门 | `uni_modules/easemob-uikit-uni/libs/client/index.ts` | load→init→login Promise 缓存、失败重试 |
| 宿主注入口 | `EmKitConfig.sdkLoader / sdkModule`、`EmKit.whenReady()` | 自管理加载 / 加载态占位 |
| demo 接线样例 | `demo/pages.json`（subPackages + preloadRule）、`demo/sub-im/`、`demo/sub-sdk/` | 可直接照抄的配置 |
| 编译器行为记录 | `docs/SPIKE-SDK-SUBPACKAGE.md` | 6 条实测事实 + 2 条运行时踩坑 |
