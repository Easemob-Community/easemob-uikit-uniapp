import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import test, { after, before } from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const hbx = process.env.HBUILDERX_PATH ?? '/Applications/HBuilderX.app/Contents/HBuilderX'
const esbuildBin = process.env.ESBUILD_BIN ?? resolve(hbx, 'plugins/uniapp-cli-vite/node_modules/.bin/esbuild')
const temp = mkdtempSync(join(tmpdir(), 'em-attachment-test-'))
let api

function compileForPlatform(source, enabled) {
  const output = []
  const stack = []
  const active = () => stack.every((frame) => frame.active)
  source.split('\n').forEach((line) => {
    const directive = line.match(/^\s*\/\/\s*#(ifdef|ifndef|else|endif)(?:\s+([A-Z0-9_-]+))?/)
    if (directive == null) {
      if (active()) output.push(line)
      return
    }
    const [kind, name] = [directive[1], directive[2] ?? '']
    if (kind === 'endif') {
      stack.pop()
      return
    }
    if (kind === 'else') {
      const frame = stack[stack.length - 1]
      frame.active = frame.parentActive && !frame.condition
      return
    }
    const parentActive = active()
    const condition = kind === 'ifdef' ? enabled.has(name) : !enabled.has(name)
    stack.push({ parentActive, condition, active: parentActive && condition })
  })
  return output.join('\n')
}

before(async () => {
  const entry = join(temp, 'entry.ts')
  const output = join(temp, 'bundle.mjs')
  const libsDir = resolve(root, 'uni_modules/easemob-uikit-uni/libs')
  const platformOutput = join(temp, 'platform-app.ts')
  const downloadOutput = join(temp, 'download-app.ts')
  const platformSource = compileForPlatform(readFileSync(resolve(libsDir, 'platform.ts'), 'utf8'), new Set(['APP', 'UNI-APP-X', 'APP-ANDROID']))
  writeFileSync(platformOutput, platformSource.replaceAll("from './", `from '${libsDir}/`))
  const downloadSource = readFileSync(resolve(libsDir, 'utils/download.ts'), 'utf8')
    .replaceAll("from '../", `from '${libsDir}/`)
    .replaceAll("from './", `from '${libsDir}/utils/`)
    .replace(`from '${libsDir}/platform'`, `from '${platformOutput}'`)
  writeFileSync(downloadOutput, downloadSource)
  writeFileSync(entry, `
    export { downloadRequestUrlOf } from '${downloadOutput}'
    export * as downloadApi from '${downloadOutput}'
    export { EmMessageDomain } from '${resolve(root, 'uni_modules/easemob-uikit-uni/libs/chat/message.ts')}'
  `)
  const vuePath = resolve(hbx, 'plugins/uniapp-cli-vite/node_modules/vue')
  execFileSync(esbuildBin, [entry, '--bundle', '--platform=node', '--format=esm', `--alias:vue=${vuePath}`, `--outfile=${output}`], { stdio: 'pipe' })
  api = await import(pathToFileURL(output).href)
})

after(() => rmSync(temp, { recursive: true, force: true }))

test('Android 直接使用 uni.chooseFile 返回的可上传路径，不做额外路径转换', () => {
  const provider = readFileSync(resolve(root, 'demo/common/attachment-provider.uts'), 'utf8')
  assert.match(provider, /uni\.chooseFile\(\{/)
  assert.match(provider, /const path = f\.path \?\? ''/)
  assert.doesNotMatch(provider, /prepareFile|file:\/\/|externalCacheDir/)
  const picker = readFileSync(resolve(root, 'uni_modules/easemob-file-picker/utssdk/app-android/index.uts'), 'utf8')
  assert.doesNotMatch(picker, /getExternalCacheDir/)
})

test('附件下载将环信 HTTP 与协议相对地址升级为 HTTPS 并保留 secret', () => {
  const message = {
    localId: 'file-http', type: 'file', url: 'http://ngi-a1.easemob.com/easemob-demo/support-ngi/chatfiles/file-id?x=1',
    originalUrl: '', thumbUrl: '', fileName: 'a.pdf', attachmentSecret: 'secret-value'
  }
  assert.equal(
    api.downloadRequestUrlOf(message, 'file'),
    'https://ngi-a1.easemob.com/easemob-demo/support-ngi/chatfiles/file-id?x=1&em-redirect=true&share-secret=secret-value'
  )
  message.url = '//ngi-a1.easemob.com/chatfiles/file-id'
  assert.equal(
    api.downloadRequestUrlOf(message, 'file'),
    'https://ngi-a1.easemob.com/chatfiles/file-id?em-redirect=true&share-secret=secret-value'
  )
  message.url = 'https://ngi-a1.easemob.com/chatfiles/file-id'
  assert.equal(
    api.downloadRequestUrlOf(message, 'file'),
    'https://ngi-a1.easemob.com/chatfiles/file-id?em-redirect=true&share-secret=secret-value'
  )
})

test('只有自己已发送且仍在本地的文件可绕过远端下载', () => {
  assert.equal(typeof api.downloadApi.localFilePathOf, 'function')
  const local = { localId: 'local-preview', type: 'file', self: true, status: 'sent', url: 'file:///data/user/0/pkg/cache/a.pdf', fileName: 'a.pdf' }
  assert.equal(api.downloadApi.localFilePathOf(local), local.url)
  for (const item of [
    { ...local, self: false },
    { ...local, status: 'failed' },
    { ...local, type: 'image' },
    { ...local, url: 'https://example.com/a.pdf' },
    { ...local, url: 'http://example.com/a.pdf' },
    { ...local, url: 'blob:local-file' },
    { ...local, url: 'data:application/pdf;base64,AA==' },
    { ...local, url: '' }
  ]) {
    assert.equal(api.downloadApi.localFilePathOf(item), '')
  }
})

test('文件发送成功保留本地副本，reset 时仍按原契约释放', async () => {
  const releaseCalls = []
  const localMessage = {
    msgServerId: '', msgLocalId: 'local-file-retain', from: 'me', to: 'peer', sender: { userId: 'me' },
    conversationId: 'peer', conversationType: 'singleChat', type: 'file', sendStatus: 'sending', ext: {},
    timestamp: 1700000000000, body: { url: '', filename: 'a.pdf', fileSize: 3 }
  }
  const sent = {
    ...localMessage, msgServerId: 'server-file-retain', sendStatus: 'sent', timestamp: 1700000000001,
    body: { url: 'https://example.com/chatfiles/a', filename: 'a.pdf', fileSize: 3 }
  }
  const chatManager = {
    createFileMessage: () => localMessage,
    sendMessage: async () => sent
  }
  const domain = new api.EmMessageDomain({ client: { chatManager }, waitOnline: null })
  await domain.sendFile('peer', 'singleChat', {
    path: 'file:///data/user/0/pkg/cache/a.pdf', name: 'a.pdf', size: 3, mimeType: 'application/pdf',
    temporary: true, release: (path) => releaseCalls.push(path)
  })
  assert.deepEqual(releaseCalls, [])
  domain.reset()
  assert.deepEqual(releaseCalls, ['file:///data/user/0/pkg/cache/a.pdf'])
})

test('本地文件直接 openDocument，不触发 downloadFile', async () => {
  assert.equal(typeof api.downloadApi.openLocalFileAttachment, 'function')
  const openCalls = []
  let downloadCalls = 0
  globalThis.uni = {
    openDocument: (options) => {
      openCalls.push(options)
      options.success({})
    },
    downloadFile: () => {
      downloadCalls += 1
      throw new Error('must not download local attachment')
    }
  }
  try {
    const local = { localId: 'local-open', type: 'file', self: true, status: 'sent', url: 'file:///data/user/0/pkg/cache/a.pdf', fileName: 'a.pdf' }
    assert.equal(await api.downloadApi.openLocalFileAttachment(local), true)
    assert.equal(openCalls.length, 1)
    assert.equal(openCalls[0].filePath, local.url)
    assert.equal(openCalls[0].fileType, 'pdf')
    assert.equal(downloadCalls, 0)
    assert.equal(await api.downloadApi.openLocalFileAttachment({ ...local, self: false, url: 'https://example.com/a.pdf' }), false)
    assert.equal(openCalls.length, 1)
  } finally {
    delete globalThis.uni
  }
})

test('聊天页启用文件点击并在 loading 前先尝试本地打开', () => {
  const chatPage = readFileSync(resolve(root, 'uni_modules/easemob-uikit-uni/components/pages/em-chat-page/em-chat-page.vue'), 'utf8')
  const platform = readFileSync(resolve(root, 'uni_modules/easemob-uikit-uni/libs/platform.ts'), 'utf8')
  assert.match(platform, /fileOpen: true/)
  assert.match(chatPage, /function onFileDownload\(m: EmMessageItem\): void \{\s*void downloadMessage\(m\)\s*\}/)
  assert.match(chatPage, /async function downloadMessage[\s\S]*?openLocalFileAttachment\(m\)[\s\S]*?uni\.showLoading/)
})

test('聊天页下载进度不重复创建原生 loading 页面', () => {
  const chatPage = readFileSync(resolve(root, 'uni_modules/easemob-uikit-uni/components/pages/em-chat-page/em-chat-page.vue'), 'utf8')
  assert.doesNotMatch(chatPage, /uni\.showLoading\(\{ title: t\('message\.download\.progress'/)
})
