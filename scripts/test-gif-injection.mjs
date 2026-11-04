import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const host = '/Users/neohuang/Desktop/WorkCommonUse/easemob-uniappx-demo-534'
const read = (path) => readFileSync(resolve(root, path), 'utf8')
const readHost = (path) => readFileSync(resolve(host, path), 'utf8')

test('UIKit exposes opt-in emoji and image rendering slots with built-in fallbacks', () => {
  const inputbar = read('uni_modules/easemob-uikit-uni/components/em-chat-inputbar/em-chat-inputbar.vue')
  const page = read('uni_modules/easemob-uikit-uni/components/pages/em-chat-page/em-chat-page.vue')
  assert.match(inputbar, /name="emoji-panel"/)
  assert.match(inputbar, /:emojis="emojis"/)
  assert.match(inputbar, /:select-emoji="onEmoji"/)
  assert.match(inputbar, /emoji-grid/)
  assert.match(page, /name="emoji-panel"/)
  assert.match(page, /name="image-message"/)
  assert.match(page, /<em-image-message/)
  assert.doesNotMatch(page, /v-bind="scope"/)
  assert.match(page, /:select-emoji="scope.selectEmoji"/)
})

test('UIKit sends image ext and preserves GIF metadata without owning sticker configuration', () => {
  const kit = read('uni_modules/easemob-uikit-uni/libs/index.ts')
  const chat = read('uni_modules/easemob-uikit-uni/libs/chat/index.ts')
  const message = read('uni_modules/easemob-uikit-uni/libs/chat/message.ts')
  const types = read('uni_modules/easemob-uikit-uni/libs/types/index.ts')
  assert.match(kit, /sendImage\(to: string, chatType: ConversationTypeValue, image: EmPickedImage, ext\?: Record<string, unknown>\)/)
  assert.match(chat, /sendImage\(to: string, chatType: ConversationTypeValue, image: EmPickedImage, ext\?: Record<string, unknown>\)/)
  assert.match(chat, /this\.messages\.sendImage\(to, chatType, image, ext\)/)
  assert.match(message, /originalUrl: image\.path/)
  assert.match(message, /isGif/)
  assert.match(message, /ext: Object\.keys\(item\.ext\)/)
  assert.match(types, /interface EmChatEmojiPanelScope/)
  assert.match(types, /interface EmChatImageMessageScope/)
  assert.match(types, /originalUrl: string/)
  assert.match(types, /isGif: boolean/)
  assert.doesNotMatch(types, /stickerPacks/)
})

test('Host demo owns GIF panel, sending and rendering through the generic slots', () => {
  const chat = readHost('sub-im/pages/chat/chat.uvue')
  const stickers = readHost('common/demo-stickers.ts')
  const panel = readHost('sub-im/components/demo-emoji-panel/demo-emoji-panel.uvue')
  const image = readHost('sub-im/components/demo-image-message/demo-image-message.uvue')
  const prepare = readHost('scripts/prepare-sdk-subpackage.mjs')
  assert.match(chat, /#emoji-panel="scope"/)
  assert.match(chat, /#image-message="scope"/)
  assert.doesNotMatch(chat, /v-bind="scope"/)
  assert.match(chat, /:select-emoji="scope.selectEmoji"/)
  assert.match(stickers, /isSticker: true/)
  assert.match(stickers, /originalUrl/)
  assert.match(stickers, /#ifdef APP/)
  assert.match(stickers, /'\/static\/emojis\/huanxin'/)
  assert.match(panel, /select-sticker/)
  assert.match(image, /isDemoSticker/)
  assert.match(image, /<em-image-message/)
  assert.match(prepare, /rmSync\(resolve\(outDir, 'static\/emojis'\)/)
  for (const key of ['debug', 'biubiu', 'like']) {
    assert.equal(existsSync(resolve(host, `sub-im/static/emojis/huanxin/${key}.gif`)), true)
    assert.equal(existsSync(resolve(host, `sub-im/static/emojis/huanxin/${key}-封面.jpg`)), true)
    assert.equal(existsSync(resolve(host, `static/emojis/huanxin/${key}.gif`)), true)
    assert.equal(existsSync(resolve(host, `static/emojis/huanxin/${key}-封面.jpg`)), true)
  }
})
