# easemob-uikit-uniapp

环信 IM 的 uni-app 版 UIKit（uni-app x 蒸汽模式），面向 DCloud 插件市场社区分发。MIT 开源。

> 当前状态：**早期开发（M0/M1 之间）**。一期执行依据见 [PLAN.md](./PLAN.md)。

## 开发环境（锁定）

- HBuilderX **5.26+**（或 HBuilder V 5.21+，蒸汽模式硬性要求）
- Node.js 18+（CLI 编译用）
- 目标平台：Android 6+ / iOS 15+ / 鸿蒙 API20+ / 现代浏览器 / 微信小程序

## 仓库结构

```
uni_modules/easemob-uikit-uni/   # UIKit 插件本体（组件前缀 em-）
demo/                            # 演示工程（uni-app x，manifest.json 开启 vapor）
docs/                            # 文档（含 SDK 五端连通性 spike 记录）
scripts/                         # 编译/发布脚本
```

## 快速开始（最小可验证用例）

最小用例是 `demo/pages/spike/spike.vue`：手填 appkey/userId/token 登录环信，给指定 peer 发文本消息并显示收发流，用于验证 SDK 各端连通性。

方式一（HBuilder）：用 HBuilderX / HBuilder V 打开 `demo/` 目录，运行到浏览器 / 微信开发者工具 / 真机。

方式二（CLI，走 HBuilderX 内置编译器）：

```bash
cd demo && npm install        # 安装 easemob-websdk
cd ..
scripts/uni.sh build web      # H5 出包
scripts/uni.sh build mp-weixin # 微信小程序出包（用微信开发者工具打开 demo/unpackage/dist/build/mp-weixin）
# H5 本地验证：dev 模式暂不支持 .uts 入口，用构建产物 + 静态伺服
cd demo/unpackage/dist/build/web && python3 -m http.server 5180
```

> appkey 与测试 token 从环信控制台获取（仅限开发用途），**不要**把真实凭据提交进仓库。

## 路线图

见 [PLAN.md](./PLAN.md) 第 2 节「明确不做」与第 5 节里程碑。一期范围外的功能会在发版时逐条冻结公示，避免重复 issue。
