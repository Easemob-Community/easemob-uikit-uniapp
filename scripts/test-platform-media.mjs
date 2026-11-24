import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const hbx = process.env.HBUILDERX_PATH ?? '/Applications/HBuilderX.app/Contents/HBuilderX'
const esbuildBin = process.env.ESBUILD_BIN ?? resolve(hbx, 'plugins/uniapp-cli-vite/node_modules/.bin/esbuild')
const platformPath = resolve(root, 'uni_modules/easemob-uikit-uni/libs/platform.ts')

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

test('视频选择保持返回与取消契约', async (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'em-platform-media-test-'))
  t.after(() => rmSync(temp, { recursive: true, force: true }))
  const entry = join(temp, 'entry.ts')
  const output = join(temp, 'bundle.mjs')
  const source = readFileSync(platformPath, 'utf8')
  const libsDir = resolve(root, 'uni_modules/easemob-uikit-uni/libs')

  for (const platform of ['android', 'ios']) {
    const enabled = new Set(['APP', 'UNI-APP-X', platform === 'android' ? 'APP-ANDROID' : 'APP-IOS'])
    writeFileSync(join(temp, `platform-${platform}.ts`), compileForPlatform(source, enabled)
      .replaceAll("from './", `from '${libsDir}/`))
  }
  writeFileSync(entry, `
    export { chooseVideo as chooseVideoAndroid } from './platform-android.ts'
    export { chooseVideo as chooseVideoIos } from './platform-ios.ts'
  `)
  const vuePath = resolve(hbx, 'plugins/uniapp-cli-vite/node_modules/vue')
  execFileSync(esbuildBin, [entry, '--bundle', '--platform=node', '--format=esm', `--alias:vue=${vuePath}`, `--outfile=${output}`], { stdio: 'pipe' })

  const videoCalls = []
  const mediaCalls = []
  globalThis.uni = {
    chooseVideo: (options) => {
      videoCalls.push(options)
      options.success({
        tempFilePath: 'content://media/external/video/media/42',
        duration: 3.6,
        width: 1920,
        height: 1080,
        size: 2048
      })
    },
    chooseMedia: (options) => {
      mediaCalls.push(options)
      options.success({
        type: 'video',
        tempFiles: [{
          tempFilePath: 'content://media/external/video/media/42',
          fileType: 'video',
          duration: 3.6,
          width: 1920,
          height: 1080,
          size: 2,
          byteSize: 2048
        }]
      })
    }
  }
  t.after(() => delete globalThis.uni)
  const api = await import(pathToFileURL(output).href)
  const android = await api.chooseVideoAndroid()
  const ios = await api.chooseVideoIos()

  assert.equal(mediaCalls.length, 0)
  assert.equal(videoCalls.length, 2)
  assert.equal('albumMode' in videoCalls[0], false)
  assert.equal('albumMode' in videoCalls[1], false)
  assert.deepEqual(android, {
    path: 'content://media/external/video/media/42',
    name: '42',
    duration: 4,
    width: 1920,
    height: 1080,
    size: 2048
  })
  assert.deepEqual(ios, android)

  globalThis.uni.chooseVideo = (options) => options.fail({ errCode: 1101001, errMsg: 'chooseVideo:fail cancel' })
  assert.equal(await api.chooseVideoAndroid(), null)
})

test('相册权限错误按 errCode 和跨端错误文本识别', async (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'em-platform-permission-test-'))
  t.after(() => rmSync(temp, { recursive: true, force: true }))
  const entry = join(temp, 'entry.ts')
  const output = join(temp, 'bundle.mjs')
  writeFileSync(entry, `export { isAlbumAuthDenied } from '${platformPath}'`)
  const vuePath = resolve(hbx, 'plugins/uniapp-cli-vite/node_modules/vue')
  execFileSync(esbuildBin, [entry, '--bundle', '--platform=node', '--format=esm', `--alias:vue=${vuePath}`, `--outfile=${output}`], { stdio: 'pipe' })
  const { isAlbumAuthDenied } = await import(pathToFileURL(output).href)

  assert.equal(isAlbumAuthDenied({ errCode: 1101005, errMsg: 'No Permission' }), true)
  assert.equal(isAlbumAuthDenied({ errCode: '1101005', errMsg: 'No Permission' }), true)
  assert.equal(isAlbumAuthDenied({ errMsg: 'chooseVideo:fail authorize deny' }), true)
  assert.equal(isAlbumAuthDenied({ errCode: 1101010, errMsg: 'read failed' }), false)
})

test('聊天页将相册权限异常与普通选择失败分流', () => {
  const chatPage = readFileSync(resolve(root, 'uni_modules/easemob-uikit-uni/components/pages/em-chat-page/em-chat-page.vue'), 'utf8')
  const zh = readFileSync(resolve(root, 'uni_modules/easemob-uikit-uni/libs/locale/zh-CN.ts'), 'utf8')
  const en = readFileSync(resolve(root, 'uni_modules/easemob-uikit-uni/libs/locale/en.ts'), 'utf8')

  assert.match(chatPage, /function showMediaPickFailure[\s\S]*?isAlbumAuthDenied\(e\)[\s\S]*?uni\.showModal/)
  assert.match(chatPage, /showMediaPickFailure\(e, 'error\.imagePickFailed'\)/)
  assert.match(chatPage, /showMediaPickFailure\(e, 'error\.videoPickFailed'\)/)
  assert.match(chatPage, /if \(res\.confirm\) openAppAuthorizeSetting\(\)/)
  for (const locale of [zh, en]) {
    assert.match(locale, /'chat\.mediaPermission\.title'/)
    assert.match(locale, /'chat\.mediaPermission\.denied'/)
  }
})
