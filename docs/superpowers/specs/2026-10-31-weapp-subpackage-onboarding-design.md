# 微信小程序分包低操作接入设计

## 意图与背景

目标用户是使用 easemob-uikit-uni 的 uni-app x 宿主开发者。当前 SDK 分包和页面分包都有可工作的实现，但成功路径分散在 demo、chat-only 模板、宿主 Skill、不同版本的脚本和多份文档中。用户需要理解 dev/build 产物差异、手动维护 watch、处理微信公共/私有项目配置，并在报错后自行判断是编译、声明、文件生成还是运行时加载失败。

本次实际暴露的两个关键问题：

- `project.private.config.json` 的 `ignoreDevUnusedFiles: true` 会覆盖公共配置，使异步加载的 `sub-sdk/im-sdk.js` 被剔除。
- 宿主模板编译失败会导致 `app.json` 缺失；微信随后报出的“未找到 app.json”是上游编译失败的结果，不是分包机制本身的问题。

目标是让新宿主可以复制已配置工程并用一条命令完成开发/构建/检查，让既有宿主可以用一条命令得到明确、可执行的诊断，而不是要求所有用户先理解完整分包原理。

## 目标

- `templates/chat-only` 同时覆盖 `sub-im` 页面分包与 `sub-sdk` SDK 分包，复制到仓库外也能自包含运行。
- 模板提供 `dev:mp`、`build:mp`、`check:mp`，分别串联开发监听、构建后处理和产物验收；HBuilderX GUI 用户可用持续 watch 配合。
- SDK 后处理同时维护公共和私有微信项目配置，保留其他设置，并监控这些配置在开发期被改写的情况。
- 检查器能区分编译产物缺失、分包声明错误、SDK 文件/导出缺失、异步 require 缺失、配置覆盖、主包超限，并给出对应修复动作。
- 新用户文档只有一条主路径；既有用户按“声明 → 命令 → 检查”接入；原理保留在进阶文档。
- 根仓库、宿主 Skill 和模板使用同一套脚本，避免修复漂移。

## 非目标与反目标

- 不自动改写任意宿主的 `pages.json`、路由或 tabBar；JSONC、已有分包和业务路由无法安全推断。
- 不另建一套完整 IM 模板；完整能力继续使用 `demo/`，最小工程复用 `chat-only`。
- 不改变 UIKit 的 SDK 异步加载协议、默认分包路径或运行时 API。
- 不支持经典 uni-app/VDOM，不消除 HBuilderX/微信开发者工具依赖，不新增运行时依赖。
- 不把“手改 unpackage 产物”作为正式接入步骤，不以文档堆叠代替可执行检查。

## 方案比较与选择

### A. 只补脚本和文档

修复私有配置并补充排错说明。改动最小，但用户仍需手工组织命令和维护 watch，不能达到低操作目标。

### B. 可运行模板 + 统一命令 + 既有项目检查器（已选择）

新用户从预置两类分包的模板开始；模板自包含 Node 脚本，一条命令完成编译、后处理和检查。既有项目复用相同脚本获得诊断。成功率来自固定、经过构建验证的默认路径，而不是自动猜测宿主工程结构。

### C. 一键安装器自动修改任意宿主

操作看似最少，但需要处理 JSONC、路由、tabBar 和既有分包，容易破坏宿主工程，不采用。

## 工程设计

### 1. 最小模板同时包含两类分包

- 将 `templates/chat-only/pages/chat/chat.uvue` 移到 `templates/chat-only/sub-im/pages/chat/chat.uvue`。
- `pages.json` 保留 `sub-sdk`，新增普通分包 `sub-im`，聊天页从主包页面清单移入 `sub-im`；登录后的跳转路径同步改为 `/sub-im/pages/chat/chat`。
- `sub-im` 与 `sub-sdk` 都必须 `independent: false`；tabBar/启动页规则不被模板改变。
- 模板复制到仓库外后，其 `scripts/` 仍可直接运行，不依赖原仓库相对路径。

### 2. 统一宿主命令

模板 `package.json` 提供：

- `npm run dev:mp`：启动 SDK 后处理 watch，再启动 HBuilderX 内置 CLI 的 mp-weixin dev；进程退出时回收 watch。
- `npm run build:mp`：执行 mp-weixin build，随后执行 SDK 后处理和完整检查。
- `npm run check:mp`：检查当前 build 产物并输出逐项结果。
- `npm run watch:mp`：仅为 HBuilderX GUI dev 产物持续执行后处理，供坚持使用 GUI 编译的用户配合打开。

命令由自包含 `scripts/mp-weixin.mjs` 编排，继续复用 HBuilderX 内置编译器和 esbuild。`HBUILDERX_PATH`/`ESBUILD_BIN` 用于非默认安装位置；无法定位时给出明确配置提示。

### 3. 强化 SDK 后处理

统一后的 `prepare-sdk-subpackage.mjs`：

- 在写文件前验证当前产物目录包含 `app.json` 与 `project.config.json`，目录错误或上游编译失败时直接给出可读错误。
- 保留 IIFE 全局名校验、CJS 导出、ES2017 降级和必需导出真实 require 校验。
- 对 `project.config.json` 和已存在的 `project.private.config.json` 强制设置 `ignoreDevUnusedFiles/ignoreUploadUnusedFiles = false`，其他配置不变。
- watch 同时跟踪 `app.json`、SDK 文件和两层项目配置；任一被重编译或开发者工具改写后重新执行后处理，而不只监控 `app.json`。
- 保留仓库已有的位置参数兼容，同时支持宿主版 `--project/--out/--sdk/--esbuild` 参数。

### 4. 检查器与诊断

扩展现有 `check-mp-size.mjs`，复用为 `check:mp`：

- `app.json` 不存在或不可解析时，明确提示先修复 HBuilderX 编译错误，不继续制造级联误报。
- 校验 `sub-sdk` 普通分包、占位页、登录页 `preloadRule`；声明了 `sub-im` 时同样校验其为普通分包。
- 校验 SDK 文件、CJS 导出、ES2017 降级、必需导出、跨分包 require 和主包无 SDK 特征串。
- 公共配置必须关闭两个 ignore 项；私有配置存在时也必须关闭，避免“公共 false、私有 true”的假成功。
- 保留主包体积阈值和 JS 语法检查。
- 模板额外断言聊天页位于 `sub-im`，确保两类分包都不会在后续同步中退化。
- 每项失败附带对应文件和修复动作；成功时输出实际检查的产物目录，避免 dev/build 混淆。

### 5. 脚本单源与同步

- 根仓库 `scripts/` 保存脚本的权威实现。
- 新增同步脚本，将 prepare、check 和命令编排脚本复制到 `skills/em-host-mp-subpackage/scripts/` 与 `templates/chat-only/scripts/`。
- 同步脚本支持 `--check`，纳入模板结构门禁，防止三处实现漂移；生成文件不分别手改。

### 6. 文档与内部契约

- `templates/chat-only/README.md`：以复制、安装、配置、`dev:mp`/`build:mp` 为主路径，说明 GUI watch 备选路径。
- `docs/QUICKSTART.md`：小程序部分先给可运行模板和统一命令，再链接进阶分包文档。
- `docs/GUIDE-WEAPP-SDK-SUBPACKAGE.md`：重组为新工程快速路径、既有工程接入、验证、报错诊断、原理；补私有配置覆盖与 app.json 缺失的因果关系。
- `docs/FAQ.md`、`skills/em-host-mp-subpackage/SKILL.md`、插件 readme：统一同一诊断与命令口径；生成的 Skills 文档由同步脚本生成。
- 按仓库纪律先更新 `PLAN.md` 的范围，再实施；更新内部分包 Skill 与 `docs/STATUS.md` 记录新契约和实际验证结果。

## 验证

- 先以缺失私有配置处理、缺失 app.json、页面仍在主包等负例验证检查器会失败，再实施修复。
- 模板结构检查、`check:mp`、web/mp build 全部通过；构建产物同时出现 `sub-im` 聊天页和 `sub-sdk/im-sdk.js`。
- 在 dev 产物中分别模拟 SDK 文件被删除、私有配置被改回 true，确认 watch 自动恢复。
- 运行文档、Skills、发布、配置和按需接入检查；Skills 生成文档保持同步。
- 记录实际主包/分包体积。没有专用模板测试账号时，只宣称编译、产物和既有 demo 登录链路已验证，不宣称模板真实收发已验证。

## 留给实施者的决定

- 脚本的具体函数拆分和命令输出措辞可随现有代码风格调整，但不能改变上述命令契约。
- 检查器的辅助函数可在同一文件内实现，不引入 JSONC 解析依赖；分包声明以编译后的 `app.json` 为主要检查对象。
