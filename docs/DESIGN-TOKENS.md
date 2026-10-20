# 设计 token 平移记录（Web 版 → uni 版）

> 来源：`easemob-uikit-vue/packages/uikit-core/src/theme/index.css`（769 行，纯 CSS 变量）+ `easemob-uikit-vue/docs/DESIGN-TOKEN-MAPPING.md`。
> 产物：`uni_modules/easemob-uikit-uni/libs/style/variables.css`（`--em-*`，`.em-theme-light` / `.em-theme-dark` 双层 class）。
> 本文是 M3 token 体系定稿的底稿；新增/调整 token 时同步更新本文。

## 命名映射

`--uikit-<域>-<属性>[-<档位>]` → `--em-<域>-<属性>[-<档位>]`，结构与档位原样保留。

## 主题机制差异

| 项 | Web 版 | uni 版 |
|---|---|---|
| 挂载点 | `:root` + `[data-uikit-theme="dark"]` 属性选择器 | `.em-theme-light` / `.em-theme-dark` class，页面级组件根节点绑定（App 端挂根节点的 RiceUI trick） |
| 切换执行 | `store/theme.ts` 写 documentElement attribute | `useTheme().setTheme('auto'\|'light'\|'dark')` 改 reactive store（默认 auto），`themeClass` computed 供模板绑定；`initTheme()` 读偏好/系统主题并订阅系统变化 |
| 系统跟随 | `usePreferredColorScheme`（media query） | `auto` 时 App 读 `deviceInfo.osTheme` + `onOsThemeChange`、Web 用 `matchMedia`、小程序读 `hostTheme` + `onHostThemeChange`；偏好持久化 `emkit.themeMode` |
| 原生 chrome | — | `syncNativeThemeUI()` 动态 setNavigationBarColor / setTabBarStyle；demo 配 `theme.json` + manifest `darkmode` 保证首帧 |
| 密度档 | `[data-uikit-density]` 三档 | 一期不做，直接取 normal 档数值 |
| 动画档 | `[data-uikit-anim-level]` 三档 + ripple | 一期不做 |

## 已平移（一期最小集，约 80 个）

- 主色/功能色：primary（`#33B1FF`）+ hover、success/warning/danger/info（暗色单独调色已搬）
- 文字 4 阶、icon-muted、背景 6 档（base/secondary/tertiary/elevated/hover/active）+ control-bg
- 边框 2 + 分割线 1
- 间距 7 档（4/8/12/16/24/32/48）
- 字号 8 档（10/12/13/14/16/18/20/28）、字重 4、行高 3
- 圆角 5（组件 8 / 气泡 16·8 / 文件卡 12 / 输入框胶囊 999）
- 列表与消息区尺寸 4（cell-height 64、bubble-gap 8、message-gap 16、message-padding 12，取 normal 密度档）
- 气泡族 6 + message-chip-bg + quote-line
- 页面语义背景 4（chat/input/conversation-list/input-border）
- 空状态 2、badge 2
- 文件类型图标底色 9（暗色有独立调色的已搬暗色值）

## 降级处理

| Web 版做法 | uni 版降级 | 原因 |
|---|---|---|
| `--uikit-font-size-N: calc(Npx × font-scale)` 适老缩放 | 静态 px 值，无 font-scale | ucss 对 calc+var 组合支持受限；一期不做适老缩放 |
| `color-mix()` 派生（primary-soft、switch on-disabled、halo） | 不搬；需要时写明暗双份字面量 | App 端不支持 color-mix |
| `--uikit-bg-active: rgba(var(--uikit-primary-rgb), .12)` | 直接写 `rgba(51,177,255,0.12)` | 省一层 rgb 变量间接（主色运行时换肤一期不做） |
| 暗色 `--uikit-bubble-bg-other: var(--uikit-control-bg)` | 直接写 `#333537` 字面量 | 减少变量链，ucss 友好 |

## 未平移（一期不需要或 web 专属）

- 阴影系统（shadow/sm/hover、switch 手柄落影、track inner shadow）：ucss 基本不可用
- 动画系统全套（duration/easing/scale/ripple/overlay/stagger/转场关键帧）：一期无转场需求，需要时只搬时长与缓动数值
- 滚动条美化、`::selection`、backdrop blur、`env(safe-area-inset-*)`、`prefers-reduced-motion`：web 专属
- sidebar 宽度（clamp/25%）、modal-width-ratio：PC 布局专属
- Switch、Drawer、成员标签、Presence 相关 token：对应组件二期再做
- 字体族 token（Inter/Noto Sans SC webfont 栈）：App/小程序端无效，各端用系统字体
- z-index：不做静态分层 token，沿用 Web 版思路用运行时递增分配器（基准 2000），随 EmPopup 组件落地

## 数值校准口径

色值以 vue 版 `theme/index.css` 注释中引用的设计稿校准记录为准（如己方气泡品牌蓝 `#009EFF` 不跟随主色、badge 红 `#FF7070` 独立于 danger 色、暗色选中底 `#0D2840` 固定值等），这些惯例在 uni 版继续成立。
