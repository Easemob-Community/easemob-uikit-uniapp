# 1.0.0 发布清单（Release Checklist）

> 目标版本：**1.0.0**，首个正式版本。本文是内部发布操作手册；接入步骤见 [QUICKSTART](./QUICKSTART.md)，对外变更见插件 `changelog.md`。

## 1. 发布前硬门禁

使用 Node 22，在同一最终发布提交上执行：

```bash
node --test scripts/test-*.mjs
node scripts/check-release.mjs
node scripts/check-docs.mjs
node scripts/check-skills.mjs
node scripts/check-config-docs.mjs
node scripts/check-dx-contract.mjs
node scripts/check-theme-locale-contract.mjs
node scripts/audit-usage.mjs demo --check
node scripts/sync-shots.mjs --check
node scripts/sync-mp-subpackage.mjs --check

scripts/uni.sh build web
scripts/uni.sh build mp-weixin
node scripts/check-template.mjs
node scripts/check-app-module-graph.mjs
```

- [ ] 全部 Node 测试与静态检查通过。
- [ ] demo 与 chat-only 的 web/mp 构建通过。
- [ ] 两个微信小程序主包均 ≤1.5MB，SDK 与页面分包产物、配置和语法检查通过。
- [ ] demo 与 chat-only 的最终 H5 产物分别静态伺服，根页面 HTTP 200，浏览器无启动错误。
- [ ] App 模块图无 libs 反向依赖组件、无 `libs/index` 循环。
- [ ] 文档门户 `content:sync`、`content:check`、`test`、`build` 全绿。
- [ ] Android/iOS 使用最终发行配置重建包，确认 `uni-websocket` 已打入并完成登录与收发冒烟。

H5 产物检查示例：

```bash
cd demo/unpackage/dist/build/web && python3 -m http.server 5180
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5180/

cd templates/chat-only/unpackage/dist/build/web && python3 -m http.server 5181
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5181/
```

## 2. 版本与物料

| 文件 | 字段 | 发布值 |
|---|---|---|
| `uni_modules/easemob-uikit-uni/package.json` | `version` | `1.0.0` |
| `uni_modules/easemob-uikit-uni/changelog.md` | 首个小节 | `1.0.0（2026-11-23）` |
| `uni_modules/easemob-uikit-uni/libs/constants/index.ts` | `UIKIT_VERSION` | `1.0.0` |
| `demo/manifest.json` | `versionName` / `versionCode` | `1.0.0` / `10000` |
| `demo/package.json` / `package-lock.json` | `version` | `1.0.0` |
| demo、插件 peer、chat-only | `easemob-websdk` | `5.2.0` |

公开物料必须满足：

- [ ] 根 README、插件 README、公开文档和 Skills 均为 `1.0.0`，无当前版本“未发布/内测/候选”口径。
- [ ] 插件市场更新日志与 `changelog.md` 首节一致。
- [ ] 插件 README 的平台矩阵、文件下载、App 附件 provider 和已知限制与当前实现一致。
- [ ] 插件市场选择会话、聊天、群聊或业务卡片等至少 3 张真实截图。
- [ ] H5 在线预览与 demo 二维码如提供，链接可公开访问；未提供不阻塞发布。

## 3. 五端验收基线

以下核心链路已由项目负责人在发布前确认完成验证；本文不替代详细真机记录。

| 验收范围 | Android | iOS | 鸿蒙 | H5 | 微信小程序 |
|---|---|---|---|---|---|
| 登录、会话同步与核心收发 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 核心聊天、群组、通讯录与主题链路 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 平台对应媒体、附件与权限路径 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 小程序 SDK 分包加载 | — | — | — | — | ✅ |

大规模账号压测、弱网矩阵、真实 AI 服务端流式链路和营销素材补拍作为独立验收项记录，不与上述核心验收混写。

## 4. 发布时必须公示的边界

- 仅支持 uni-app x 蒸汽模式；H5 为移动端布局，未做桌面宽屏适配。
- H5 不提供录音入口；语音发送仅 App/小程序。
- App 发送文件需宿主注册附件 provider，未注册时入口隐藏。
- App 视频播放前需完整下载；大视频需要等待，解码能力取决于系统/浏览器。
- 附件下载位于长按菜单。App/小程序图片与视频保存相册，文件下载后尝试文档预览；H5 走浏览器下载。
- 微信小程序需配置 `downloadFile` 合法域名，文档打开类型以平台支持范围为准。
- @ 提及为追加式插入；消息列表使用 `scroll-view` 全量渲染。
- 非当前会话只保留最近 100 条内存消息，回会话时重拉最新页；完整本地历史由宿主按需持久化。
- 当前不包含消息转发、黑名单、群共享文件、公开群入群审批、群名片、群已读成员明细、消息搜索和 presence。

## 5. 公开仓安全

- [ ] 当前树无真实 appkey、token、签名密码或本机签名路径。
- [ ] `.gitignore` 继续覆盖签名材料、本地 manifest 和本地凭据。
- [ ] 历史提交曾包含鸿蒙签名密码字段：公开发布前轮换对应签名凭据。
- [ ] 对公开历史执行清理或重建公开仓，并确认远端不再暴露历史签名材料；不得仅清理当前文件后视为完成。
- [ ] 历史改写涉及共享远端时必须单独确认，不在常规发布提交中直接 force-push。

## 6. 发布动作

1. 完成上述硬门禁与安全闭环，确保工作树干净。
2. 推送 `dev`，确认远端提交与本地验证提交一致。
3. 打 tag：`git tag v1.0.0 && git push origin v1.0.0`。
4. 创建 GitHub Release，附 changelog、Quick Start、五端范围和当前边界。
5. 通过 HBuilderX 将 `uni_modules/easemob-uikit-uni/` 发布到 DCloud 插件市场。
6. 核对插件市场的平台兼容矩阵、权限/数据声明、截图和更新日志。
7. 在干净环境从 GitHub tag 或插件市场安装，按 QUICKSTART 跑通 H5 与微信小程序的登录、会话、文本和图片收发。

## 7. 首发回滚

- 首个正式版本没有上一插件市场版本可回退。出现阻塞问题时，先下架或撤回插件市场首发，并在 GitHub Release 标注阻塞原因。
- 不删除或 force-push 已发布 tag；修复后使用新的 patch 版本与 tag 发布。
- 引用协议继续双写 `msgQuote` 与 `emQuote`，不得在修复版本中直接删除兼容字段。
