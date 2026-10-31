import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { withRebundledWebSdk } from './web-sdk-build.mjs'

const original = "export { value } from './chunks/common.js'\n"

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'em-web-sdk-build-'))
  const sdkDir = join(dir, 'node_modules/easemob-websdk')
  mkdirSync(sdkDir, { recursive: true })
  writeFileSync(join(sdkDir, 'index.js'), original)
  const esbuild = join(dir, 'fake-esbuild.mjs')
  writeFileSync(esbuild, `#!/usr/bin/env node
import { writeFileSync } from 'node:fs'
const output = process.argv.find((arg) => arg.startsWith('--outfile='))
writeFileSync(output.slice('--outfile='.length), 'bundled sdk\\n')
`)
  chmodSync(esbuild, 0o755)
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return { dir, sdkDir, esbuild, entry: join(sdkDir, 'index.js') }
}

test('H5 构建期间使用单文件 SDK，成功后恢复原始入口', (t) => {
  const host = fixture(t)
  const result = withRebundledWebSdk(host.dir, host.esbuild, () => {
    assert.equal(readFileSync(host.entry, 'utf8'), 'bundled sdk\n')
    return 'built'
  })

  assert.equal(result, 'built')
  assert.equal(readFileSync(host.entry, 'utf8'), original)
  assert.deepEqual(readdirSync(host.sdkDir), ['index.js'])
})

test('H5 构建失败后仍恢复原始 SDK 入口', (t) => {
  const host = fixture(t)
  assert.throws(() => withRebundledWebSdk(host.dir, host.esbuild, () => {
    throw new Error('build failed')
  }), /build failed/)

  assert.equal(readFileSync(host.entry, 'utf8'), original)
  assert.deepEqual(readdirSync(host.sdkDir), ['index.js'])
})
