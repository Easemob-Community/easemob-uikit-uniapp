# Composables

组合式能力统一从 `@/uni_modules/easemob-uikit-uni/libs` 导入。

## 主题、语言与配置

| 导出 | 返回与用途 |
| --- | --- |
| `useTheme()` | `{ themeClass, isDark, themeStore, setTheme, getTheme }` |
| `useThemeChrome({ tabBarPages, colors? })` | 初始化主题并同步 App/小程序原生 chrome 与 H5 导航栏/tabBar |
| `useLocale()` | 文案读取与语言状态 |
| `useConfig()` / `setConfig(partial)` | 读取与运行时修改 `uiConfig` |
| `useNamespace()` | BEM 命名工具 |

相关一次性函数：`initTheme`、`setTheme`、`getTheme`、`syncNativeThemeUI`、`initLocale`、`setLocale`、`getLocale`、`mergeMessages`。配置字段见[配置参考](./CONFIG.md)。

## 未读与 tabBar

| 导出 | 返回与用途 |
| --- | --- |
| `useUnreadCounts()` | 会话总未读与联系人请求未读的 `ComputedRef` |
| `getUnreadCounts()` | 同一数据的非响应式快照 |
| `useConversationUnreadCount(conversationId)` | 单会话未读响应式值 |
| `useTabBarBadge(options)` | 组合式原生 tabBar 角标控制 |
| `syncTabBarBadges(options)` | 一次性同步角标 |

## 聊天输入行为

`useChatComposer(options)` 为完全自研聊天输入栏提供键盘避让、底部面板、录音手势和禁用态守卫。`options` 必须提供 `disabled`、`onDisabledTap`、`onVoiceSend`。

返回 `UseChatComposerResult`：`panel`、`inputFocus`、`voiceMode`、`recording`、`willCancel`、`keyboardHeight`、`keyboardLift`、`rootStyle`、`panelStyle`、`guardDisabled`、`togglePanel`、`collapse`、`closeKeyboard`、`onInputFocus`、`onInputBlur`、`toggleVoiceMode`、`exitVoiceMode`、`onRecordTouchStart`、`onRecordTouchMove`、`onRecordTouchEnd` 和 `onRecordTouchCancel`。

它不返回 `draft`、`quote` 或 `send`；这些字段属于 `em-chat-page` 的 `#input-bar` 插槽作用域，见[组件公共类型](./API-TYPES-COMPONENTS.md#emchatinputbarscope)，不要与 composable 返回类型混用。

## 安全区

`useSafeArea()` 读取安全区状态；只读几何值也可使用 `getSafeAreaTop()` 与 `getSafeAreaBottom()`。
