import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'

async function loadReader() {
  return import('../demo/build/local-login-config.mjs').catch(() => ({}))
}

async function loadResolver() {
  return import('../demo/common/login-config.ts').catch(() => ({}))
}

test('本机登录配置文件缺失时返回空默认值', async () => {
  const { readLocalLoginConfig } = await loadReader()
  assert.equal(typeof readLocalLoginConfig, 'function')
  assert.deepEqual(readLocalLoginConfig('/path/that/does/not/exist.json'), {
    appkey: '',
    userId: '',
    token: ''
  })
})

test('本机登录配置缺失字段归一化为空字符串', async () => {
  const { readLocalLoginConfig } = await loadReader()
  assert.equal(typeof readLocalLoginConfig, 'function')
  const directory = mkdtempSync(join(tmpdir(), 'demo-login-config-'))
  try {
    const filePath = join(directory, 'local.credentials.json')
    writeFileSync(filePath, JSON.stringify({ appkey: 'org#app', token: 'fake-token' }))
    assert.deepEqual(readLocalLoginConfig(filePath), {
      appkey: 'org#app',
      userId: '',
      token: 'fake-token'
    })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('本机登录配置生成可直接导入的真实 TS 模块', async () => {
  const { writeLocalLoginConfigModule } = await loadReader()
  assert.equal(typeof writeLocalLoginConfigModule, 'function')
  const directory = mkdtempSync(join(tmpdir(), 'demo-login-module-'))
  try {
    const filePath = join(directory, 'local.credentials.ts')
    const expected = { appkey: 'org#app', userId: 'local-user', token: 'fake-token' }
    writeLocalLoginConfigModule(filePath, expected)
    const { DEMO_LOGIN_CONFIG } = await import(pathToFileURL(filePath).href)
    assert.deepEqual(DEMO_LOGIN_CONFIG, expected)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('设备存储为空时使用本机默认登录配置', async () => {
  const { resolveDemoLoginConfig } = await loadResolver()
  assert.equal(typeof resolveDemoLoginConfig, 'function')
  const result = resolveDemoLoginConfig({}, {
    appkey: 'org#app',
    userId: 'local-user',
    token: 'fake-token'
  })
  assert.deepEqual(result, {
    appkey: 'org#app',
    userId: 'local-user',
    token: 'fake-token'
  })
})

test('设备已保存的登录字段优先于本机默认配置', async () => {
  const { resolveDemoLoginConfig } = await loadResolver()
  assert.equal(typeof resolveDemoLoginConfig, 'function')
  const result = resolveDemoLoginConfig({
    appkey: 'saved#app',
    userId: 'saved-user',
    token: 'saved-token'
  }, {
    appkey: 'default#app',
    userId: 'default-user',
    token: 'default-token'
  })
  assert.deepEqual(result, {
    appkey: 'saved#app',
    userId: 'saved-user',
    token: 'saved-token'
  })
})
