---
name: em-plugin-publishing
description: Use when publishing or updating easemob-uikit-uni through the DCloud web publish form, preparing its ZIP/Markdown/screenshot materials, or debugging errors such as "插件包指定目录 components/easemob-uikit-uni 不存在", "压缩包根目录是否正确", or "单个标签限制最长20个字符".
---

# DCloud 插件网页发布

## Overview

本技能只用于 `https://ext.dcloud.net.cn/manage/publish` 网页表单。字段以 `uni_modules/easemob-uikit-uni/package.json` 为主数据源，发布门禁和回滚以当前版本对应的 `docs/RELEASE-<主版本.次版本>.md`（如 1.0.x 使用 `RELEASE-1.0.md`）为准；不要用网页上传 ZIP 的结构去推断 HBuilderX 右键发布的内部格式。

## 1. 发布前核对

- 读取插件 `package.json`、`readme.md`、`changelog.md` 和当前 RELEASE 清单，核对版本、平台、价格、权限与数据声明。
- 完成 RELEASE 中适用于本次发布的验证；网页显示“上传成功”不等于这些门禁通过。
- 不写入或上传真实 appkey、token、签名材料、本机路径、`node_modules/`、`.git/`、`unpackage/` 或 `.DS_Store`。
- 若 DCloud 未登录，让用户在可见浏览器中自行登录，不索取账号密码。

## 2. 制作网页上传 ZIP

**ZIP 根目录必须直接包含 `package.json`。** 不要额外包 `uni_modules/`、`easemob-uikit-uni/` 或项目目录。

正确结构：

```text
package.json
components/
libs/
assets/
license.md
readme.md
changelog.md
```

从仓库根目录生成并检查：

```bash
mkdir -p dist/publish
rm -f dist/publish/easemob-uikit-uni.zip
(
  cd uni_modules/easemob-uikit-uni
  zip -q -r -X ../../dist/publish/easemob-uikit-uni.zip . \
    -x '.DS_Store' '*/.DS_Store' \
       'node_modules/*' '*/node_modules/*' \
       '.git/*' '*/.git/*' \
       'unpackage/*' '*/unpackage/*'
)
unzip -l dist/publish/easemob-uikit-uni.zip
unzip -t dist/publish/easemob-uikit-uni.zip
```

`unzip -l` 必须显示根级 `package.json`，不得只显示 `easemob-uikit-uni/package.json` 或 `uni_modules/easemob-uikit-uni/package.json`。同时检查完整清单不含 `node_modules/`、`.git/`、`unpackage/`、`.DS_Store`、凭据或本机路径文件；排除参数不能代替人工复核。

## 3. 填写表单

| 字段 | 填写口径 |
|---|---|
| 分类 | 一级选 `前端组件`，二级选 `vue 组件`；uni-app x 的 uni_modules 组件不要改成 JS SDK、UTS 或项目模板 |
| 名称、ID、版本、简介 | 使用插件 `package.json` 的对应字段 |
| 标签 | **用空格分隔**，例如 `环信 easemob IM 聊天 uni-app-x`；每个标签单独不超过 20 字符，不用逗号拼接 |
| 价格与协议 | 普通授权版 `0`；免费插件按包内 `license.md`，当前为 MIT |
| Git 仓库 | `https://github.com/Easemob-Community/easemob-uikit-uniapp` |
| 支持版本 | 仅勾选 `uni-app x`，最低版本按 `package.json` 的 engines 与 RELEASE |
| 平台 | 按 `package.json` 的 `uni_modules.platforms.client['uni-app-x']` 逐项设置，不勾经典 uni-app |
| 蒸汽/宽屏/多语言/暗黑 | 按 `package.json.dcloudext`；当前为 是/否/是/是 |
| 权限、数据、广告 | 使用 `package.json.dcloudext.declaration`，数据说明补充即时通讯用途 |

更新日志只写本次主要变更，支持 Markdown；**不要重复填写版本号和日期**，不要粘贴整份使用说明。

## 4. 上传说明与预览图

- 插件使用说明上传 UTF-8 `.md` 文件；以插件 `readme.md` 为底稿，保留安装、初始化、最小链路、平台边界和已知限制。
- 开发文档链接放在说明开头：`https://easemob-community-docs.easemob.com/uniapp/`。
- Markdown 图片必须改为可公开访问的 URL，不能保留本地相对图片路径；优先使用文档站资源或公开 GitHub 仓库的 raw 地址，并验证 URL 可访问。
- 截图使用真实界面，统一尺寸（当前物料为 1080×2340），单张小于 1MB，格式用 JPG/PNG/GIF；优先覆盖会话、消息、群组、业务扩展和 AI 流式。
- 当前表最多展示 5 张；新增入口消失后不要继续选择文件，应删除或替换现有图。
- 文件选择工具的 `uploaded` 回执只表示文件已交给页面。必须再看到页面“上传成功”和正确缩略图；若仍显示旧图或重试图标，转为 JPG 后重试并复核。

## 5. 提交与上线核对

1. 回读所有字段，确认 ZIP 根目录、标签、分类、价格、平台矩阵和三项声明无误。
2. 确认插件包、使用说明和全部预览图均上传成功；示例工程为可选项，未上传时保持为空，只有页面实际校验要求时才补充完整工程。
3. 最终“发布”及“确定”会直接对外上线；只有在用户明确授权后点击。
4. 提交后检查成功提示和插件市场公开详情页；只有公开可见、可下载并可导入才算上线。
5. 若校验失败，保留表单内容，定位具体字段或包结构后重试，不重复创建不同分类的插件。

## Common Mistakes

| 症状 | 根因与处理 |
|---|---|
| `插件包指定目录 components/easemob-uikit-uni 不存在` | 网页未识别 uni_modules 包。让 ZIP 根目录直接包含 `package.json`，不要改分类 |
| `单个标签限制最长20个字符` 且提示整串内容 | 逗号被当成普通字符；改为空格分隔标签 |
| 更新日志与详情重复 | 日志仅保留本次变更摘要，删除版本号、日期和完整接入文档 |
| 文件已选择但发布时校验失败 | 不以文件选择回执为准；检查页面上传状态、包结构和实际缩略图 |
| 截图新增入口消失 | 当前 5 张上限；替换低价值截图，不要反复上传 |
