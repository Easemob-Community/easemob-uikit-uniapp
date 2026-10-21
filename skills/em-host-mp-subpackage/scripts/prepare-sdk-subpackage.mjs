#!/usr/bin/env node
// 宿主版「微信小程序 SDK 分包」构建后处理：
// 把 easemob-websdk 的自包含 IIFE 转成可被跨分包 require 的 CJS 模块，写入 mp-weixin 产物的 sub-sdk/im-sdk.js，
// 并关闭微信开发者工具的「未使用文件忽略」（否则该文件会被依赖分析剔除）。
//
// 用法（在宿主工程根目录，构建完成后执行）：
//   node scripts/prepare-sdk-subpackage.mjs
//   node scripts/prepare-sdk-subpackage.mjs --project . --out unpackage/dist/build/mp-weixin
//   node scripts/prepare-sdk-subpackage.mjs --watch        # dev 产物被整体重发后自动补文件
//
// 可选参数：
//   --project <dir>   宿主工程根目录（默认当前目录）
//   --out <dir>       mp-weixin 产物目录（默认 <project>/unpackage/dist/build/mp-weixin）
//   --sdk <file>      SDK IIFE 路径（默认 <project>/node_modules/easemob-websdk/bundle/im-sdk-web.iife.js）
//   --esbuild <file>  esbuild 可执行文件（默认读 ESBUILD_BIN，或 HBuilderX 内置路径）
//
// 依赖：仅 Node 18+ 与 esbuild（HBuilderX 自带，无需 npm 安装）。
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const args = process.argv.slice(2)
const watch = args.includes('--watch')

function argValue(name, fallback) {
  const index = args.indexOf(name)
  if (index < 0) return fallback
  const value = args[index + 1]
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${name} 缺少参数值`)
  }
  return value
}

const project = resolve(argValue('--project', process.cwd()))
const outArg = argValue('--out', '')
const outDir = outArg === '' ? resolve(project, 'unpackage/dist/build/mp-weixin') : resolve(project, outArg)
const sdkDir = resolve(project, 'node_modules/easemob-websdk')
const sdkArg = argValue('--sdk', '')
const iifePath = sdkArg === '' ? resolve(sdkDir, 'bundle/im-sdk-web.iife.js') : resolve(project, sdkArg)
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
const WATCH_POLL_MS = 2000
const WATCH_DEBOUNCE_MS = 1500

function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

function abort(message) {
  throw new Error(message)
}

function kb(size) {
  return `${Math.round(size / 1024)}KB`
}

function readVersion() {
  const pkgPath = resolve(sdkDir, 'package.json')
  if (!existsSync(pkgPath)) return 'unknown'
  try {
    return JSON.parse(readFileSync(pkgPath, 'utf8')).version ?? 'unknown'
  } catch (e) {
    return 'unknown'
  }
}

function runOnce() {
  if (!existsSync(iifePath)) {
    abort(`找不到 SDK IIFE：${iifePath}\n  先执行 npm install easemob-websdk@5.1.3 --save-exact`)
  }
  if (!existsSync(esbuildBin)) {
    abort(
      `找不到 esbuild：${esbuildBin}\n` +
        `  设置 HBUILDERX_PATH（HBuilderX 安装目录）或 ESBUILD_BIN，或传 --esbuild <path>`
    )
  }

  const iife = readFileSync(iifePath, 'utf8')
  if (!iife.startsWith(`var ${GLOBAL_NAME}=`)) {
    abort(
      `websdk IIFE 全局名不再是 ${GLOBAL_NAME}（实际前缀：${iife.slice(0, 48)}…）。\n` +
        `  升级 SDK 后请先核对导出结构，再更新本脚本。`
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
    abort(`SDK 转译失败（esbuild）：${e.message}`)
  }

  const subDir = resolve(outDir, 'sub-sdk')
  mkdirSync(subDir, { recursive: true })
  const outFile = resolve(subDir, 'im-sdk.js')
  writeFileSync(outFile, code)

  try {
    execFileSync(
      process.execPath,
      [
        '-e',
        `const m=require(${JSON.stringify(outFile)});` +
          `const miss=${JSON.stringify(REQUIRED_EXPORTS)}.filter(k=>!m[k]);` +
          `if(miss.length){console.error('缺少导出: '+miss.join(','));process.exit(1)}`
      ],
      { maxBuffer: 16 * 1024 * 1024 }
    )
  } catch (e) {
    abort(`SDK 分包产物缺少必需导出（SDK 导出结构可能已变化）：${e.message}`)
  }

  const configPath = resolve(outDir, 'project.config.json')
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf8'))
      config.setting = config.setting ?? {}
      config.setting.ignoreDevUnusedFiles = false
      config.setting.ignoreUploadUnusedFiles = false
      writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
    } catch (e) {
      console.warn(`⚠ 无法更新 project.config.json（可手动关闭未使用文件忽略）：${e.message}`)
    }
  } else {
    console.warn(`⚠ 未找到 ${configPath}，跳过「未使用文件忽略」开关；请确认产物目录正确`)
  }

  const version = readVersion()
  console.log(
    `✓ SDK 分包就绪：websdk ${version} → ${outFile}（${kb(statSync(outFile).size)}，已降级 es2017）`
  )
  console.log(`  产物目录：${outDir}`)
  console.log('  下一步：微信开发者工具确认分包面板出现 /sub-sdk/，且主包不含 SDK')
}

function watchLoop() {
  const appJson = resolve(outDir, 'app.json')
  let last = ''
  let timer = null
  let running = false

  const tick = () => {
    if (running) return
    try {
      const stat = statSync(appJson)
      const signature = `${stat.mtimeMs}:${stat.size}`
      if (signature === last) return
      last = signature
      if (timer != null) clearTimeout(timer)
      timer = setTimeout(() => {
        running = true
        try {
          runOnce()
        } catch (e) {
          console.error(`✗ 分包后处理失败：${e.message}`)
        } finally {
          running = false
        }
      }, WATCH_DEBOUNCE_MS)
    } catch (e) {
      // app.json 尚未生成（首次构建还没完成）：继续等
    }
  }

  console.log(`… watch 模式：轮询 ${appJson}（每 ${WATCH_POLL_MS}ms）`)
  tick()
  setInterval(tick, WATCH_POLL_MS)
}

try {
  if (watch) {
    watchLoop()
  } else {
    runOnce()
  }
} catch (e) {
  fail(e.message)
}
