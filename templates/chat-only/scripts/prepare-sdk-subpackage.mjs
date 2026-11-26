#!/usr/bin/env node
// 把 easemob-websdk IIFE 转为 sub-sdk/im-sdk.js，并维护微信项目配置。
// 兼容仓库位置参数与宿主 --project/--out 参数；开发期用 --watch 自动恢复产物。
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const watch = args.includes('--watch')
const WATCH_POLL_MS = 2000
const WATCH_DEBOUNCE_MS = 1500
const GLOBAL_NAME = 'IMSDK'
const REQUIRED_EXPORTS = [
  'ChatClient',
  'ChatManager',
  'ContactManager',
  'GroupManager',
  'UserInfoManager',
  'PushManager',
  'setConsoleLogEnabled',
  'setLogLevel'
]

function argValue(name, fallback) {
  const index = args.indexOf(name)
  if (index < 0) return fallback
  const value = args[index + 1]
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} 缺少参数值`)
  return value
}

const positional = []
for (let index = 0; index < args.length; index++) {
  const arg = args[index]
  if (arg === '--watch') continue
  if (arg.startsWith('--')) {
    index++
    continue
  }
  positional.push(arg)
}

const defaultHost = existsSync(resolve(root, 'demo/package.json')) ? resolve(root, 'demo') : process.cwd()
const hostDir = resolve(argValue('--project', positional[1] ?? defaultHost))
const outArg = argValue('--out', '')
const outDir = outArg === ''
  ? resolve(positional[0] ?? resolve(hostDir, 'unpackage/dist/build/mp-weixin'))
  : resolve(hostDir, outArg)
const sdkDir = resolve(hostDir, 'node_modules/easemob-websdk')
const iifePath = resolve(hostDir, argValue('--sdk', resolve(sdkDir, 'bundle/im-sdk-web.iife.js')))
const esbuildBin = resolve(
  argValue(
    '--esbuild',
    process.env.ESBUILD_BIN ??
      resolve(
        process.env.HBUILDERX_PATH ?? '/Applications/HBuilderX.app/Contents/HBuilderX',
        'plugins/uniapp-cli-vite/node_modules/.bin/esbuild'
      )
  )
)

export function patchProjectConfigs(outDir) {
  const patched = []
  for (const name of ['project.config.json', 'project.private.config.json']) {
    const path = resolve(outDir, name)
    if (!existsSync(path)) continue
    const config = JSON.parse(readFileSync(path, 'utf8'))
    config.setting = {
      ...(config.setting ?? {}),
      ignoreDevUnusedFiles: false,
      ignoreUploadUnusedFiles: false
    }
    writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`)
    patched.push(name)
  }
  return patched
}

function assertOutputReady() {
  for (const name of ['app.json', 'project.config.json']) {
    const path = resolve(outDir, name)
    if (!existsSync(path)) {
      throw new Error(
        `未找到 ${path}\n` +
          '  请先修复 HBuilderX 编译并确认 --out 指向实际 mp-weixin 产物目录。'
      )
    }
  }
}

function runOnce() {
  assertOutputReady()
  if (!existsSync(iifePath)) {
    throw new Error(`找不到 SDK IIFE：${iifePath}\n  先执行 npm install easemob-websdk@5.2.1 --save-exact`)
  }
  if (!existsSync(esbuildBin)) {
    throw new Error(
      `找不到 esbuild：${esbuildBin}\n` +
        '  请设置 HBUILDERX_PATH（HBuilderX 安装目录）或 ESBUILD_BIN，或传 --esbuild <path>'
    )
  }

  const sdkPkg = JSON.parse(readFileSync(resolve(sdkDir, 'package.json'), 'utf8'))
  const iife = readFileSync(iifePath, 'utf8')
  if (!iife.startsWith(`var ${GLOBAL_NAME}=`)) {
    throw new Error(
      `websdk IIFE 全局名不再是 ${GLOBAL_NAME}（实际前缀: ${iife.slice(0, 48)}…），` +
        `请先核对 SDK ${sdkPkg.version} 的导出结构再更新本脚本`
    )
  }

  let code
  try {
    code = execFileSync(
      esbuildBin,
      ['--loader=js', '--target=es2017', '--format=cjs', '--log-level=silent'],
      { input: `${iife}\nmodule.exports=${GLOBAL_NAME};\n`, maxBuffer: 64 * 1024 * 1024 }
    ).toString()
  } catch (e) {
    throw new Error(`SDK 分包转译失败（esbuild）: ${e.message}`)
  }

  const subDir = resolve(outDir, 'sub-sdk')
  mkdirSync(subDir, { recursive: true })
  const outFile = resolve(subDir, 'im-sdk.js')
  writeFileSync(outFile, code)
  execFileSync(
    process.execPath,
    [
      '-e',
      `const m=require(${JSON.stringify(outFile)});` +
        `const r=${JSON.stringify(REQUIRED_EXPORTS)};` +
        `const miss=r.filter(k=>!m[k]);` +
        `if(miss.length){console.error('SDK 分包缺少导出: '+miss.join(','));process.exit(1)}`
    ],
    { maxBuffer: 16 * 1024 * 1024 }
  )

  const patched = patchProjectConfigs(outDir)
  console.log(`[prepare-sdk-subpackage] 已关闭未使用文件忽略（${patched.join(', ')}）`)
  console.log(
    `[prepare-sdk-subpackage] websdk ${sdkPkg.version} → sub-sdk/im-sdk.js ` +
      `${(Buffer.byteLength(code) / 1024).toFixed(0)}KB，导出校验通过`
  )
}

function watchSignature() {
  const appJson = resolve(outDir, 'app.json')
  if (!existsSync(appJson)) return null
  return [
    'app.json',
    'project.config.json',
    'project.private.config.json',
    'sub-sdk/im-sdk.js'
  ].map((name) => {
    const path = resolve(outDir, name)
    if (!existsSync(path)) return `${name}:missing`
    const stat = statSync(path)
    return `${name}:${stat.mtimeMs}:${stat.size}`
  }).join('|')
}

function watchLoop() {
  let last = null
  let timer = null
  let running = false
  const tick = () => {
    if (running) return
    const signature = watchSignature()
    if (signature === null || signature === last) return
    last = signature
    clearTimeout(timer)
    timer = setTimeout(() => {
      running = true
      try {
        runOnce()
        last = watchSignature()
      } catch (e) {
        console.error(`[prepare-sdk-subpackage] watch 重跑失败: ${e.message}`)
      } finally {
        running = false
      }
    }, WATCH_DEBOUNCE_MS)
  }
  console.log(`[prepare-sdk-subpackage] watch 模式：${outDir}（每 ${WATCH_POLL_MS}ms）`)
  tick()
  setInterval(tick, WATCH_POLL_MS)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (watch) watchLoop()
    else runOnce()
  } catch (e) {
    console.error(`[prepare-sdk-subpackage] ${e.message}`)
    process.exitCode = 1
  }
}
