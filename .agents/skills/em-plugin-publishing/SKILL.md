---
name: em-plugin-publishing
description: Use when publishing or updating easemob-uikit-uni through HBuilderX uni_modules commands, validating DCloud downloads and upgrades, or debugging incorrect component-root imports and missing update prompts.
---

# DCloud uni_modules 插件发布

## Overview

默认使用 **HBuilderX 官方 uni_modules 校验与发布通道**，不要把网页 ZIP 上传作为常规发布路径。`1.0.1` 与 `1.0.2` 的网页 ZIP 虽显示上传成功，管理列表却为“uni_modules 规范：否”，并导致更新不可见及根级 `components/` 错装；`1.0.3` 已验证官方通道可以恢复。

发布门禁和回滚以当前版本对应的 `docs/RELEASE-<主版本.次版本>.md` 为准。只打 Git tag，不额外创建 GitHub Release。

## 1. 发布前核对

- 读取插件 `package.json`、`readme.md`、`changelog.md` 和当前 RELEASE 清单，核对版本、平台、价格、权限与数据声明。
- 完成 RELEASE 中适用于本次发布的验证；网页或 CLI 显示“上传成功”不等于这些门禁通过。
- 不写入或上传真实 appkey、token、签名材料、本机路径、`node_modules/`、`.git/`、`unpackage/` 或 `.DS_Store`。
- 若 DCloud 未登录，让用户自行登录，不索取账号密码。

每次发布必须同步递增所有当前版本引用，不能只改插件 `package.json`：

- `uni_modules/easemob-uikit-uni/package.json` 的 `version`。
- `libs/constants/index.ts` 的 `UIKIT_VERSION`。
- `changelog.md` 首节。
- `demo/package.json`、`demo/package-lock.json`。
- `demo/manifest.json` 的 `versionName` 与 `versionCode`；`versionCode` 每次必须递增，例如 `1.0.3` 使用 `10002`。
- `templates/chat-only/package.json`、`package-lock.json`、`manifest.json`；其 `versionCode` 同步递增，例如 `1.0.3` 使用 `102`。
- 当前 README、公开文档、宿主 Skills、发布清单及版本相关测试期望；生成文档通过同步脚本更新，不手改生成页。

## 2. 通用发布 CLI

统一使用仓库零依赖封装 `scripts/publish-uni-modules.mjs`，它只调用 HBuilderX 官方 `uni_modules` 命令，不使用网页接口或手工 ZIP。默认宿主为仓库 `demo`、插件为 `easemob-uikit-uni`，可用 `--project` 与 `--plugin` 覆盖；插件必须位于 `<宿主工程>/uni_modules/<插件ID>/package.json`。

先运行版本物料门禁，再执行默认模式：

```bash
node scripts/check-release.mjs
node scripts/publish-uni-modules.mjs \
  --change-log "本次更新摘要，不重复版本号和日期"
```

默认模式依次执行官方 validate 与 publish dry-run，**不会正式发布**。必须得到两次 `success:true`、`outcome:"validated"` 和预期版本。更新日志也可通过 `--change-log-file <UTF-8文件>` 提供，与 `--change-log` 互斥。

HBuilderX CLI 默认读取 macOS `/Applications/HBuilderX.app/Contents/MacOS/cli`；其他安装位置用 `--cli /path/to/cli` 或 `HBUILDERX_CLI` 环境变量覆盖。仅把目录附加到 HBuilderX 文件树不等于正规项目导入；识别失败时先用官方 `project open` 或原始 validate 命令排错，不要改用网页 ZIP 绕过。

## 3. 正式发布

只有用户明确授权对外发布后，才增加 `--publish`：

```bash
node scripts/publish-uni-modules.mjs \
  --change-log "本次更新摘要，不重复版本号和日期" \
  --publish
```

脚本会重新依次执行 validate、dry-run、正式发布，任一步失败立即停止。正式发布必须得到 `success:true`、`outcome:"published"`。更新日志只写本次摘要，不粘贴整份 changelog 或使用说明。

需要绕过封装排查官方命令时，等价原始形式为：

```bash
CLI=/Applications/HBuilderX.app/Contents/MacOS/cli
"$CLI" uni_modules --validate easemob-uikit-uni --project /path/to/host --json
"$CLI" uni_modules --publish easemob-uikit-uni --project /path/to/host \
  --changeLog "本次更新摘要" --dryRun --json
```

dry-run 返回的临时 ZIP 路径不保证持续存在，不要把它当作持久发布物料。

## 4. 上线验收（缺一不可）

1. DCloud 管理列表显示目标版本“已上线”，且 **“uni_modules 规范：是”**。
2. 在干净临时工程下载目标版本，文件只落到 `uni_modules/easemob-uikit-uni/`，不得出现根级 `components/`、`libs/`、`assets/` 等错装目录。
3. 下载包中的版本、更新日志和本次代码修复均正确。
4. 在临时工程中模拟或安装旧版本，执行官方升级命令，能识别并更新到目标版本。
5. 最终宿主 Demo 的插件更新由项目负责人决定是否执行；不要用文件复制代替市场更新验收。

干净工程验收示例：

```bash
"$CLI" project create \
  --name easemob-uikit-import-check \
  --path /tmp \
  --type uni-app-x \
  --vapor true

"$CLI" uni_modules \
  --download easemob-uikit-uni \
  --project /tmp/easemob-uikit-import-check \
  --json
```

升级验收只能在临时工程或用户明确授权的工程中进行：

```bash
"$CLI" uni_modules \
  --upgrade easemob-uikit-uni \
  --project /tmp/easemob-uikit-import-check \
  --json
```

`--upgrade` 不支持 `--dryRun`，不得在未授权的 Demo 中试跑。旧版本下载受 DCloud 保留数量限制时，可在临时工程中把下载包的本地 `version` 改为旧版本，再测试升级发现能力；这只能验证更新通道，不能代替旧包内容验收。

## 5. 错装清理

若错误导入已在宿主根目录生成 `components/`、`libs/`、`assets/`、`changelog.md`、`license.md` 等：

- 先用版本控制状态和内容确认它们确由错误导入产生，只清理这些明确路径。
- 同时检查根 `README.md`、`package.json` 是否被插件文件覆盖，只恢复有证据的覆盖，不顺手回退用户的发版配置。
- 不删除 `uni_modules/easemob-uikit-uni/` 中的正式插件源码。

## 6. 网页表单的历史注意事项

网页 ZIP 上传不是默认通道，根级包含 `package.json` 也不足以证明市场会识别为 uni_modules。确需网页操作时，除原有字段与物料复核外，必须额外完成第 4 节全部验收；若显示“uni_modules 规范：否”，立即停止继续导入并改回官方通道。

分类不是修复识别问题的手段。保持已上线分类，不要为了排查识别问题反复切换“通用组件 / vue 组件”。

## Common Mistakes

| 症状 | 根因与处理 |
|---|---|
| 管理列表“uni_modules 规范：否” | 发布通道未形成合规 uni_modules 包；停止导入，改用官方 `--validate` / `--publish` 流程 |
| 更新后落到根级 `components/` | 当前市场包不合规，不要在业务 Demo 继续更新；按第 4 节验证新包后再更新 |
| HB 不提示新版本 | 先确认管理列表规范为“是”，再在临时工程用 `--upgrade` 验证，不以“上传成功”代替更新验收 |
| 本地目录没有发布入口 | 确认正规项目导入和 `uni_modules/<id>/package.json` 结构，再运行官方校验；不要盲改分类 |
| dry-run ZIP 路径找不到 | 临时产物可能已清理，以 dry-run 的校验结果为准，正式包由发布命令重新生成 |
| `VERSION_ALREADY_EXISTS` | 本地版本已在线上，停止重复发布；完成下一版本的物料递增后再运行，不改用旧版本绕过 |
| `CHANGELOG_MISSING` | `package.json.version` 已递增但 `changelog.md` 首节未同步；先补齐当前版本日志再重新校验 |
| 更新日志变成整份文档 | `--changeLog` 仅传本次摘要，不重复版本号、日期和完整接入说明 |
