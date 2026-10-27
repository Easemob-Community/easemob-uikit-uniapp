# minimal-host 夹具

`scripts/audit-usage.mjs` 的回归夹具：只声明「会话列表 + 聊天」两页的最小宿主，**不参与编译、不可运行**。

用途：验证审计的三种组件状态可区分（direct / indirect / out），以及「运行时配置裁不掉间接组件」这一结论。
预期（2026-10-26）：直接使用 2 / 间接带入 25 / 包外 8；间接体积约 162.5KB，包外约 254.5KB。

```bash
node scripts/audit-usage.mjs scripts/fixtures/minimal-host
```
