# 1.0 发布清单（Release Checklist）

> 目标版本：**1.0.0-rc.2**（候选版）。rc 通过真机矩阵后再发 `1.0.0` GA。
> 本文是发布操作手册；能力/接口说明见 [README](../README.md)，接入步骤见 [QUICKSTART](./QUICKSTART.md)，评审结论见 [REVIEW-1.0-READINESS](./REVIEW-1.0-READINESS.md)。

## 1. 发布前必须通过（硬门禁）

```bash
# 0) 发布物料自检（版本/changelog/README/平台矩阵/LICENSE/敏感信息）
node scripts/check-release.mjs

# 1) 双端构建
scripts/uni.sh build web
scripts/uni.sh build mp-weixin

# 2) 小程序防回归（build 脚本已内置，含 11 项断言 + 主包 ≤1.5MB）
#    期望：全部防回归检查通过；主包约 850KB，分包合计约 1367KB

# 3) H5 产物静态伺服 200
cd demo/unpackage/dist/build/web && python3 -m http.server 5180
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5180/   # 200
```

- [ ] `build web` 通过，无新增 error
- [ ] `build mp-weixin` 通过，11 项防回归全绿
- [ ] 主包 ≤ 1.5MB，分包 `sub-sdk/im-sdk.js` 存在且无 `?.` 残留
- [ ] H5 伺服 200
- [ ] 图标 parity 通过（`scripts/verify-icons.py` / 构建脚本内断言）
- [ ] `package.json`、`changelog.md`、README 版本号一致（`1.0.0-rc.2`）

## 2. 版本与物料

### 2.1 版本号位置

| 文件 | 字段 | 当前值 |
|---|---|---|
| `uni_modules/easemob-uikit-uni/package.json` | `version` | `1.0.0-rc.2` |
| `uni_modules/easemob-uikit-uni/changelog.md` | 首个小节 | `1.0.0-rc.2` |
| `demo/manifest.json` | `versionName` / `versionCode` | `1.0.0-rc.2` / `102` |
| `demo/package.json` | `version` | `1.0.0-rc.2` |

> 发 GA 时把插件 version 改为 `1.0.0`，changelog 增 `1.0.0` 小节，demo 同步。

### 2.2 插件市场字段

| 字段 | 建议值 |
|---|---|
| 插件名称 | 环信 IM UIKit（uni-app x） |
| 分类 | 前端组件 / 通用组件 |
| 价格 | 免费（普通授权 + 源码授权均为 0） |
| 支持平台 | uni-app x：Android / iOS / 鸿蒙 / H5 / 微信小程序 |
| 暗黑模式 | 支持 |
| 多语言 | 支持（中/英） |
| 宽屏 | 不支持（H5 仅移动端） |
| 权限声明 | 相机、相册、麦克风（用户主动发图片/视频/语音时） |
| 数据声明 | 插件不采集；消息经宿主集成的环信 SDK 传输至宿主配置的服务端 |
| 仓库 | `https://github.com/Easemob-Community/easemob-uikit-uniapp` |
| License | MIT |

- [ ] 插件市场「更新日志」与 `changelog.md` 首节一致
- [ ] 插件 readme 为新版（自包含 Quick Start + 平台矩阵 + 已知限制）
- [ ] 至少 3 张截图：会话列表、单聊（含引用/已读）、群聊/多场景卡片
- [ ] 提供 H5 在线预览链接（可选）与 demo 二维码（可选）

### 2.3 仓库

- [ ] 根 `LICENSE`（MIT）存在
- [ ] `README.md` 顶部为 1.0 状态 + 兼容矩阵 + Quick Start 链接
- [ ] `docs/QUICKSTART.md` 评审通过（按文档从空工程能跑通）
- [ ] `.gitignore` 覆盖签名材料与本地 manifest
- [ ] 无真实 appkey/token/密码/绝对路径进入**当前树**
- [ ] 若历史提交含签名密码：发布前轮换证书密码，并重写历史（`git filter-repo`）或重建公开仓

## 3. 真机 / 真账号矩阵（rc 必测）

| 场景 | Android | iOS | 鸿蒙 | H5 | 微信小程序 |
|---|---|---|---|---|---|
| 登录 / 断线重连 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 连接状态条（重连/断开/被踢） | ☐ | ☐ | ☐ | ☐ | ☐ |
| 单聊文本 / 图片 / 语音 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 录音权限拒绝 / 60s 自动发送 | ☐ | ☐ | ☐ | — | ☐ |
| 语言切换 + 重启后保持 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 视频发送 + 播放（H5 可播，其它端隐藏） | ☐ | ☐ | ☐ | ☐ | ☐ |
| 文件发送（App 隐藏入口） | ☐ | ☐ | ☐ | ☐ | ☐ |
| 附件下载：图片/视频存相册、文件下载打开（H5 浏览器下载） | ☐ | ☐ | ☐ | ☐ | ☐ |
| 引用 / 撤回 / 重发 / 已读 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 群聊：公告 / @ / 昵称行 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 未读清零（离页/冷启不复活） | ☐ | ☐ | ☐ | ☐ | ☐ |
| Token 过期自动续期 / 被踢 reason | ☐ | ☐ | ☐ | ☐ | ☐ |
| 首屏历史骨架 / 失败重试 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 多群消息后回会话（内存裁剪/重拉） | ☐ | ☐ | ☐ | ☐ | ☐ |
| 深色模式 / 键盘避让 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 小程序 SDK 分包加载 | — | — | — | — | ☐ |

补充重点：

- [ ] iOS 首次完整验证（当前历史验证以 Android/H5/mp 为主）
- [ ] 鸿蒙签名重配后运行（manifest 已清签名）
- [ ] 与 vue 版 UIKit 互发引用（`msgQuote` 双向）
- [ ] H5 联系人同步为 0 的复现/排除（同账号 mp 对照）
- [ ] 附件下载：相册权限拒绝、微信小程序 `downloadFile` 合法域名、文件类型打开范围、H5 跨域直链

## 4. 已知限制（发布时必须公示）

- 视频播放依赖系统/浏览器解码；冷门编码会提示加载失败。App 端会先整包下载视频再播放（chatfiles 直链不支持 Range），大视频需等待；H5 可能拦截带声音的自动播放。
- 附件下载走长按菜单：App/小程序图片/视频保存到系统相册，文件下载后尝试系统文档预览（App 对 doc/docx/xls/xlsx/ppt/pptx/pdf 指定类型、其他类型交给系统尝试；微信小程序仅支持这七类）；H5 走浏览器下载，不写相册。文件单击不触发下载。微信小程序需在公众平台配置 `downloadFile` 合法域名。
- App 端暂不支持发送文件。
- 语音发送仅 App/小程序；H5 入口隐藏。录音 60s 上限自动发送；麦克风权限失败只 toast，不自动跳系统设置。
- H5 未做桌面宽屏适配。
- @ 提及为追加式插入；消息列表为 `scroll-view` 全量渲染。
- 非当前会话只保留最近 100 条内存消息，回会话时重拉最新页；完整本地历史需宿主自行持久化。
- 1.0 不含：消息转发、黑名单、群文件、群搜索、presence、消息搜索。

## 5. 发布动作

1. 合并发布分支，跑第 1 节硬门禁；
2. 更新 `changelog.md` / `package.json`（rc → GA 时）；
3. 打 tag：`git tag v1.0.0-rc.2 && git push origin v1.0.0-rc.2`；
4. HBuilderX 打开 `uni_modules/easemob-uikit-uni/`，右键「发布到插件市场」；
5. 上传仓库 Release（附 changelog、Quick Start 链接、已知限制）；
6. 发布后 24h 内回归：插件市场安装 → 按 QUICKSTART 跑通 H5 + mp。

## 6. 回滚

- 插件市场保留上一版本；出现阻塞问题时下架 rc 或将版本回退到上一个可用版本。
- Git 回滚以 tag 为准；不要 force-push 已发布 tag。
- 数据/协议兼容：引用双写 `msgQuote` + `emQuote`，回退到 0.x 客户端仍可读；不要在新版本删除旧 key，至少保留一个 minor。

## 7. 发布后待办

- 收集首周 issue（模板：端 / HBuilderX 版本 / 蒸汽 or VDOM / 最小复现）；
- 把高频问题补进 `docs/QUICKSTART.md` 排错表；
- 真机矩阵结果回填 `docs/STATUS.md`；
- 规划 1.1：消息分页/内存上限、CI/自动化测试、连接条交互增强（手动重试/关闭）、录音权限引导、历史加载骨架细化。
