# SPIKE：微信小程序 SDK 分包异步化（编译器行为验证记录）

> 对应 PLAN.md M2.8。参照《环信 IM SDK 接入微信小程序分包异步化实施指南》，机制按 uni-app x 等价翻译后的产物级验证。
> **实施指引见 `docs/GUIDE-WEAPP-SDK-SUBPACKAGE.md`（关键步骤/验证方法/排查表/升级回滚），本文档只记录验证过程与实测事实。**
> 日期：2026-10-15；编译器：HBuilderX 5.26 内置 uniapp-cli-vite（`scripts/uni.sh` 封装）。

## 结论

**可行，构建级全部验证通过。** websdk 5.1.3（IIFE 873KB）完全移出主包，主包 `common/vendor.js` 从 942KB 降到 169KB。

| 指标 | 改造前 | 改造后 |
|---|---|---|
| 主包总体积 | 1768KB | ~1000KB（页面进一步入 `sub-im` 分包后更低） |
| `common/vendor.js` | 942KB | 169KB |
| SDK 落点 | 主包 vendor.js | `sub-sdk/im-sdk.js`（1234KB，含 esbuild es2017 降级 + `module.exports=IMSDK`） |
| 主包 SDK 特征串（`msync`） | 有 | 0（仅分包内） |

## 验证过的编译器行为（关键事实）

1. **裸 `require(path, cb, fail)` 三参回调写法可存活**：在 `.uvue` 的 `<script setup lang="ts">` 中直接书写，uni-app x → mp-weixin（VDOM 管线）编译后原样保留在页/库产物中，rollup 不会解析改写（路径在源码侧不存在、产物侧才存在）。TS 侧需 `// @ts-ignore`（`require` 非全局，是微信模块作用域注入）。官方依据：[DCloud 分包异步化文档](https://uniapp.dcloud.net.cn/tutorial/miniprogram-subcontract-asynchrony.html)（uni-app 与 uni-app x 均支持，文档示例即在 `(u)vue` script 中）。
2. **相对路径基准 = 编译产物中调用文件的位置**：
   - 页面 `pages/x/x.uvue` → `dist/pages/x/x.js` → 引用根级分包写 `../../sub-sdk/im-sdk.js`；
   - 库文件 `uni_modules/easemob-uikit-uni/libs/client/sdk.ts` → `dist/uni_modules/.../libs/client/sdk.js` → 写 `../../../../sub-sdk/im-sdk.js`；
   - 分包内页面 `sub-im/pages/x/x.uvue` → `../../../sub-sdk/im-sdk.js`。
   **移动调用文件所在目录时必须同步改路径**（无编译期校验，错了真机才报）。
3. **分包声明走 pages.json 标准 `subPackages`**（`independent: false` 普通分包），每个分包至少一个占位页；`preloadRule` 声明式预下载可用。产物 `app.json` 正确透传。
4. **IIFE 转 CJS**：`var IMSDK=function(e){...}({})`，尾部追加 `module.exports=IMSDK` 后经微信模块包装即可 `require` 到导出。IIFE 内含 `?.`/`??`（SDK 5.1.3 实测各 1 处），**必须语法降级**（esbuild `--target=es2017`，复用 HBuilderX 内置 esbuild，零新依赖）。
5. **库侧条件编译收口可行**：`libs/client/sdk.ts` 用 `// #ifdef MP-WEIXIN / #ifndef MP-WEIXIN` 双实现（小程序端无任何 websdk 运行时导入；其它端 `import * as` 静态直通），产物中 MP 分支不含 SDK 依赖，vite/rollup 也不会把 websdk 拉进主包。全库其余 SDK 引用本就只有 `import type`（类型擦除，不占产物）。
6. **`EmKit.init` 同步签名可保持**：UI 配置与 logger 级别仍同步生效；`ChatClient.init` 推迟到 `ensureSdkModule()` 就绪后（`whenReady()` 就绪门），非小程序端为微任务级直通，行为不变。

## 运行时冒烟（微信开发者工具模拟器，2026-10-15 实测通过）

- 登录页「登录中…」→ 自动 switchTab 进会话列表，真实会话渲染（摘要/时间），控制台 `[emkit:sdk] Contact sync` 结构化日志正常——**init → 分包 require 加载 websdk → ChatClient.init → login → 会话/联系人同步全链路通过**。
- 分包预下载 `preloadSubpackages: sub-sdk` success。

### 两个实测踩坑（重要）

1. **`project.config.json` 依赖分析开关**：异步 require 的 SDK 文件不在静态依赖图，微信开发者工具的「未使用文件忽略」默认会把剔除，报 `module 'sub-sdk/im-sdk.js' is not defined`。需在产物 `project.config.json` 设 `ignoreDevUnusedFiles: false` + `ignoreUploadUnusedFiles: false`（prepare 脚本自动 patch，check 脚本断言）。
2. **本机开发者工具打开的是 `unpackage/dist/dev/mp-weixin`**（HBuilderX dev watch 产物），不是 build 目录：dev 编译不触发 `uni.sh` 的 build 后处理，需手动跑一次 `node scripts/prepare-sdk-subpackage.mjs demo/unpackage/dist/dev/mp-weixin`（已写入 uni.sh 注释与本文档）。排查此类报错先确认工具打开的产物目录与 SDK 文件是否真实存在。

## 涉及的自动化检查

`scripts/check-mp-size.mjs`（挂在 `scripts/uni.sh build mp-weixin` 后，防回归）：

- websdk 精确锁版（禁 `^/~` 漂移）；
- `sub-sdk/im-sdk.js` 存在、含 `module.exports=IMSDK`、无 `?.`/`??` 残留；
- 主包 vendor.js 无 `msync` 特征串、产物中存在指向 `sub-sdk/im-sdk.js` 的 require 引用；
- 主包 ≤ 1.5MB（验证门禁阈值）；
- `node --check` 产物语法抽查。

## 已知边界

- 该方案只挪动体积归属，SDK 总大小不变（分包子包上限 2MB，IIFE 降级后 1234KB 无压力）。
- 首次进入 IM 功能有分包下载等待（`preloadRule` 已在进入登录页时预下载兜底）。
- SDK 升级流程：核对 IIFE 全局名仍为 `IMSDK`（prepare 脚本会替你失败）→ 重新 build → 检查导出校验与体积断言。
