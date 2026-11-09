import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import test, { after, before } from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const hbx = process.env.HBUILDERX_PATH ?? '/Applications/HBuilderX.app/Contents/HBuilderX'
const esbuildBin = process.env.ESBUILD_BIN ?? resolve(hbx, 'plugins/uniapp-cli-vite/node_modules/.bin/esbuild')
const temp = mkdtempSync(join(tmpdir(), 'em-multi-body-test-'))
let api

function parent() {
  return {
    id: 'server-parent', localId: 'local-parent', conversationId: 'group-1', chatType: 'groupChat',
    type: 'multi_body', text: '', url: '', thumbUrl: '', originalUrl: '', isGif: false,
    width: 0, height: 0, time: 1700000000000, from: 'peer', to: 'group-1', self: true,
    status: 'sending', quote: { msgId: 'quoted', from: 'peer', text: 'quote' }, duration: 0,
    fileName: '', fileSize: 0, ext: { em_at_list: ['designer'], source: 'vue' }, rawType: 'multi_body',
    customEvent: '', customParams: {}, stream: { fullText: 'parent stream' },
    modifiedInfo: { operatorId: 'peer', operationCount: 1, operationTime: 1 }, uploadProgress: 40
  }
}

function bodies() {
  return [
    { type: 'text', content: '请看资料' },
    { type: 'image', localUrl: '', originalImageUrl: 'https://example.com/original.png', bigImageUrl: 'https://example.com/big.png', thumbnailUrl: 'https://example.com/thumb.png', width: 640, height: 320, isGif: true, secret: 'image-secret' },
    { type: 'file', url: 'https://example.com/spec.pdf', filename: 'spec.pdf', fileLength: 2048, secret: 'file-secret' },
    { type: 'voice', url: 'https://example.com/voice.amr', duration: 3 },
    { type: 'video', url: 'https://example.com/video.mp4', thumbnailUrl: 'https://example.com/video.png', duration: 8, width: 1280, height: 720 },
    { type: 'location', latitude: 31.2304, longitude: 121.4737, address: '上海', buildingName: '环信' },
    { type: 'custom', event: 'userCard', params: { userId: 'user-1' } }
  ]
}

const translations = {
  'message.image': '[图片]', 'message.audio': '[语音]', 'message.video': '[视频]',
  'message.file': '[文件]', 'message.location': '[位置]', 'message.custom': '[自定义消息]',
  'message.multiBody': '[复合消息]', 'message.unsupported': '[暂不支持的消息]'
}
const t = (key) => translations[key] ?? key

before(async () => {
  const entry = join(temp, 'entry.ts')
  const output = join(temp, 'bundle.mjs')
  writeFileSync(entry, `
    export { applyMessageBody, toMultiBodySegmentItems, multiBodyPreviewFromWire } from '${resolve(root, 'uni_modules/easemob-uikit-uni/libs/chat/message-body.ts')}'
    export { multiBodyTextOf, multiBodyPreviewOf, multiBodyVisibleSegmentsOf } from '${resolve(root, 'uni_modules/easemob-uikit-uni/libs/utils/multi-body.ts')}'
    export { EmMessageDomain } from '${resolve(root, 'uni_modules/easemob-uikit-uni/libs/chat/message.ts')}'
    export { downloadRequestUrlOf } from '${resolve(root, 'uni_modules/easemob-uikit-uni/libs/utils/download.ts')}'
  `)
  const vuePath = resolve(hbx, 'plugins/uniapp-cli-vite/node_modules/vue')
  execFileSync(esbuildBin, [entry, '--bundle', '--platform=node', '--format=esm', `--alias:vue=${vuePath}`, `--outfile=${output}`], { stdio: 'pipe' })
  api = await import(pathToFileURL(output).href)
})

after(() => rmSync(temp, { recursive: true, force: true }))

test('projects all seven segment types in wire order with independent display identities', () => {
  const segments = api.toMultiBodySegmentItems(parent(), bodies())
  assert.deepEqual(segments.map((item) => item.type), ['text', 'image', 'file', 'audio', 'video', 'location', 'custom'])
  assert.deepEqual(segments.map((item) => item.localId), bodies().map((_, index) => `local-parent:${index}`))
  segments.forEach((item, index) => {
    assert.equal(item.id, '')
    assert.equal(item.status, 'sent')
    assert.equal(item.self, true)
    assert.equal(item.from, 'peer')
    assert.deepEqual(item.ext, { em_at_list: ['designer'], source: 'vue' })
    assert.equal(item.quote, null)
    assert.equal(item.stream, undefined)
    assert.equal(item.modifiedInfo, undefined)
    assert.equal(item.uploadProgress, undefined)
    assert.equal(item.segments, undefined)
    assert.notEqual(item.ext, parent().ext)
    assert.equal(item.localId.endsWith(`:${index}`), true)
  })
})

test('maps media, location, custom fields and attachment secrets to existing message consumers', () => {
  const segments = api.toMultiBodySegmentItems(parent(), bodies())
  assert.equal(segments[0].text, '请看资料')
  assert.equal(segments[1].url, 'https://example.com/big.png')
  assert.equal(segments[1].thumbUrl, 'https://example.com/thumb.png')
  assert.equal(segments[1].originalUrl, 'https://example.com/original.png')
  assert.equal(segments[1].isGif, true)
  assert.equal(segments[1].width, 640)
  assert.equal(segments[1].height, 320)
  assert.equal(segments[1].attachmentSecret, 'image-secret')
  assert.equal(segments[2].fileName, 'spec.pdf')
  assert.equal(segments[2].fileSize, 2048)
  assert.equal(segments[2].attachmentSecret, 'file-secret')
  assert.equal(segments[3].duration, 3)
  assert.equal(segments[4].thumbUrl, 'https://example.com/video.png')
  assert.equal(segments[5].address, '上海')
  assert.equal(segments[5].buildingName, '环信')
  assert.equal(segments[5].latitude, 31.2304)
  assert.equal(segments[6].customEvent, 'userCard')
  assert.deepEqual(segments[6].customParams, { userId: 'user-1' })
})

test('joins only text segments for copying and derives the preview from the first segment', () => {
  const segments = api.toMultiBodySegmentItems(parent(), [
    bodies()[0], bodies()[1], { type: 'text', content: '第三版已更新' }
  ])
  assert.equal(api.multiBodyTextOf(segments), '请看资料\n第三版已更新')
  assert.equal(api.multiBodyPreviewOf(segments, t), '请看资料 ...')
  assert.equal(api.multiBodyPreviewOf(api.toMultiBodySegmentItems(parent(), [bodies()[2], bodies()[0]]), t), 'spec.pdf ...')
  assert.equal(api.multiBodyPreviewOf(api.toMultiBodySegmentItems(parent(), [bodies()[1], bodies()[0]]), t), '[图片] ...')
})

test('falls back to the composite label for empty or unusable bodies', () => {
  assert.equal(api.multiBodyPreviewFromWire([], t), '[复合消息]')
  assert.equal(api.multiBodyPreviewFromWire(null, t), '[复合消息]')
  assert.equal(api.multiBodyPreviewFromWire([{ type: 'text', content: '' }], t), '[复合消息]')
  assert.equal(api.multiBodyPreviewFromWire([{ type: 'future', content: 'future' }], t), '[复合消息]')
  assert.equal(api.multiBodyTextOf(api.toMultiBodySegmentItems(parent(), null)), '')
})

test('ordinary body mapping stays compatible and never creates nested segments', () => {
  const item = parent()
  item.type = 'other'
  item.segments = undefined
  api.applyMessageBody(item, 'voice', { url: 'https://example.com/normal.amr', duration: 6 })
  assert.equal(item.type, 'audio')
  assert.equal(item.url, 'https://example.com/normal.amr')
  assert.equal(item.duration, 6)
  assert.equal(item.segments, undefined)
})


test('real message domain converts an SDK multi_body object into the parent and ordered display segments', () => {
  const domain = new api.EmMessageDomain({ client: null, waitOnline: null })
  const item = domain.toMessageItem({
    msgServerId: 'server-multi', msgLocalId: 'local-multi', from: 'peer', to: 'me',
    sender: { userId: 'peer' }, conversationId: 'peer', conversationType: 'singleChat',
    type: 'multi_body', sendStatus: 'sent', ext: { source: 'sdk-5.2.0' },
    timestamp: 1700000000000, body: bodies()
  })
  assert.equal(item.type, 'multi_body')
  assert.equal(item.id, 'server-multi')
  assert.equal(item.localId, 'local-multi')
  assert.equal(item.text, '请看资料')
  assert.equal(item.rawType, '')
  assert.equal(item.ext.source, 'sdk-5.2.0')
  assert.equal(item.segments.length, 7)
  assert.deepEqual(item.segments.map((segment) => segment.type), ['text', 'image', 'file', 'audio', 'video', 'location', 'custom'])
  assert.equal(item.segments[2].attachmentSecret, 'file-secret')
})


test('empty text segments do not produce copyable newlines', () => {
  const segments = api.toMultiBodySegmentItems(parent(), [
    { type: 'text', content: '' }, { type: 'image', thumbnailUrl: 'https://example.com/empty.png' }, { type: 'text', content: '' }
  ])
  assert.equal(api.multiBodyTextOf(segments), '')
})

test('location segments without coordinates stay absent instead of becoming zero coordinates', () => {
  const segments = api.toMultiBodySegmentItems(parent(), [{ type: 'location', address: '仅地址' }])
  assert.equal(segments[0].address, '仅地址')
  assert.equal(segments[0].latitude, undefined)
  assert.equal(segments[0].longitude, undefined)
})


test('top-level location keeps the legacy OTHER and rawType custom-rendering contract', () => {
  const domain = new api.EmMessageDomain({ client: null, waitOnline: null })
  const item = domain.toMessageItem({
    msgServerId: 'server-location', msgLocalId: 'local-location', from: 'peer', to: 'me',
    sender: { userId: 'peer' }, conversationId: 'peer', conversationType: 'singleChat',
    type: 'location', sendStatus: 'sent', ext: {}, timestamp: 1700000000000,
    body: { latitude: 31.2, longitude: 121.4, address: '上海' }
  })
  assert.equal(item.type, 'other')
  assert.equal(item.rawType, 'location')
  assert.equal(item.segments, undefined)
})

test('visible segments remove empty text without hiding following media', () => {
  const emptyOnly = api.multiBodyVisibleSegmentsOf(api.toMultiBodySegmentItems(parent(), [{ type: 'text', content: '' }]))
  assert.deepEqual(emptyOnly, [])
  const mixed = api.multiBodyVisibleSegmentsOf(api.toMultiBodySegmentItems(parent(), [
    { type: 'text', content: '' }, bodies()[1], { type: 'text', content: '保留' }
  ]))
  assert.deepEqual(mixed.map((item) => item.type), ['image', 'text'])
  assert.deepEqual(mixed.map((item) => item.localId), ['local-parent:1', 'local-parent:2'])
})


test('file segment download URL keeps redirect semantics and its own attachment secret', () => {
  const segment = api.toMultiBodySegmentItems(parent(), [bodies()[2]])[0]
  assert.equal(
    api.downloadRequestUrlOf(segment, 'file'),
    'https://example.com/spec.pdf?em-redirect=true&share-secret=file-secret'
  )
})
