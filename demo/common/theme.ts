import { useThemeChrome } from '@/uni_modules/easemob-uikit-uni/libs'

export const DEMO_TAB_BAR_PAGES = [
  'pages/conversation/conversation',
  'pages/contact/contact',
  'pages/mine/mine'
]

export function useDemoTheme() {
  return useThemeChrome({ tabBarPages: DEMO_TAB_BAR_PAGES })
}
