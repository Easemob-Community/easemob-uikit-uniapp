import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

test('动作菜单项使用原生文本，避免鸿蒙短文案误省略', () => {
  const component = readFileSync(resolve(root, 'uni_modules/easemob-uikit-uni/components/em-action-sheet/em-action-sheet.vue'), 'utf8')
  assert.match(component, /<text :class="actionTextClass\(action\)" :style="actionTextStyle\(action\)">\{\{ action.text \+ ' ' \}\}<\/text>/)
})

test('动作菜单长文案保留单行省略与收缩约束', () => {
  const styles = readFileSync(resolve(root, 'uni_modules/easemob-uikit-uni/components/em-action-sheet/em-action-sheet.css'), 'utf8')
  assert.match(styles, /\.em-action-sheet__text\s*\{[^}]*min-width: 0;[^}]*flex-shrink: 1;[^}]*overflow: hidden;/s)
  assert.match(styles, /\.em-action-sheet__text\s*\{[^}]*overflow: hidden;[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;[^}]*\}/s)
})

test('动作菜单不使用鸿蒙短文案误省略的 lines 属性', () => {
  const styles = readFileSync(resolve(root, 'uni_modules/easemob-uikit-uni/components/em-action-sheet/em-action-sheet.css'), 'utf8')
  assert.doesNotMatch(styles, /\.em-action-sheet__text\s*\{[^}]*lines: 1;[^}]*\}/s)
})

test('动作菜单渲染文本保留尾随空格，避免鸿蒙省略测量吃掉末字', () => {
  const component = readFileSync(resolve(root, 'uni_modules/easemob-uikit-uni/components/em-action-sheet/em-action-sheet.vue'), 'utf8')
  assert.match(component, /\{\{ action.text \+ ' ' \}\}/)
})

test('动作菜单图标不参与收缩', () => {
  const styles = readFileSync(resolve(root, 'uni_modules/easemob-uikit-uni/components/em-action-sheet/em-action-sheet.css'), 'utf8')
  assert.match(styles, /\.em-action-sheet__icon\s*\{[^}]*flex-shrink: 0;[^}]*\}/s)
})

test('长动作菜单保留左右安全间距', () => {
  const styles = readFileSync(resolve(root, 'uni_modules/easemob-uikit-uni/components/em-action-sheet/em-action-sheet.css'), 'utf8')
  assert.match(styles, /\.em-action-sheet__item\s*\{[^}]*padding: 0 var\(--em-spacing-4\);[^}]*\}/s)
})
