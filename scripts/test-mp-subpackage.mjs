import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const preparePath = resolve(root, 'scripts/prepare-sdk-subpackage.mjs')
const checkPath = resolve(root, 'scripts/check-mp-size.mjs')

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'em-mp-subpackage-'))
  return {
    dir,
    cleanup() {
      rmSync(dir, { recursive: true, force: true })
    }
  }
}

function writeJson(dir, name, value) {
  writeFileSync(join(dir, name), JSON.stringify(value, null, 2))
}

function readJson(dir, name) {
  return JSON.parse(readFileSync(join(dir, name), 'utf8'))
}

async function loadPrepareExport(name) {
  const source = readFileSync(preparePath, 'utf8')
  assert.match(source, new RegExp(`export function ${name}\\(`), `${name} 应作为可测试函数导出`)
  return (await import(preparePath))[name]
}

test('后处理覆盖公共和私有 ignore 配置并保留其他设置', async (t) => {
  const patchProjectConfigs = await loadPrepareExport('patchProjectConfigs')
  const out = fixture()
  t.after(out.cleanup)
  writeJson(out.dir, 'project.config.json', { setting: { ignoreDevUnusedFiles: true, es6: true } })
  writeJson(out.dir, 'project.private.config.json', {
    libVersion: '3.17.5',
    setting: { ignoreDevUnusedFiles: true, compileHotReLoad: true }
  })

  assert.deepEqual(patchProjectConfigs(out.dir), ['project.config.json', 'project.private.config.json'])
  assert.deepEqual(readJson(out.dir, 'project.config.json').setting, {
    es6: true,
    ignoreDevUnusedFiles: false,
    ignoreUploadUnusedFiles: false
  })
  assert.deepEqual(readJson(out.dir, 'project.private.config.json'), {
    libVersion: '3.17.5',
    setting: {
      compileHotReLoad: true,
      ignoreDevUnusedFiles: false,
      ignoreUploadUnusedFiles: false
    }
  })
})

test('后处理不在缺少私有配置时创建文件', async (t) => {
  const patchProjectConfigs = await loadPrepareExport('patchProjectConfigs')
  const out = fixture()
  t.after(out.cleanup)
  writeJson(out.dir, 'project.config.json', { setting: {} })

  assert.deepEqual(patchProjectConfigs(out.dir), ['project.config.json'])
  assert.equal(existsSync(join(out.dir, 'project.private.config.json')), false)
})

test('检查器识别私有配置覆盖公共配置', async (t) => {
  const source = readFileSync(checkPath, 'utf8')
  assert.match(source, /export function validateUnusedFileSettings\(/)
  const { validateUnusedFileSettings } = await import(checkPath)
  const out = fixture()
  t.after(out.cleanup)
  writeJson(out.dir, 'project.config.json', {
    setting: { ignoreDevUnusedFiles: false, ignoreUploadUnusedFiles: false }
  })
  writeJson(out.dir, 'project.private.config.json', {
    setting: { ignoreDevUnusedFiles: true, ignoreUploadUnusedFiles: false }
  })

  const failures = validateUnusedFileSettings(out.dir)
  assert.equal(failures.length, 1)
  assert.match(failures[0], /project\.private\.config\.json/)
  assert.match(failures[0], /ignoreDevUnusedFiles/)
})

test('app.json 缺失时只报告上游编译问题', () => {
  const host = fixture()
  const out = fixture()
  try {
    writeJson(host.dir, 'package.json', { dependencies: { 'easemob-websdk': '5.1.3' } })
    const result = spawnSync(process.execPath, [checkPath, out.dir, host.dir], { encoding: 'utf8' })
    const output = `${result.stdout}${result.stderr}`
    assert.equal(result.status, 1)
    assert.match(output, /app\.json/)
    assert.match(output, /HBuilderX/)
    assert.doesNotMatch(output, /SDK 分包文件存在/)
  } finally {
    host.cleanup()
    out.cleanup()
  }
})

test('仓库位置参数的产物路径相对工程根目录解析', () => {
  const result = spawnSync(
    process.execPath,
    [preparePath, 'demo/unpackage/dist/build/mp-weixin', 'demo'],
    { cwd: root, encoding: 'utf8' }
  )
  const output = `${result.stdout}${result.stderr}`
  assert.equal(result.status, 0, output)
  assert.doesNotMatch(output, /demo\/demo\/unpackage/)
})

test('检查器兼容仓库位置参数', () => {
  const result = spawnSync(
    process.execPath,
    [checkPath, 'demo/unpackage/dist/build/mp-weixin', 'demo'],
    { cwd: root, encoding: 'utf8' }
  )
  const output = `${result.stdout}${result.stderr}`
  assert.equal(result.status, 0, output)
  assert.doesNotMatch(output, /demo\/demo\/unpackage/)
})

test('模板暴露统一的微信小程序命令', () => {
  const pkg = readJson(resolve(root, 'templates/chat-only'), 'package.json')
  assert.deepEqual(pkg.scripts, {
    'dev:mp': 'node scripts/mp-weixin.mjs dev',
    'build:mp': 'node scripts/mp-weixin.mjs build',
    'check:mp': 'node scripts/mp-weixin.mjs check',
    'watch:mp': 'node scripts/mp-weixin.mjs watch'
  })
})

test('同步检查覆盖宿主 Skill 和模板的全部脚本', (t) => {
  const copy = fixture()
  t.after(copy.cleanup)
  mkdirSync(join(copy.dir, 'scripts'), { recursive: true })
  for (const file of ['sync-mp-subpackage.mjs', 'mp-weixin.mjs', 'prepare-sdk-subpackage.mjs', 'check-mp-size.mjs']) {
    writeFileSync(join(copy.dir, 'scripts', file), readFileSync(resolve(root, 'scripts', file)))
  }

  const result = spawnSync(process.execPath, [join(copy.dir, 'scripts/sync-mp-subpackage.mjs'), '--check'], {
    cwd: copy.dir,
    encoding: 'utf8'
  })
  const output = `${result.stdout}${result.stderr}`
  assert.equal(result.status, 1)
  assert.match(output, /缺失或不一致/)
  assert.match(output, /templates\/chat-only\/scripts\/mp-weixin\.mjs/)
  assert.match(output, /skills\/em-host-mp-subpackage\/scripts\/check-mp-size\.mjs/)
})

test('chat-only 同时使用 sub-im 页面分包和 sub-sdk SDK 分包', () => {
  const host = resolve(root, 'templates/chat-only')
  const pages = readJson(host, 'pages.json')
  const imPackage = pages.subPackages.find((item) => item.root === 'sub-im')
  assert.equal(existsSync(resolve(host, 'pages/chat/chat.uvue')), false)
  assert.equal(existsSync(resolve(host, 'sub-im/pages/chat/chat.uvue')), true)
  assert.equal(imPackage?.independent, false)
  assert.ok(imPackage?.pages.some((page) => page.path === 'pages/chat/chat'))
  assert.equal(pages.pages.some((page) => page.path === 'pages/chat/chat'), false)
  assert.match(readFileSync(resolve(host, 'pages/login/login.uvue'), 'utf8'), /\/sub-im\/pages\/chat\/chat/)
})

test('watch 在自身输出后保持静止', async (t) => {
  const { spawn } = await import('node:child_process')
  const { chmodSync, statSync } = await import('node:fs')
  const { setTimeout: delay } = await import('node:timers/promises')
  const host = fixture()
  t.after(host.cleanup)
  const sdkDir = join(host.dir, 'node_modules/easemob-websdk/bundle')
  mkdirSync(sdkDir, { recursive: true })
  writeJson(join(host.dir, 'node_modules/easemob-websdk'), 'package.json', { version: '5.1.3' })
  const exports = ['ChatClient', 'ChatManager', 'ContactManager', 'GroupManager', 'UserInfoManager', 'PushManager', 'setConsoleLogEnabled', 'setLogLevel']
  writeFileSync(join(sdkDir, 'im-sdk-web.iife.js'), `var IMSDK={${exports.map((name) => `${name}:{}`).join(',')}};`)
  const out = join(host.dir, 'out')
  mkdirSync(out, { recursive: true })
  writeJson(out, 'app.json', {})
  writeJson(out, 'project.config.json', { setting: {} })
  writeJson(out, 'project.private.config.json', { setting: { ignoreDevUnusedFiles: true } })
  const fakeEsbuild = join(host.dir, 'fake-esbuild.mjs')
  writeFileSync(fakeEsbuild, '#!/usr/bin/env node\nlet s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(s));\n')
  chmodSync(fakeEsbuild, 0o755)

  const child = spawn(process.execPath, [preparePath, '--project', host.dir, '--out', 'out', '--esbuild', fakeEsbuild, '--watch'], {
    cwd: host.dir,
    stdio: 'ignore'
  })
  t.after(() => child.kill('SIGTERM'))
  const sdkFile = join(out, 'sub-sdk/im-sdk.js')
  for (let index = 0; index < 50 && !existsSync(sdkFile); index++) await delay(100)
  assert.equal(existsSync(sdkFile), true, 'watch 应生成 SDK')
  await delay(400)
  const firstMtime = statSync(sdkFile).mtimeMs
  await delay(4500)
  assert.equal(statSync(sdkFile).mtimeMs, firstMtime, '没有外部变化时不应重复写 SDK')
})

test('登录路由检查拒绝主包聊天跳转', async () => {
  const routeCheckPath = resolve(root, 'scripts/mp-route-check.mjs')
  assert.equal(existsSync(routeCheckPath), true)
  const { validateLoginRoute } = await import(routeCheckPath)
  assert.doesNotThrow(() => validateLoginRoute('url: `/sub-im/pages/chat/chat?conversationId=x`', 'test'))
  assert.throws(
    () => validateLoginRoute('url: `/pages/chat/chat`; fallback: `/sub-im/pages/chat/chat`', 'test'),
    /主包聊天页路径/
  )
})
