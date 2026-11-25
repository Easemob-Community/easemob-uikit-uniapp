import assert from 'node:assert/strict'
import { readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cliDir = resolve(
  process.env.HBUILDERX_PATH ?? '/Applications/HBuilderX.app/Contents/HBuilderX',
  'plugins/uniapp-cli-vite'
)
const require = createRequire(import.meta.url)
const { build } = require(resolve(cliDir, 'node_modules/esbuild'))

test('自动设备注入不采集或上报品牌、型号和系统版本', async (t) => {
  const outfile = join(tmpdir(), `em-device-info-${process.pid}.mjs`)
  t.after(() => rm(outfile, { force: true }))
  await build({
    entryPoints: [resolve(root, 'uni_modules/easemob-uikit-uni/libs/client/device.ts')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    nodePaths: [resolve(root, 'demo/node_modules'), resolve(cliDir, 'node_modules')],
    plugins: [{
      name: 'uni-non-mp-conditions',
      setup(build) {
        build.onLoad({ filter: /libs\/client\/device\.ts$/ }, async (args) => {
          const source = await readFile(args.path, 'utf8')
          return {
            contents: source.replace(/\/\/ #ifdef MP-WEIXIN[\s\S]*?\/\/ #endif/g, ''),
            loader: 'ts'
          }
        })
      }
    }]
  })

  let requestedFilter = null
  globalThis.uni = {
    getDeviceInfo: (options) => {
      requestedFilter = options?.filter ?? null
      return {
        deviceBrand: 'Xiaomi',
        deviceModel: '23127PN0CC',
        system: 'Android 15',
        platform: 'android',
        deviceId: 'stable-id'
      }
    },
    getStorageSync: () => 'android_1.0.0-rc.2_Xiaomi_23127PN0CC_Android15_stable-id',
    setStorageSync: () => {}
  }
  const { resolveDeviceInfo } = await import(`${outfile}?t=${Date.now()}`)
  const result = resolveDeviceInfo({ appkey: 'org#app' })

  assert.deepEqual(requestedFilter, ['deviceId', 'platform', 'osName'])
  assert.equal(result.deviceId, 'android_1.0.6_stable-id')
  assert.equal(result.loginExtensionInfo, '{"deviceName":"android"}')
  assert.equal(JSON.stringify(result).includes('Xiaomi'), false)
  assert.equal(JSON.stringify(result).includes('23127PN0CC'), false)
  assert.equal(JSON.stringify(result).includes('Android 15'), false)
})
