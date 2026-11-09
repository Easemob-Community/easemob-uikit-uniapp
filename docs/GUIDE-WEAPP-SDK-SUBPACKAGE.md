# 微信小程序分包接入

这页帮助你在 uni-app x 宿主中完成两类微信小程序分包：`sub-im` 承载页面，`sub-sdk` 承载环信 websdk。新工程可以直接使用已配置模板；既有工程复用同一套脚本完成构建后处理和检查。

> 微信基础库需 ≥ 2.11.2。当前示例锁定 `easemob-websdk@5.2.0`，HBuilderX 内置 CLI 与 esbuild 即可完成后处理，无需新增运行时依赖。

## 新工程：复制双分包模板

只需要单聊页面时，复制 `templates/chat-only` 为独立工程。模板已经包含：

- `sub-im/pages/chat/chat`：聊天页；
- `sub-sdk/pages/placeholder/placeholder`：SDK 分包加载页；
- `sub-sdk/im-sdk.js` 的构建后处理；
- 登录页 `preloadRule`；
- 公共/私有微信项目配置维护；
- 开发、构建和检查命令。

安装并配置：

```bash
npm install
```

填写 `common/im-config.ts` 的 `appkey`、`tokenEndpoint` 和对端资料，然后选择开发或构建：

```bash
# 开发：HBX dev + 分包 watch
npm run dev:mp

# 构建：HBX build + 分包后处理 + 检查
npm run build:mp

# 复查 build 产物
npm run check:mp
```

开发时打开 `unpackage/dist/dev/mp-weixin`，构建时打开 `unpackage/dist/build/mp-weixin`。不要把两个目录混用。

如果使用 HBuilderX GUI 编译，改为在一个终端持续运行 `npm run watch:mp`，再在 HBX 中“运行到微信开发者工具”。watch 会监控 `app.json`、SDK 文件和两层项目配置，发现重编译或配置改写后自动恢复。

## 既有工程：声明、命令、检查

### 1. 声明页面和 SDK 分包

在 `pages.json` 中把聊天页放入普通分包，并为 SDK 保留一个普通分包。两个分包都必须是 `independent: false`，页面路径按你的实际工程调整：

```json
{
  "pages": [
    { "path": "pages/login/login" }
  ],
  "subPackages": [
    {
      "root": "sub-im",
      "name": "sub-im",
      "independent": false,
      "pages": [
        { "path": "pages/chat/chat", "style": { "navigationStyle": "custom" } }
      ]
    },
    {
      "root": "sub-sdk",
      "name": "sub-sdk",
      "independent": false,
      "pages": [
        { "path": "pages/placeholder/placeholder" }
      ]
    }
  ],
  "preloadRule": {
    "pages/login/login": { "network": "all", "packages": ["sub-sdk"] }
  }
}
```

跳转到聊天页时使用 `/sub-im/pages/chat/chat`，不要继续使用主包旧路径。tabBar 页面留在主包；`sub-im` 只承载需要移出的非 tabBar 页面。每个分包至少声明一个页面，SDK 的加载页不需要跳转。

创建 `sub-sdk/pages/placeholder/placeholder.uvue`，以及 `sub-im` 中的实际页面。脚本不会替你推断或修改业务路由。

### 2. 复制统一脚本

把仓库 `skills/em-host-mp-subpackage/scripts/` 下的三个文件复制到宿主 `scripts/`：

- `mp-weixin.mjs`：统一命令编排；
- `prepare-sdk-subpackage.mjs`：SDK 转译、写入和项目配置维护；
- `check-mp-size.mjs`：分包与主包检查。

在宿主 `package.json` 增加：

```json
{
  "scripts": {
    "dev:mp": "node scripts/mp-weixin.mjs dev",
    "build:mp": "node scripts/mp-weixin.mjs build",
    "check:mp": "node scripts/mp-weixin.mjs check",
    "watch:mp": "node scripts/mp-weixin.mjs watch"
  },
  "dependencies": {
    "easemob-websdk": "5.2.0"
  }
}
```

然后执行 `npm install` 和 `npm run build:mp`。HBuilderX 不在默认位置时设置 `HBUILDERX_PATH`；需要单独指定 esbuild 时设置 `ESBUILD_BIN`。

### 3. 检查输出

`build:mp` 会依次执行 HBX 编译、SDK 后处理和检查。成功输出应包含：

- `sub-sdk` 普通分包与加载页；
- 已配置 `sub-sdk` 预下载；
- SDK 文件、CJS 导出和必需 Manager 导出；
- 公共/私有配置的两个 ignore 项均为 `false`；
- 主包无 SDK 特征串，跨分包 `require` 存活；
- 主包 ≤ 1.5MB，JS 语法通过。

检查器会打印实际检查的产物目录。单独复查 build 产物用 `npm run check:mp`。

## 常见报错

| 症状 | 原因与处理 |
|---|---|
| 微信提示“项目根目录未找到 `app.json`” | HBX 编译没有成功产出完整工程。先修复 HBX 控制台中的模板/脚本错误，再运行后处理；不要手工补一个空 `app.json`。 |
| `module 'sub-sdk/im-sdk.js' is not defined` | 先确认当前 dev/build 目录存在该文件，再检查公共和私有配置的 `ignoreDevUnusedFiles/ignoreUploadUnusedFiles`。直接运行 prepare 和 check 定位。 |
| `project.config.json` 已是 false 仍报模块未定义 | 检查 `project.private.config.json`，私有配置会覆盖公共配置。当前 prepare 和 watch 会同时处理两层。 |
| dev 重编译后 SDK 消失 | 使用 `dev:mp`，或在 HBX GUI 编译期间保持 `watch:mp`。 |
| 点击聊天入口没反应或报页面不存在 | 页面已移入 `sub-im` 时，跳转路径必须改为 `/sub-im/pages/chat/chat`。 |
| 分包面板没有 `/sub-sdk/` | 检查 `subPackages` 层级、root 名称和 pages 数组；每个分包至少一个页面。 |
| `ChatClient is undefined` | SDK IIFE 全局名或导出结构发生变化；恢复 5.2.0，或按实际版本更新 prepare 的全局名和导出校验。 |
| 真机 `SyntaxError: Unexpected token .` | SDK 未降级到 ES2017；重新运行 prepare，不要用原始 IIFE 直接覆盖产物。 |
| `require is not a function` | 基础库低于 2.11.2，请升级微信基础库。 |
| 总包比分包前更大 | SDK 降级后体积会增长，评估时看主包是否下降，而不是看主包与分包总和。 |

## 为什么需要后处理

环信 websdk 静态导入会进入主包。分包方案把自包含 IIFE 转为 CJS 模块并放入 `sub-sdk`，运行时由 UIKit 使用微信原生 `require(path, success, fail)` 异步加载：

```text
主包                                sub-sdk
├─ 登录/会话等页面                  ├─ 加载页
├─ UIKit 与异步加载器        ──────▶└─ im-sdk.js
└─ preloadRule 触发预下载              （IIFE + module.exports，ES2017）
```

需要注意：

- SDK 体积被移到分包，不是被删除；首次加载需要下载和求值，`preloadRule` 可以把等待藏进登录页停留时间。
- 异步加载的文件不在静态依赖图中，因此两个“忽略未使用文件”开关必须关闭。
- 不要在宿主业务代码中再次静态 `import 'easemob-websdk'`，否则 SDK 会重新进入主包。
- 不要修改 UIKit 默认的 `../../../../sub-sdk/im-sdk.js` 相对路径，除非同时通过 `sdkLoader` 自管理加载。
- `unpackage/` 是生成目录，正式修改应落在源码配置和 `scripts/` 中。

## 升级 SDK

1. 用 `--save-exact` 安装明确版本并核对 lockfile。
2. 确认 `bundle/im-sdk-web.iife.js` 路径和全局名 `IMSDK` 未变化。
3. 运行 `npm run build:mp`，让 prepare 校验必需导出，让 check 验证分包、配置和主包体积。
4. 在微信开发者工具中验证登录、数据同步和消息收发，再覆盖 iOS/Android 真机。
