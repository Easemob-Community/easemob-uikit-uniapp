# 鸿蒙真机运行与签名配置

> 本文是示例工程在鸿蒙真机上跑通的完整操作步骤与常见报错处理，2026-10 实测（HBuilderX 5.26 + DevEco Studio + 鸿蒙真机 USB 连接）；2026-11 补充发行签名材料校验与报错排查。
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
2. HBuilderX【运行 → 运行到鸿蒙】→ 选真机 → 差量缓存 + debug 模式 → 构建安装。首次运行会自动生成 `demo/harmony-configs/`；**这个目录不要空着**，语音与拍摄依赖其中的权限声明，见 5.1。
3. 升级 HBuilderX 后或出现怪异问题时，选「清空缓存」重建。

### 5.1 权限声明与授权处理

鸿蒙权限分为**安装包声明**和**运行时授权**两步。`module.json5` 未声明权限时，运行时请求会被系统直接拒绝，授权弹窗不会出现，UIKit 只能收到失败回调并提示「录音失败」或「图片选择失败」。这不是用户拒绝，也不需要先写 UTS 插件排查。

| UIKit 能力 | 权限 | 配置要求 | 授权表现 |
|---|---|---|---|
| 语音消息录音 | `ohos.permission.MICROPHONE` | `reason` + `usedScene.when = "inuse"` | 首次录音弹出系统授权框 |
| 拍摄图片 | `ohos.permission.CAMERA` | `reason` + `usedScene.when = "inuse"` | 首次拍摄弹出系统授权框 |
| 网络状态监听、发送前网络预检 | `ohos.permission.GET_NETWORK_INFO` | 只需声明 `name` | 系统授权，不弹用户授权框 |
| 网络请求 | `ohos.permission.INTERNET` | 只需声明 `name`；保留生成工程已有声明 | 不弹用户授权框 |

`GET_NETWORK_INFO` 是否由框架或基座自动加入取决于实际工程，应以生成后的 `module.json5` 为准；没有时必须显式补上，否则网络状态检测会失败或降级。

#### 配置文件与写法

文件位置与节点：

```text
harmony-configs/
└── entry/src/main/
    ├── module.json5                        ← requestPermissions
    └── resources/base/element/string.json  ← reason 文案
```

先把生成工程中对应的完整文件复制到上述目录，再增加权限。`module.json5` 中的 `requestPermissions` 示例（实际文件必须保留完整的 `module` 结构）：

```json5
"requestPermissions": [
  { "name": "ohos.permission.INTERNET" },
  { "name": "ohos.permission.GET_NETWORK_INFO" },
  {
    "name": "ohos.permission.MICROPHONE",
    "reason": "$string:reason_microphone",
    "usedScene": { "abilities": ["EntryAbility"], "when": "inuse" }
  },
  {
    "name": "ohos.permission.CAMERA",
    "reason": "$string:reason_camera",
    "usedScene": { "abilities": ["EntryAbility"], "when": "inuse" }
  }
]
```

`reason` 必须使用 `$string:` 资源引用，不能直接填写中文。`resources/base/element/string.json` 示例：

```json
{
  "string": [
    { "name": "reason_microphone", "value": "发送语音消息时需要录制声音" },
    { "name": "reason_camera", "value": "拍摄照片或视频时需要访问相机" }
  ]
}
```

实际文件还要保留原有的 `module_desc`、`EntryAbility_desc`、`EntryAbility_label`。需要英文文案时，可在 `resources/en_US/element/string.json` 放同名条目；资源优先级与目录规则遵循鸿蒙规范。

#### 覆盖规则与免权限能力

1. **整份覆盖，不是合并**：HBuilderX 用 `copyDirectoryEx` 把 `harmony-configs` 下的文件整体覆盖到生成工程，只保留 4 个特定路径。所以 `module.json5` 必须给**完整内容**（`abilities`、`pages`、`mainElement` 一个不能少），只贴一段 `requestPermissions` 会把工程打坏。同理，覆盖时要保留生成工程已有的 `INTERNET` 等声明。
2. **选择相册和文件不用声明权限**：`uni.chooseImage` / `uni.chooseVideo` 走系统 Picker，`uni.chooseFile` 走系统文件选择器，均无需申请相册或文件读取权限。
3. **保存图片/视频也不用声明相册权限**：当前鸿蒙运行时通过系统 `showAssetsCreationDialog` 让用户确认保存，不需要额外声明 `READ_IMAGEVIDEO` / `WRITE_IMAGEVIDEO`。
4. **复制文本不需要读取剪贴板权限**：UIKit 只调用 `setClipboardData`，不调用读取剪贴板 API，无需声明 `READ_PASTEBOARD`。

#### 生效与拒绝后的处理

修改 `harmony-configs` 后必须重新执行「运行到鸿蒙」，重新组装、构建并安装应用；不要直接修改 `unpackage/`，也不要只做 JS 热更新。首次录音或拍摄时，RecorderManager / 系统拍摄能力会自动发起运行时授权，弹窗正文就是 `reason` 指向的文案。

如果系统弹窗曾经出现、但用户选择了拒绝，之后可能不再弹窗。这属于用户授权状态问题，应引导用户到系统设置中开启；UIKit 当前只在失败时显示 toast，不会自动跳转设置。若从未弹窗，则优先检查安装包是否缺少权限声明。

示例工程的语音与拍摄声明见 `demo/harmony-configs/`。

> 排查命令：`hdc shell bm dump -n <bundleName> | grep -A3 reqPermissionDetails` 可确认权限是否真的进了安装包。注意 `uni.sh build app-harmony` 只产出 assets、不组装 `entry/`，验证权限必须走「运行到鸿蒙」或对已组装工程重打包。

### 5.2 SDK 调试日志：鸿蒙上不要开 DEBUG

`EmKit.init` 的 `sdkLogLevel` 在鸿蒙端请保持默认 `WARN`。SDK 的 DEBUG 级日志脱敏会对二进制帧调用 `Object.entries`，而 ArkTS 运行时不支持该用法，会抛 `Object entries is not supported`，异常沿同步管线向上冒泡，表现为**会话列表同步整体失败**（列表只剩本地缓存；缓存为空时看起来就是「加载失败」）。

排查方法：`logLevel: 'debug'` 下导出日志（示例工程「我的 → 导出调试日志」），搜 `Object entries`。

## 6. 鸿蒙发行签名：四件套与正确顺序

发行签名需要 `.p12`、`.csr`、`.cer`、`.p7b` 四份材料。它们不是彼此独立、可以随意组合的文件，而是同一条密钥链上的不同产物：

```text
本地生成 .p12（私钥）
   │ 从同一私钥生成
   ▼
本地生成 .csr（证书请求）
   │ 在 AGC 上传该 CSR，申请发布证书
   ▼
AGC 下载 .cer（华为签发的发布证书）
   │ 创建发布 Profile 时选择这张证书
   ▼
AGC 下载 .p7b（绑定包名、发布证书和权限）
   │
   ▼
HBuilderX 配置后执行发行打包
```

| 文件 | 生成位置 | 作用 | 能否随意替换 |
|---|---|---|---|
| `.p12` | 本地 DevEco Studio | 保存签名私钥和本地自签名证书 | 不能；更换后通常需要重新申请证书和 Profile |
| `.csr` | 本地 DevEco Studio | 向 AGC 证明公钥并申请证书 | 必须与当前 `.p12` 的私钥匹配 |
| `.cer` | AGC | 华为根据 CSR 签发的发布证书，文件可能是完整证书链 | 必须使用当前 CSR 申请 |
| `.p7b` | AGC | 绑定应用包名、发布证书、权限和有效期 | 必须选择同一张发布证书创建 |

> [!IMPORTANT]
> `.p12` 不在 AGC 生成。AGC 不保存你的私钥，无法替你下载 `.p12` 或找回密码。重新生成 `.p12` 后，旧 CSR、旧 `.cer` 和旧 `.p7b` 不会自动适配新私钥。

### 6.1 第一步：确定包名并注册 APP ID

先按第 2 节确定 `bundleName`，并在 AGC【证书、APP ID 和 Profile】→【APP ID】中注册同一个包名。后续创建 Profile、HBuilderX 配置和实际构建都必须使用该包名。

已经用于调试或上架的包名不要随意修改；包名变化后需要重新创建对应 Profile。

### 6.2 第二步：在本地生成 `.p12` 和 `.csr`

DevEco Studio 打开任意鸿蒙工程，选择 **Build → Generate Key and CSR**：

1. 首次使用时，在 Key Store File 中选择 **New**，设置 `.p12` 保存位置和私钥库密码。
2. 设置密钥别名（Alias）和私钥密码。私钥库密码与私钥密码可以相同，也可以不同，必须分别记录。
3. 设置 `.csr` 保存位置并完成生成。
4. 备份 `.p12`、两个密码、别名和同目录的 `material`，不要提交到仓库。

如果是要为现有私钥重新申请证书，应选择**已有的 `.p12` 和别名**生成 CSR，不要再次选择 New。申请证书和 Profile 期间不要重建密钥。

### 6.3 第三步：在 AGC 申请发布证书 `.cer`

进入 AGC【证书、APP ID 和 Profile】→【证书】：

1. 新增证书，类型选择**发布证书**。
2. 上传上一步生成的 `.csr`。
3. 下载签发后的 `.cer`。

下载后应确认新证书与当前 CSR 对应。文件名与旧证书相同、文件已经重新下载，都不能证明公钥匹配。

### 6.4 第四步：在 AGC 创建发布 Profile `.p7b`

进入 AGC【证书、APP ID 和 Profile】→【Profile】：

1. 新增 Profile，类型选择**发布**。
2. 应用选择已注册的 `<bundleName>`。
3. 证书选择**上一步刚创建的发布证书**，不要误选账号下的旧证书。
4. 下载 `.p7b`。

Profile 的下载时间不是证书匹配依据。即使 `.p7b` 刚下载，它仍可能绑定一张多年前创建的旧证书，应以 Profile 中嵌入的发布证书为准。

### 6.5 第五步：配置 HBuilderX 发布证书

建议将 `.p12`、`.cer`、`.p7b` 放在同一个稳定目录，并保留该目录下的 `material`。在 HBuilderX 的 `manifest.json` 可视化编辑页打开【鸿蒙 App 配置】→【发布证书】，填写：

| 字段 | 填写内容 |
|---|---|
| 私钥库文件 `storeFile` | 当前 `.p12` |
| 私钥库密码 `storePassword` | 创建该密钥库时设置的明文密码 |
| 密钥别名 `keyAlias` | 当前 `.p12` 中实际存在的 Alias |
| 私钥密码 `keyPassword` | 当前别名对应的明文私钥密码 |
| 证书文件 `certpath` | 使用当前 CSR 申请得到的 `.cer` |
| Profile 文件 `profile` | 选择同一张发布证书创建的 `.p7b` |
| 签名算法 `signAlg` | 保持 `SHA256withECDSA`，除非签名材料另有明确说明 |

重新生成过密钥或 `material` 后，应在两个密码框中重新输入明文密码，不要继续沿用从其他工程复制的加密密文。保存后，构建系统会把配置写入生成工程的 `build-profile.json5`；不要直接修改 `unpackage/` 中的该文件。

### 6.6 第六步：执行发行打包

选择 HBuilderX【发行】→【App-Harmony-本地打包】。成功的发行构建应完成 `SignHap` 并生成已签名的 `.app` 安装包。

`CompileArkTS`、`PackageHap` 成功只表示编译和打包完成，不代表签名成功。前面的 ArkTS、重复文件名或混淆 `WARN` 通常不是安装包制作失败的原因，应定位第一个 `hvigor ERROR` 及其错误码。

## 7. 发行前的交叉校验

仅确认三个文件存在还不够。有效的发行签名必须同时满足以下条件：

| 校验项 | 正确结果 |
|---|---|
| 密钥库 | `.p12` 可以打开，配置的别名确实存在，私钥密码可以解密该别名 |
| 私钥与 CSR | 两者公钥完全一致 |
| 私钥与发布证书 | `.p12` 私钥与 `.cer` 叶子发布证书的公钥完全一致 |
| 证书链与 Profile | `.cer` 叶子发布证书与 `.p7b` 中的 `distribution-certificate` 序列号、指纹和公钥一致 |
| Profile 应用信息 | `type = release`，`bundle-name` 与工程一致，当前时间处于有效期内 |
| Profile 权限 | `allowed-acls` 覆盖工程声明的受限权限；普通权限不需要 ACL |
| 构建配置 | `manifest.json` 与生成工程的 release `build-profile.json5` 引用同一套文件 |
| 密码材料 | 明文密码正确；若使用加密密文，则密文必须与配套的 `material` 一起使用 |

可用下面的命令检查别名和 CSR。命令不含密码参数，按提示交互输入即可：

```bash
# 查看密钥库条目与别名
keytool -list -keystore /path/to/signing.p12 -storetype PKCS12

# 校验 CSR 自身签名
openssl req -in /path/to/signing.csr -noout -verify
```

也可以分别输出 `.p12` 和 CSR 的公钥进行比较：

```bash
openssl pkcs12 -in /path/to/signing.p12 -nokeys -clcerts | openssl x509 -noout -pubkey
openssl req -in /path/to/signing.csr -noout -pubkey
```

> [!WARNING]
> `.cer` 可能依次包含根 CA、中间 CA 和叶子发布证书。直接使用 `openssl x509 -in signing.cer` 通常只读取第一张证书，可能拿到根 CA，不能据此判断私钥是否匹配。校验时应逐张解析证书链，并选择实际发布叶子证书。

## 8. 签名报错速查

| 报错 | 常见原因 | 处理方法 |
|---|---|---|
| `11014003 Init keystore failed` / `keystore password was incorrect` | 当前 `storeFile` 与 `storePassword` 不配套；常见于只改密码但仍选中另一个 `.p12` | 先核对实际 `storeFile` 路径，再重新选择密钥库并输入该文件的明文私钥库密码 |
| `11111002 Certificates Error` / `Signing failed` / `Please check whether the keyAlias is correct` | 别名错误是其中一种可能；私钥密码错误、`.p12` 与 `.cer` 公钥不匹配、Profile 绑定另一张证书也会进入证书失败 | 用第 7 节逐项验证，不要只重复选择同一个 `.cer` |
| `00303242 Configuration Error` / `Signature material verification failed` / `Unsupported state or unable to authenticate data` | 加密密码密文与 `material` 不配套，或签名材料认证失败 | 保留同一目录的 `material`，在 HBuilderX 中重新输入两个明文密码；也可通过 DevEco Studio【File → Project Structure → Signing Configs】重新取得完整配置 |
| `签名证书资料配置错误` | HBuilderX 对签名失败的汇总提示，不是具体根因 | 向上查找第一个 `hvigor ERROR` 和错误码，再按对应项处理 |
| `配置的 bundleName 与签名证书不符` | Profile 与工程包名不同 | 修改工程包名，或为当前包名重新创建 Profile |
| `运行所需的权限没有签名授权` | 工程声明了需要白名单的 ACL 权限，但 Profile 未包含授权 | 删除业务未使用的受限权限；确需使用时，先申请相应受限权限，再生成包含 ACL 的签名材料 |
| 真机安装时 `签名验证失败` | 调试 Profile 未包含当前设备 UDID | 注册设备并重新创建调试 Profile |
| 覆盖安装时 `签名不一致` | 设备上的应用与当前安装包使用了不同签名 | 调试场景可卸载旧应用后重装；已上架应用的签名变更需遵循华为的升级规则 |

### 最容易反复踩中的四个问题

1. **申请证书后又生成新 `.p12`**：新私钥与旧证书必然不匹配。应固定私钥，只重新申请证书和 Profile。
2. **创建 Profile 时选到旧证书**：新下载的 `.p7b` 仍可能绑定旧证书。必须检查 Profile 内嵌证书，而不是只看文件时间。
3. **复制加密密码却没有复制配套 `material`**：密文无法认证。最稳妥的处理是重新输入明文密码。
4. **拿 `.cer` 第一张根 CA 证书与私钥比较**：比较对象错误。应使用叶子发布证书，并与 Profile 内嵌证书交叉确认。

## 9. 签名材料安全与更新注意事项

- `.p12`、两个密码和 `material` 必须妥善备份；丢失私钥后，AGC 无法帮你恢复。
- 私钥、密码、CSR、签名证书、Profile、`material` 以及包含本机路径的签名配置都不要提交到公开仓库。
- 调试证书有效期 365 天，到期重新申请；调试 Profile 与设备绑定，换新手机需注册 UDID 并更新 Profile。
- 受 AGC API 限制，自动申请拿不到含 ACL 权限的调试证书；需要 ACL 权限的应用请走第 4 节的手动签名流程。
- 已正式上架的应用不要随意更换签名体系。新签名安装包可能无法覆盖旧版本，应用更新应遵循华为的签名与升级规则。
