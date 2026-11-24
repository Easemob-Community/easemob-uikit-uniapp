# uni_modules 通用发布 CLI 设计

## 目标与约束

为 UIKit 提供仓库内统一发布入口，复用 HBuilderX 官方 `uni_modules` 校验、dry-run 和正式发布能力，避免再次使用网页 ZIP 通道。脚本只使用 Node.js 内置模块，不新增依赖，不自行实现市场协议。

## 方案

采用薄封装：参数指定插件 ID、宿主工程、更新日志和 HBuilderX CLI；默认仅执行校验与 dry-run，显式 `--publish` 时才在相同检查后正式发布。备选方案是直接记录三条原始命令，但容易遗漏 dry-run 或误发；网页接口不属于官方 uni_modules CLI 通道，不采用。

## 行为

- 默认读取仓库 `demo` 与 `easemob-uikit-uni`，允许通过参数覆盖。
- 优先使用 `--cli` 或 `HBUILDERX_CLI`，macOS 使用 HBuilderX 默认 CLI 路径。
- 发布前读取本地插件版本；正式模式依次执行 validate、dry-run、publish，任一失败立即停止。
- 更新日志支持命令行文本或 UTF-8 文件，两种方式互斥。
- 保留官方 JSON 输出并检查 `success` 与 `outcome`，不仅凭进程退出码判断成功。
- 现有 `check-release.mjs` 继续负责版本物料门禁，新脚本不复制该职责。

## 验证

以临时假 CLI 记录调用参数并返回官方形态 JSON，覆盖默认不发布、正式发布顺序、自定义参数、失败中断和参数错误；最后用真实 HBuilderX CLI 对 UIKit demo 执行 validate 与 dry-run，不执行真实发布。同步更新 `em-plugin-publishing` Skill 和 RELEASE 手册。
