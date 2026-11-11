import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test, { after, before, beforeEach } from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const hbx = process.env.HBUILDERX_PATH ?? '/Applications/HBuilderX.app/Contents/HBuilderX'
const esbuildBin = process.env.ESBUILD_BIN ?? resolve(hbx, 'plugins/uniapp-cli-vite/node_modules/.bin/esbuild')
const temp = mkdtempSync(join(tmpdir(), 'em-record-lifecycle-test-'))
const platformPath = resolve(root, 'uni_modules/easemob-uikit-uni/libs/platform.ts')
let moduleUrl = ''
let loadCount = 0
let api
let manager
let toasts

function compileForApp(source) {
  const output = []
  const stack = []
  const enabled = (name) => name === 'APP' || name === 'UNI-APP-X'
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
    const condition = kind === 'ifdef' ? enabled(name) : !enabled(name)
    stack.push({ parentActive, condition, active: parentActive && condition })
  })
  return output.join('\n')
}

class MockRecorderManager {
  startCalls = 0
  stopCalls = 0
  started = false
  startOptions = null
  deferStops = false
  startBehavior = ''
  onStartCallback = null
  onStopCallback = null
  onErrorCallback = null

  start(options) {
    this.startCalls += 1
    this.startOptions = options
    if (this.started) this.finishStop()
    if (this.startBehavior === 'error') {
      this.startBehavior = ''
      this.onErrorCallback?.({ errCode: 1107604, errMsg: 'start failed' })
    } else if (this.startBehavior === 'stop') {
      this.startBehavior = ''
      this.fireStart()
      this.finishStop()
    }
  }

  stop() {
    this.stopCalls += 1
    if (this.started && !this.deferStops) this.finishStop()
  }

  onStart(callback) {
    this.onStartCallback = callback
  }

  onStop(callback) {
    this.onStopCallback = callback
  }

  onError(callback) {
    this.onErrorCallback = callback
  }

  fireStart() {
    this.started = true
    this.onStartCallback?.({})
  }

  finishStop(duration = 2000) {
    this.started = false
    this.onStopCallback?.({ tempFilePath: '/tmp/em-record.aac', duration })
  }

  fireError(keepActive = false) {
    this.started = keepActive
    this.onErrorCallback?.({ errCode: 1107601, errMsg: 'permission denied' })
  }
}

function outcome(promise) {
  return Promise.race([
    promise.then(
      (value) => ({ status: 'resolved', value }),
      (error) => ({ status: 'rejected', error })
    ),
    new Promise((resolve) => setTimeout(() => resolve({ status: 'pending' }), 20))
  ])
}

function createComposer() {
  const voices = []
  const originalWarn = console.warn
  console.warn = (...args) => {
    if (!String(args[0]).includes('onUnmounted is called')) originalWarn(...args)
  }
  try {
    const composer = api.useChatComposer({
      disabled: api.ref(false),
      onDisabledTap: () => {},
      onVoiceSend: (path, duration) => voices.push({ path, duration })
    })
    return { composer, voices }
  } finally {
    console.warn = originalWarn
  }
}

before(() => {
  const entry = join(temp, 'entry.ts')
  const transformed = join(temp, 'platform-app.ts')
  const composerTransformed = join(temp, 'composer-app.ts')
  const output = join(temp, 'bundle.mjs')
  writeFileSync(entry, `
    export { startRecord, stopRecord, cancelRecord, isRecording } from './platform-app.ts'
    export { useChatComposer } from './composer-app.ts'
    export { ref } from 'vue'
  `)
  writeFileSync(transformed, compileForApp(readFileSync(platformPath, 'utf8'))
    .replaceAll("from './", `from '${resolve(root, 'uni_modules/easemob-uikit-uni/libs')}/`))
  writeFileSync(composerTransformed, readFileSync(resolve(root, 'uni_modules/easemob-uikit-uni/libs/use/useChatComposer.ts'), 'utf8')
    .replaceAll("from '../", `from '${resolve(root, 'uni_modules/easemob-uikit-uni/libs')}/`)
    .replaceAll("from './", `from '${resolve(root, 'uni_modules/easemob-uikit-uni/libs/use')}/`)
    .replace(`from '${resolve(root, 'uni_modules/easemob-uikit-uni/libs')}/platform'`, "from './platform-app.ts'"))
  const vuePath = resolve(hbx, 'plugins/uniapp-cli-vite/node_modules/vue')
  execFileSync(esbuildBin, [entry, '--bundle', '--platform=node', '--format=esm', `--alias:vue=${vuePath}`, `--outfile=${output}`], { stdio: 'pipe' })
  moduleUrl = pathToFileURL(output).href
})

beforeEach(async () => {
  manager = new MockRecorderManager()
  toasts = []
  globalThis.uni = {
    getRecorderManager: () => manager,
    onKeyboardHeightChange: () => 1,
    offKeyboardHeightChange: () => {},
    getWindowInfo: () => ({ safeAreaInsets: { top: 0, bottom: 0 } }),
    getSystemInfoSync: () => ({ language: 'zh-CN' }),
    getStorageSync: () => null,
    setStorageSync: () => {},
    hideKeyboard: () => {},
    showToast: (options) => toasts.push(options)
  }
  loadCount += 1
  api = await import(`${moduleUrl}?case=${loadCount}`)
})

after(() => {
  delete globalThis.uni
  rmSync(temp, { recursive: true, force: true })
})

test('授权等待期取消会在迟到 onStart 后再次停止且不发送旧结果', () => {
  let autoStops = 0
  api.startRecord({ onAutoStop: () => { autoStops += 1 } })
  api.cancelRecord()
  assert.equal(manager.stopCalls, 1)
  assert.equal(api.isRecording(), true)

  manager.fireStart()

  assert.equal(manager.stopCalls, 2)
  assert.equal(api.isRecording(), false)
  assert.equal(autoStops, 0)
})

test('授权等待期停止会在迟到 onStart 后完成一次结算', async () => {
  api.startRecord()
  const resultPromise = api.stopRecord()
  manager.fireStart()

  assert.equal(manager.stopCalls, 2)
  const result = await resultPromise
  assert.equal(result.path, '/tmp/em-record.aac')
  assert.equal(api.isRecording(), false)
})

test('旧轮授权清理结束前忽略新 start，终止后允许重新录音', () => {
  api.startRecord()
  api.cancelRecord()
  api.startRecord()
  assert.equal(manager.startCalls, 1)

  manager.fireStart()
  assert.equal(api.isRecording(), false)
  api.startRecord()
  assert.equal(manager.startCalls, 2)
})

test('已授权的正常开始与手动停止保持原有结果契约', async () => {
  api.startRecord()
  manager.fireStart()
  const resultPromise = api.stopRecord()
  const result = await resultPromise

  assert.deepEqual(manager.startOptions, { duration: 60000, format: 'aac' })
  assert.equal(result.path, '/tmp/em-record.aac')
  assert.equal(result.duration, 2)
  assert.equal(api.isRecording(), false)
})

test('原生自动停止仍通过 onAutoStop 交付录音', () => {
  const results = []
  api.startRecord({ onAutoStop: (result) => results.push(result) })
  manager.fireStart()
  manager.finishStop(60000)

  assert.equal(results.length, 1)
  assert.equal(results[0].duration, 60)
  assert.equal(api.isRecording(), false)
})

test('启动前原生错误复位后允许重新发起录音', () => {
  const errors = []
  api.startRecord({ onError: (error) => errors.push(error) })
  manager.fireError()

  assert.equal(errors.length, 1)
  assert.equal(api.isRecording(), false)
  api.startRecord()
  assert.equal(manager.startCalls, 2)
})

test('开始后的原生错误先排空旧录音，旧 onStop 不污染新会话', () => {
  const oldErrors = []
  const newAutoStops = []
  api.startRecord({ onError: (error) => oldErrors.push(error) })
  manager.fireStart()
  manager.deferStops = true
  manager.fireError(true)

  assert.equal(oldErrors.length, 1)
  assert.equal(api.isRecording(), true)
  api.startRecord({ onAutoStop: (result) => newAutoStops.push(result) })
  assert.equal(manager.startCalls, 1)

  manager.finishStop()
  assert.equal(api.isRecording(), false)
  assert.equal(newAutoStops.length, 0)
  api.startRecord()
  assert.equal(manager.startCalls, 2)
})

test('重复停止共享同一个进行中的 Promise 与结果', async () => {
  api.startRecord()
  manager.fireStart()
  manager.deferStops = true
  const first = api.stopRecord()
  const second = api.stopRecord()
  const shared = first === second
  manager.finishStop()
  const [firstOutcome, secondOutcome] = await Promise.all([outcome(first), outcome(second)])

  assert.equal(shared, true)
  assert.equal(firstOutcome.status, 'resolved')
  assert.equal(secondOutcome.status, 'resolved')
  assert.equal(firstOutcome.value, secondOutcome.value)
})

test('停止后取消会拒绝停止 Promise，且不交付旧录音', async () => {
  let autoStops = 0
  api.startRecord({ onAutoStop: () => { autoStops += 1 } })
  manager.fireStart()
  manager.deferStops = true
  const stopped = api.stopRecord()
  api.cancelRecord()
  const result = await outcome(stopped)
  manager.finishStop()

  assert.equal(result.status, 'rejected')
  assert.equal(result.error.code, 'EM_RECORD_CANCELLED')
  assert.equal(autoStops, 0)
  assert.equal(api.isRecording(), false)
})

test('停止后原生错误会拒绝 Promise，并在旧录音终止前保持忙态', async () => {
  const errors = []
  api.startRecord({ onError: (error) => errors.push(error) })
  manager.fireStart()
  manager.deferStops = true
  const stopped = api.stopRecord()
  manager.fireError(true)
  const result = await outcome(stopped)

  assert.equal(result.status, 'rejected')
  assert.equal(errors.length, 1)
  assert.equal(api.isRecording(), true)
  manager.finishStop()
  assert.equal(api.isRecording(), false)
})

test('原生 start 同步报错时手势录音态保持复位且只提示一次', () => {
  const { composer } = createComposer()
  manager.startBehavior = 'error'
  composer.onRecordTouchStart({ touches: [{ clientY: 100 }] })

  assert.equal(composer.recording.value, false)
  assert.equal(toasts.length, 1)
})

test('原生 start 同步终止时不会被后续赋值重新打开录音浮层', () => {
  const { composer, voices } = createComposer()
  manager.startBehavior = 'stop'
  composer.onRecordTouchStart({ touches: [{ clientY: 100 }] })

  assert.equal(composer.recording.value, false)
  assert.equal(voices.length, 1)
})

test('停止后取消只忽略取消错误，不额外提示录音失败', async () => {
  const { composer } = createComposer()
  composer.onRecordTouchStart({ touches: [{ clientY: 100 }] })
  manager.fireStart()
  manager.deferStops = true
  composer.onRecordTouchEnd()
  api.cancelRecord()
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.equal(composer.recording.value, false)
  assert.equal(toasts.length, 0)
  manager.finishStop()
})
