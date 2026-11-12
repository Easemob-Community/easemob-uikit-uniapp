import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveLoginExtensionInfo } from '../uni_modules/easemob-uikit-uni/libs/client/login-extension.ts'
import { resolveSdkInitOptions } from '../uni_modules/easemob-uikit-uni/libs/client/init-options.ts'

const requiredManager = { name: 'required' }
const customManager = { name: 'custom' }
const basePlatformOverrides = () => ({})

function resolve(config, deviceInfo = {}, managers = [requiredManager], platformOverrides = basePlatformOverrides) {
  return resolveSdkInitOptions(config, deviceInfo, managers, platformOverrides)
}

test('登录扩展只使用平台名并忽略品牌、型号和系统版本', () => {
  const result = resolveLoginExtensionInfo({
    deviceBrand: 'Xiaomi',
    deviceModel: '23127PN0CC',
    system: 'Android 15',
    platform: ' android '
  })

  assert.equal(result, '{"deviceName":"android"}')
})

test('平台缺失时使用系统名，完全缺失时使用 unknown', () => {
  assert.equal(resolveLoginExtensionInfo({ osName: ' ios ' }), '{"deviceName":"ios"}')
  assert.equal(resolveLoginExtensionInfo({ platform: ' web ' }), '{"deviceName":"web"}')
  assert.equal(resolveLoginExtensionInfo({}), '{"deviceName":"unknown"}')
})

test('宿主登录扩展与任意 WebSDK 原生字段覆盖默认值并完整保留', () => {
  const customExtension = '{"deviceName":"我的设备","source":"uniapp"}'
  const result = resolve({
    appkey: 'org#app',
    sdkInitOptions: {
      loginExtensionInfo: customExtension,
      enableDeliveryReceipt: true,
      uiKitVersion: '1.0.0-rc.2',
      serviceConfig: {
        serverUrls: {
          restApiUrl: 'https://im.example.com',
          wsUrl: 'wss://im.example.com/websocket'
        }
      }
    }
  }, {
    deviceId: 'auto-device',
    loginExtensionInfo: '{"deviceName":"default"}'
  })

  assert.equal(result.loginExtensionInfo, customExtension)
  assert.equal(result.deviceId, 'auto-device')
  assert.equal(result.enableDeliveryReceipt, true)
  assert.equal(result.uiKitVersion, '1.0.0-rc.2')
  assert.deepEqual(result.serviceConfig, {
    serverUrls: {
      restApiUrl: 'https://im.example.com',
      wsUrl: 'wss://im.example.com/websocket'
    }
  })
})

test('同步类型缺省保留 UIKit 三类同步，显式值按 SDK 语义替换', () => {
  const defaults = resolve({ appkey: 'org#app' })
  const customized = resolve({
    appkey: 'org#app',
    sdkInitOptions: { enableSyncData: ['conversation'] }
  })

  assert.deepEqual(defaults.enableSyncData, ['conversation', 'contact', 'group'])
  assert.deepEqual(customized.enableSyncData, ['conversation'])
})

test('必需 Manager 始终保留，自定义 Manager 追加且去重', () => {
  const result = resolve({
    appkey: 'org#app',
    sdkInitOptions: { managers: [customManager, requiredManager, customManager] }
  })

  assert.deepEqual(result.managers, [requiredManager, customManager])
})

test('平台适配器保留 UIKit 修复并允许宿主覆盖同名能力', () => {
  const baseRuntime = { name: 'base-runtime' }
  const baseProcessor = { name: 'base-processor' }
  const customProcessor = { name: 'custom-processor' }
  const customStorage = { name: 'custom-storage' }
  const runtimeInput = { name: 'runtime-input' }
  const result = resolve({
    appkey: 'org#app',
    sdkInitOptions: {
      platformAdapterOptions: {
        prefer: 'web',
        runtimeInput,
        overrides: {
          imageProcessor: customProcessor,
          storage: customStorage
        }
      }
    }
  }, {}, [requiredManager], () => ({
    runtime: baseRuntime,
    imageProcessor: baseProcessor
  }))

  assert.equal(result.platformAdapterOptions.prefer, 'web')
  assert.equal(result.platformAdapterOptions.runtimeInput, runtimeInput)
  assert.deepEqual(result.platformAdapterOptions.overrides({}), {
    runtime: baseRuntime,
    imageProcessor: customProcessor,
    storage: customStorage
  })
})

test('函数形式平台覆盖与 UIKit 默认覆盖组合', () => {
  const baseRuntime = { name: 'base-runtime' }
  const customRuntime = { name: 'custom-runtime' }
  const result = resolve({
    appkey: 'org#app',
    sdkInitOptions: {
      platformAdapterOptions: {
        overrides: (defaults) => ({ runtime: customRuntime, proto: defaults.proto })
      }
    }
  }, {}, [requiredManager], () => ({ runtime: baseRuntime }))
  const defaults = { proto: { name: 'default-proto' } }

  assert.deepEqual(result.platformAdapterOptions.overrides(defaults), {
    runtime: customRuntime,
    proto: defaults.proto
  })
})

test('相同平台覆盖输入复用组合 resolver 引用，支持初始化失败重试', () => {
  const customOverrides = { storage: { name: 'custom-storage' } }
  const baseOverrides = () => ({})
  const config = {
    appkey: 'org#app',
    sdkInitOptions: { platformAdapterOptions: { overrides: customOverrides } }
  }
  const first = resolve(config, {}, [requiredManager], baseOverrides)
  const second = resolve(config, {}, [requiredManager], baseOverrides)
  const defaultFirst = resolve({ appkey: 'org#app' }, {}, [requiredManager], baseOverrides)
  const defaultSecond = resolve({ appkey: 'org#app' }, {}, [requiredManager], baseOverrides)

  assert.equal(first.platformAdapterOptions.overrides, second.platformAdapterOptions.overrides)
  assert.equal(defaultFirst.platformAdapterOptions.overrides, defaultSecond.platformAdapterOptions.overrides)
})
