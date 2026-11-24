import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const hbx = process.env.HBUILDERX_PATH ?? '/Applications/HBuilderX.app/Contents/HBuilderX'
const esbuildBin = process.env.ESBUILD_BIN ?? resolve(hbx, 'plugins/uniapp-cli-vite/node_modules/.bin/esbuild')
const pagePath = resolve(root, 'uni_modules/easemob-uikit-uni/components/pages/em-chat-page/em-chat-page.vue')

function createMediaSelect(composer, calls) {
  const source = readFileSync(pagePath, 'utf8')
  const match = source.match(/async function onMediaSelect\(key: string\): Promise<void> \{[\s\S]*?\n\}/)
  assert.notEqual(match, null, '应提取聊天页真实的 onMediaSelect 实现')
  const transformed = execFileSync(esbuildBin, ['--loader=ts'], { input: match[0], encoding: 'utf8' })
  const factory = new Function(
    'composer',
    'MEDIA_PANEL_KEY',
    'onPickImage',
    'onPickVideo',
    'onPickFile',
    `${transformed}\nreturn onMediaSelect`
  )
  return factory(
    composer,
    { ALBUM: 'album', CAMERA: 'camera', VIDEO: 'video', FILE: 'file' },
    async () => { calls.push('image') },
    async () => { calls.push('video') },
    async () => { calls.push('file') }
  )
}

test('自绘输入栏选择媒体前先收起面板', async () => {
  const calls = []
  const onMediaSelect = createMediaSelect({ collapse: () => calls.push('collapse') }, calls)

  await onMediaSelect('album')

  assert.deepEqual(calls, ['collapse', 'image'])
})

test('默认输入栏没有页面 composer 时媒体选择保持原链路', async () => {
  const calls = []
  const onMediaSelect = createMediaSelect(null, calls)

  await onMediaSelect('video')

  assert.deepEqual(calls, ['video'])
})


function createTextInputHarness(quickReplyMode) {
  const source = readFileSync(pagePath, 'utf8')
  const extract = (name, required = true) => {
    const match = source.match(new RegExp(`function ${name}\\([^)]*\\): [^{]+\\{[\\s\\S]*?\\n\\}`))
    if (required) assert.notEqual(match, null, `应提取聊天页真实的 ${name} 实现`)
    return match?.[0] ?? ''
  }
  const transformed = execFileSync(esbuildBin, ['--loader=ts'], {
    input: [
      extract('revealTextInput', false),
      extract('quickReplyTextOf'),
      extract('onQuickReply'),
      extract('enterEditMode'),
      extract('onReeditMessage')
    ].join('\n'),
    encoding: 'utf8'
  })
  const inputbarTextSignal = { value: 0 }
  const draft = { value: '' }
  const quoteInfo = { value: { text: 'quote' } }
  const editingMessage = { value: null }
  const sent = []
  const factory = new Function(
    'composer',
    'inputbarTextSignal',
    'sendingText',
    'isMutedAll',
    'onMuteAllTap',
    'props',
    'sendQuickReplyText',
    'draft',
    'MESSAGE_TYPE',
    'MESSAGE_STATUS',
    'quoteInfo',
    'editingMessage',
    'setDraftValue',
    'exitEditMode',
    `${transformed}\nreturn { revealTextInput: typeof revealTextInput === 'function' ? revealTextInput : () => {}, quickReplyTextOf, onQuickReply, enterEditMode, onReeditMessage }`
  )
  const api = factory(
    null,
    inputbarTextSignal,
    { value: false },
    { value: false },
    () => {},
    { quickReplyMode },
    (text) => { sent.push(text) },
    draft,
    { TEXT: 'text' },
    { RECALLED: 'recalled' },
    quoteInfo,
    editingMessage,
    (value) => { draft.value = value },
    () => { editingMessage.value = null }
  )
  return { ...api, inputbarTextSignal, draft, quoteInfo, editingMessage, sent }
}

test('填充型快捷回复先恢复文本输入再替换草稿', () => {
  const harness = createTextInputHarness('fill')

  harness.onQuickReply({ label: '简短话术', text: '完整话术' })

  assert.equal(harness.inputbarTextSignal.value, 1)
  assert.equal(harness.draft.value, '完整话术')
  assert.equal(harness.sent.length, 0)
})

test('直发型快捷回复不触发文本输入恢复信号', () => {
  const harness = createTextInputHarness('send')

  harness.onQuickReply({ label: '简短话术', text: '完整话术' })

  assert.equal(harness.inputbarTextSignal.value, 0)
  assert.deepEqual(harness.sent, ['完整话术'])
})

test('编辑消息先恢复文本输入再回显原文', () => {
  const harness = createTextInputHarness('fill')
  const message = { type: 'text', status: 'sent', text: '原始消息' }

  harness.enterEditMode(message)

  assert.equal(harness.inputbarTextSignal.value, 1)
  assert.equal(harness.draft.value, '原始消息')
  assert.equal(harness.editingMessage.value, message)
  assert.equal(harness.quoteInfo.value, null)
})

test('撤回重编辑先恢复文本输入再回显原文', () => {
  const harness = createTextInputHarness('fill')

  harness.onReeditMessage({ type: 'text', status: 'recalled', text: '撤回原文' })

  assert.equal(harness.inputbarTextSignal.value, 1)
  assert.equal(harness.draft.value, '撤回原文')
  assert.equal(harness.editingMessage.value, null)
})
