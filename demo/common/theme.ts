import { onShow } from '@dcloudio/uni-app'
import { watch } from 'vue'
import {
  initTheme,
  syncNativeThemeUI,
  themeStore,
  THEME_MODE,
  useTheme
} from '@/uni_modules/easemob-uikit-uni/libs'

// demo 宿主接线：主题引擎的全局初始化 + 每个页面的原生导航栏/tabBar 同步。
// 页面根节点把 useDemoTheme().themeClass 绑上即可；深/浅色 token 由 libs/style/variables.css 提供。

export const DEMO_TAB_BAR_PAGES = [
  'pages/conversation/conversation',
  'pages/contact/contact',
  'pages/mine/mine'
]

const TAB_BAR_SELECTED_COLOR = '#009EFF'
const TAB_BAR_LIGHT_COLOR = '#919BA1'
const TAB_BAR_DARK_COLOR = '#9AA0A6'

function currentRoute(): string {
  // #ifdef WEB
  try {
    const hash: string = (window as any).location.hash as string
    return hash.replace(/^#\/?/, '')
  } catch (e) {
    return ''
  }
  // #endif
  // #ifndef WEB
  return ''
  // #endif
}

// H5 无 setNavigationBarColor / setTabBarStyle：uni 内置导航栏与 tabBar 是普通 DOM，
// 这里按生效主题直写样式（导航栏同时有 index.html 的 html[data-em-theme] CSS 首帧兜底）。
function syncH5Chrome(): void {
  // #ifdef WEB
  try {
    const dark = themeStore.mode === THEME_MODE.DARK
    const head: any = document.querySelector('.uni-page-head')
    if (head != null) {
      head.style.backgroundColor = dark ? '#1E2123' : '#FFFFFF'
      head.style.color = dark ? '#FFFFFF' : '#171A1C'
    }
    const bar: any = document.querySelector('.uni-tabbar')
    if (bar != null) {
      bar.style.backgroundColor = dark ? '#1E2123' : '#FFFFFF'
    }
    const border: any = document.querySelector('.uni-tabbar-border')
    if (border != null) {
      border.style.backgroundColor = dark ? '#333537' : 'rgba(0, 0, 0, 0.33)'
    }
    const route = currentRoute()
    const labels: any = document.querySelectorAll('.uni-tabbar__label')
    for (let i = 0; i < labels.length; i++) {
      const label: any = labels[i]
      const active = i < DEMO_TAB_BAR_PAGES.length && DEMO_TAB_BAR_PAGES[i] === route
      label.style.color = active ? TAB_BAR_SELECTED_COLOR : dark ? TAB_BAR_DARK_COLOR : TAB_BAR_LIGHT_COLOR
    }
  } catch (e) {}
  // #endif
}

function syncChrome(): void {
  syncNativeThemeUI()
  syncH5Chrome()
}

export function useDemoTheme() {
  initTheme({ tabBarPages: DEMO_TAB_BAR_PAGES })
  const theme = useTheme()

  // onShow 补同步：从非 tab 页返回、或原生 chrome 被宿主重置后，进入页面即纠正颜色
  onShow(() => {
    syncChrome()
  })

  // 页面存活期间切主题（我的页选择 / 系统深浅色变化）立即同步原生 chrome
  watch(
    () => themeStore.mode,
    () => {
      syncChrome()
    }
  )

  return theme
}
