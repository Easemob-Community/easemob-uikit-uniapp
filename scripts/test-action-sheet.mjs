import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

test('动作菜单长文案使用 em-text 单行省略', () => {
  const component = readFileSync(resolve(root, 'uni_modules/easemob-uikit-uni/components/em-action-sheet/em-action-sheet.vue'), 'utf8')
  assert.match(component, /<em-text :text="action.text" :lines="1" :text-class="actionTextClass\(action\)" :text-style="actionTextStyle\(action\)" \/>/)
})
