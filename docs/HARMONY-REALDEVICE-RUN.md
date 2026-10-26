# 鸿蒙真机运行与签名配置

> 本文是示例工程在鸿蒙真机上跑通的完整操作步骤与常见报错处理，2026-10 实测（HBuilderX 5.26 + DevEco Studio + 鸿蒙真机 USB 连接）。
> 官方权威来源：[uni-app 鸿蒙运行和发行](https://uniapp.dcloud.net.cn/tutorial/harmony/runbuild.html)（签名报错处理以该文档「证书签名配置指南」一节为准）。

## 1. 环境要求

| 项 | 要求 | 实测环境 |
|---|---|---|
| HBuilderX | 4.61+（支持交互式配置/自动申请调试证书） | 5.26 ✓ |
| DevEco Studio | 5.1.0.849+（HBuilderX 4.81+ 要求） | 已安装 ✓ |
| 鸿蒙真机 | 系统 API 12+（模拟器要求 API19+，真机无此要求） | ✓ |
| 华为开发者账号 | 完成实名认证的开发者注册 | ✓ |

HBuilderX 中设置 DevEco Studio 路径：工具 → 设置 → 运行配置 → 鸿蒙运行配置。

## 2. 包名规则与「三方一致」原则（最重要）

鸿蒙签名要求**三处包名完全一致**，不一致是绝大多数签名报错的根源：

1. **AGC 注册的包名**（【证书、APP ID 和 Profile】→【APP ID】）
2. **HBuilderX 签名配置/申请时查找的包名**
3. **鸿蒙工程实际构建的 bundleName**（`AppScope/app.json5` 的 `app.bundleName`）

本项目 demo 的包名为 `uni.app.UNI08EF252`，来源规则：DCloud appid `__UNI__08EF252` 去掉下划线 → 加 `uni.app.` 前缀。HBuilderX 的签名对话框默认按此规则推导。

**包名不一致的典型表现**：构建产物里的 bundleName 仍是模板默认值 `io.dcloud.uniappx`（见 `demo/unpackage/dist/dev/app-harmony/AppScope/app.json5`），与 AGC 注册名不一致，签名时报「未找到包名为 xx 的应用」。

处理方式：

1. 在 `manifest.json` 可视化编辑的【鸿蒙 App 配置】中显式填包名（对应 `app-harmony.distribute.bundleName`，HX 4.31+ 起优先于 `harmony-configs/AppScope/app.json5`）；
2. 删除 `demo/unpackage/dist/dev/app-harmony` 后重新运行，让工程按新包名重建。

改名后记得重新签名（Profile 与包名绑定）。

> [!CAUTION]
> **仓库安全**：`demo/manifest.json` 已移除 `app-harmony.distribute.signingConfigs`（证书绝对路径与密码不再入库）。
> 本地首次运行时按本节在 HBuilderX 中重新配置即可；HBuilderX 可能把签名写回 manifest，**提交前务必还原/删除该段**。
> 签名材料（`.p12` / `.cer` / `.p7b`）已在 `.gitignore` 中忽略。

## 3. 签名配置：优先自动申请

【运行 → 运行到手机或模拟器 → 运行到鸿蒙】→ 设备对话框 →【配置调试证书】→【自动申请】：

- 触发浏览器打开华为登录授权页，**授权的华为账号必须与 AGC 中创建应用的账号是同一个**（团队账号注意 AGC 右上角的团队切换）。
- 成功后自动填好 p12/cer/p7b 路径与密码，点【保存】。构建时这些信息写入鸿蒙工程 `build-profile.json5`。

### 自动申请常见报错

| 报错 | 原因与处理 |
|---|---|
| 尚未完成开发者注册 | 先注册鸿蒙开发者账号（实名认证），再到 AGC 操作 |
| **未找到包名为 xx 的应用** | HBuilderX 查的是 AGC【证书、APP ID 和 Profile】→【APP ID】注册表，不是「我的应用」列表。确认该包名在 APP ID 列表中**精确存在**（大小写敏感、无空格）；再核对授权账号与建应用账号一致；AGC 改动偶有数分钟同步延迟，稍候重试 |
| 没查到运行设备的注册信息 | 调试 Profile 需包含真机 UDID。保持真机连接重试（HX 会尝试自动注册）；失败则手动在 AGC【设备】中添加 UDID（获取方式见 4.2 节） |

## 4. 手动签名流程（自动申请走不通时）

### 4.1 生成私钥（.p12）与证书请求文件（.csr）

DevEco Studio 打开任意工程 → **Build → Generate Key and CSR**：

1. Key Store File 选 New，设置 .p12 路径和密码（**密码务必记牢**）
2. 设置 Alias（如 `debugKey`）及密码
3. 设置 .csr 路径 → Finish

### 4.2 注册真机 UDID

```bash
# hdc 在 DevEco Studio 内置 SDK 里，macOS 下位于
# <DevEco Studio>/Contents/sdk/default/openharmony/toolchains
<DevEco Studio>/Contents/sdk/default/openharmony/toolchains/hdc list targets
<DevEco Studio>/Contents/sdk/default/openharmony/toolchains/hdc shell bm get --udid
```

可把 toolchains 目录加入 PATH，后续直接敲 `hdc`：

```bash
export PATH="$PATH:<DevEco Studio>/Contents/sdk/default/openharmony/toolchains"
```

拿到 UDID 后：AGC →【证书、APP ID 和 Profile】→【设备】→【添加设备】。

> **安全纪律**：UDID、证书密码、私钥文件属敏感信息，一律不进仓库。

### 4.3 AGC 申请调试证书（.cer）

【证书、APP ID 和 Profile】→【证书】→【新增证书】→ 类型选**调试证书** → 上传 4.1 的 .csr → 下载 .cer。

### 4.4 AGC 申请调试 Profile（.p7b）

【证书、APP ID 和 Profile】→【Profile】→【添加】→ 应用选 `uni.app.UNI08EF252`（**前提是 APP ID 已注册**，否则这里也选不到）→ 类型**调试** → 勾选 4.3 的证书和 4.2 的设备 → 下载 .p7b。

### 4.5 配回 HBuilderX

【配置调试证书】对话框手动填：

| 字段 | 值 |
|---|---|
| 私钥库文件 | 4.1 的 .p12 路径 |
| 私钥库密码 | 4.1 设置的密码 |
| 密钥别名 | 4.1 设置的 Alias（如 `debugKey`） |
| 证书文件 | 4.3 下载的 .cer |
| Profile 文件 | 4.4 下载的 .p7b |

（也可手填 `harmony-configs/build-profile.json5` 的 `app.signingConfigs`，但 HX 4.61+ 交互式配置优先，二选一即可。）

## 5. 运行到真机

1. 手机开开发者模式 → 开 USB 调试 → 数据线连电脑；`hdc list targets` 能看到设备序列号即连接成功（无线调试：手机 设置→系统→开发者选项→无线调试 取 IP:端口）。
2. HBuilderX【运行 → 运行到鸿蒙】→ 选真机 → 差量缓存 + debug 模式 → 构建安装。首次运行自动生成 `demo/harmony-configs/`（空目录属正常）。
3. 升级 HBuilderX 后或出现怪异问题时，选「清空缓存」重建。

## 6. 备注

- 调试证书有效期 365 天，到期重新申请；调试 Profile 与设备绑定，换新手机需重新注册 UDID 并更新 Profile。
- 发布上架需另配**发布证书 + 发布 Profile**，流程相同（证书类型选发布），本文不展开。
- 受 AGC API 限制，自动申请拿不到含 ACL 权限的调试证书；需要 ACL 权限的应用请走第 4 节的手动签名流程。
