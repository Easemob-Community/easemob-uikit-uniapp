import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const host = process.env.EM_HOST_DEMO_ROOT
const hasHost = host != null && existsSync(host)
const hbx = process.env.HBUILDERX_PATH ?? '/Applications/HBuilderX.app/Contents/HBuilderX'
const esbuildBin = process.env.ESBUILD_BIN ?? resolve(hbx, 'plugins/uniapp-cli-vite/node_modules/.bin/esbuild')

function loadRemoveLastGrapheme() {
  const source = readFileSync(resolve(root, 'uni_modules/easemob-uikit-uni/libs/utils/unicode.ts'), 'utf8')
  const output = execFileSync(esbuildBin, ['--loader=ts', '--format=cjs'], { input: source, encoding: 'utf8' })
  const module = { exports: {} }
  new Function('module', 'exports', output)(module, module.exports)
  return module.exports.removeLastGrapheme
}

test('退格删除普通字符、末尾 Emoji 与换行边界', () => {
  const removeLastGrapheme = loadRemoveLastGrapheme()

  assert.equal(removeLastGrapheme(''), '')
  assert.equal(removeLastGrapheme('abc'), 'ab')
  assert.equal(removeLastGrapheme('A😀'), 'A')
  assert.equal(removeLastGrapheme('甲\n😀'), '甲\n')
  assert.equal(removeLastGrapheme('甲\r\n'), '甲')
})

test('退格删除完整组合字素', () => {
  const removeLastGrapheme = loadRemoveLastGrapheme()

  const cases = ['A☠️', '👍🏽', '👨‍👩‍👧‍👦', '🇨🇳', '1️⃣', 'e\u0301', 'عَ', 'का', '가', 'A가', 'A각', 'A각']
  const expected = ['A', '', '', '', '', '', '', '', '', 'A', 'A', 'A']
  cases.forEach((value, index) => {
    assert.equal(removeLastGrapheme(value), expected[index])
  })
})

test('退格按钮使用主题化半透明悬浮背景且不影响图标透明度', () => {
  const variables = readFileSync(resolve(root, 'uni_modules/easemob-uikit-uni/libs/style/variables.css'), 'utf8')
  const css = readFileSync(resolve(root, 'uni_modules/easemob-uikit-uni/components/em-chat-inputbar/em-chat-inputbar.css'), 'utf8')
  const deleteBlock = css.match(/\.em-chat-inputbar__emoji-delete\s*\{([^}]*)\}/)

  assert.match(variables, /--em-chat-emoji-delete-bg: rgba\(255, 255, 255, 0\.72\)/)
  assert.match(variables, /--em-chat-emoji-delete-bg: rgba\(42, 42, 48, 0\.78\)/)
  assert.notEqual(deleteBlock, null)
  assert.match(deleteBlock[1], /background-color: var\(--em-chat-emoji-delete-bg\)/)
  assert.match(deleteBlock[1], /box-shadow: 0 2px 8px var\(--em-divider-color\)/)
  assert.doesNotMatch(deleteBlock[1], /opacity:/)
})

test('外部宿主同步半透明退格按钮样式', { skip: !hasHost }, () => {
  const hostVariables = readFileSync(resolve(host, 'uni_modules/easemob-uikit-uni/libs/style/variables.css'), 'utf8')
  const hostInputbar = readFileSync(resolve(host, 'uni_modules/easemob-uikit-uni/components/em-chat-inputbar/em-chat-inputbar.css'), 'utf8')
  const hostPanel = readFileSync(resolve(host, 'sub-im/components/demo-emoji-panel/demo-emoji-panel.uvue'), 'utf8')
  assert.match(hostVariables, /--em-chat-emoji-delete-bg: rgba\(255, 255, 255, 0\.72\)/)
  assert.match(hostVariables, /--em-chat-emoji-delete-bg: rgba\(42, 42, 48, 0\.78\)/)
  assert.match(hostInputbar, /background-color: var\(--em-chat-emoji-delete-bg\)/)
  assert.match(hostPanel, /background-color: var\(--em-chat-emoji-delete-bg\)/)
  assert.doesNotMatch(hostPanel, /opacity:/)
})


test('外部宿主集成测试不依赖固定本机路径', () => {
  const files = ['scripts/test-emoji-delete.mjs', 'scripts/test-gif-injection.mjs']
  files.forEach((file) => {
    const source = readFileSync(resolve(root, file), 'utf8')
    assert.doesNotMatch(source, /\/Users\//)
  })
})
