# Demo 本地登录配置设计

## 目标

将用户提供的 appKey、userId、token 持久化为 Demo 的本机默认登录配置，并在鸿蒙真机再次登录。真实凭据不得进入 Git 跟踪文件。

## 方案

采用编译前生成真实模块：从已被 `.gitignore` 覆盖的 `demo/common/local.credentials.json` 读取配置，在 Vite 启动时生成同样被忽略的 `demo/common/local.credentials.module.ts`，登录页通过普通 ES import 读取。设备已有存储值优先，本机配置只补空值。鸿蒙 `[plugin:uts]` 不支持全局 `define` 注入和虚拟模块解析，因此使用磁盘上的真实 TS 模块，并避免与 JSON 同名。

考虑过两个替代方案：直接写入 `login.uvue` 会让真实 token 进入 Git  diff，不采用；只依赖设备存储无法提供 Demo 本机默认配置，不满足本次需求。

## 范围

新增一个无依赖的 Node 配置读取器、一个登录默认值合并函数及对应测试；修改 Vite 配置和登录页。本机凭据文件只保存当前用户提供的值，不新增示例真实凭据，不改 UIKit 登录逻辑。

## 验证

Node 测试覆盖默认值补齐、存储优先和缺失本机文件回退；Web 与微信小程序构建通过；鸿蒙真机使用相同配置再次登录并进入会话列表。