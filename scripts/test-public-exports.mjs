import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const hbx = process.env.HBUILDERX_PATH ?? '/Applications/HBuilderX.app/Contents/HBuilderX'
const cliDir = resolve(hbx, 'plugins/uniapp-cli-vite')
const require = createRequire(import.meta.url)
const { build } = require(resolve(cliDir, 'node_modules/esbuild'))

test('公共入口导出一次性网络探测与网络状态订阅', async (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'em-public-exports-test-'))
  t.after(() => rmSync(temp, { recursive: true, force: true }))
  const entry = join(temp, 'entry.ts')
  const output = join(temp, 'bundle.mjs')
  writeFileSync(entry, `
    import { checkNetworkOnce, subscribeNetworkStatus } from '${resolve(root, 'uni_modules/easemob-uikit-uni/libs/index.ts')}'
    console.log(checkNetworkOnce, subscribeNetworkStatus)
  `)
  await build({
    entryPoints: [entry],
    outfile: output,
    bundle: true,
    platform: 'node',
    format: 'esm',
    external: ['easemob-websdk'],
    nodePaths: [resolve(root, 'demo/node_modules'), resolve(cliDir, 'node_modules')],
    plugins: [{
      name: 'uni-non-mp-conditions',
      setup(build) {
        build.onLoad({ filter: /\.ts$/ }, async (args) => ({
          contents: (await readFile(args.path, 'utf8')).replace(/\/\/ #ifdef MP-WEIXIN[\s\S]*?\/\/ #endif/g, ''),
          loader: 'ts'
        }))
      }
    }]
  })

  const bundle = readFileSync(output, 'utf8')
  assert.match(bundle, /checkNetworkOnce/)
  assert.match(bundle, /subscribeNetworkStatus/)
})

test('公共入口导出附件下载请求 URL 供宿主转发使用', async (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'em-public-exports-test-'))
  t.after(() => rmSync(temp, { recursive: true, force: true }))
  const entry = join(temp, 'entry.ts')
  const output = join(temp, 'bundle.mjs')
  writeFileSync(entry, `
    import { downloadRequestUrlOf } from '${resolve(root, 'uni_modules/easemob-uikit-uni/libs/index.ts')}'
    console.log(downloadRequestUrlOf)
  `)
  await build({
    entryPoints: [entry],
    outfile: output,
    bundle: true,
    platform: 'node',
    format: 'esm',
    external: ['easemob-websdk'],
    nodePaths: [resolve(root, 'demo/node_modules'), resolve(cliDir, 'node_modules')],
    plugins: [{
      name: 'uni-non-mp-conditions',
      setup(build) {
        build.onLoad({ filter: /\.ts$/ }, async (args) => ({
          contents: (await readFile(args.path, 'utf8')).replace(/\/\/ #ifdef MP-WEIXIN[\s\S]*?\/\/ #endif/g, ''),
          loader: 'ts'
        }))
      }
    }]
  })

  const bundle = readFileSync(output, 'utf8')
  assert.match(bundle, /downloadRequestUrlOf/)
})
