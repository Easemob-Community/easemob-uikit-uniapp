import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test, { after, before } from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const hbx = process.env.HBUILDERX_PATH ?? '/Applications/HBuilderX.app/Contents/HBuilderX'
const esbuildBin = process.env.ESBUILD_BIN ?? resolve(hbx, 'plugins/uniapp-cli-vite/node_modules/.bin/esbuild')
const temp = mkdtempSync(join(tmpdir(), 'em-avatar-shape-test-'))
const read = (path) => readFileSync(resolve(root, path), 'utf8')
let api

before(async () => {
  const output = join(temp, 'config.mjs')
  const vuePath = resolve(hbx, 'plugins/uniapp-cli-vite/node_modules/vue')
  execFileSync(esbuildBin, [
    resolve(root, 'uni_modules/easemob-uikit-uni/libs/store/config.ts'),
    '--bundle',
    '--platform=node',
    '--format=esm',
    `--alias:vue=${vuePath}`,
    `--outfile=${output}`
  ], { stdio: 'pipe' })
  api = await import(pathToFileURL(output).href)
})

after(() => {
  rmSync(temp, { recursive: true, force: true })
})

test('全局头像形状默认为圆形', () => {
  assert.equal(api.uiConfig.avatarShape, 'circle')
})

test('运行时和初始化配置遵循显式覆盖与缺省保留', () => {
  api.setConfig({ avatarShape: 'square' })
  assert.equal(api.uiConfig.avatarShape, 'square')

  api.applyKitConfig({ appkey: 'org#app' })
  assert.equal(api.uiConfig.avatarShape, 'square')

  api.applyKitConfig({ appkey: 'org#app', avatarShape: 'circle' })
  assert.equal(api.uiConfig.avatarShape, 'circle')
})

test('头像及页面组件按局部 prop 优先于全局配置回落', () => {
  const avatar = read('uni_modules/easemob-uikit-uni/components/em-avatar/em-avatar.vue')
  const conversation = read('uni_modules/easemob-uikit-uni/components/pages/em-conversation-page/em-conversation-page.vue')
  const conversationItem = read('uni_modules/easemob-uikit-uni/components/em-conversation-item/em-conversation-item.vue')
  const chat = read('uni_modules/easemob-uikit-uni/components/pages/em-chat-page/em-chat-page.vue')
  const group = read('uni_modules/easemob-uikit-uni/components/pages/em-group-page/em-group-page.vue')

  assert.match(avatar, /props\.shape \?\? config\.avatarShape/)
  assert.doesNotMatch(avatar, /shape: 'circle'/)
  assert.match(conversation, /props\.avatarShape \?\? config\.avatarShape/)
  assert.match(conversation, /:avatar-shape="resolvedAvatarShape"/)
  assert.match(conversation, /:shape="resolvedAvatarShape"/)
  assert.doesNotMatch(conversationItem, /avatarShape: 'circle'/)
  assert.match(chat, /props\.avatarShape \?\? config\.avatarShape/)
  assert.match(chat, /:shape="resolvedAvatarShape"/)
  assert.match(group, /:shape="config\.avatarShape"/)
  assert.doesNotMatch(group, /<em-avatar[^>]+shape="square"/)
})
