#!/usr/bin/env node
// 宿主微信小程序统一入口：dev/build/check/watch。
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const scriptRoot = resolve(scriptDir, '..')
const args = process.argv.slice(2)
const command = args[0] ?? ''

function argValue(name, fallback) {
  const index = args.indexOf(name)
  if (index < 0) return fallback
  const value = args[index + 1]
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} 缺少参数值`)
  return value
}

const defaultHost = existsSync(resolve(scriptRoot, 'demo/package.json')) ? resolve(scriptRoot, 'demo') : scriptRoot
const hostDir = resolve(argValue('--project', defaultHost))
const hbx = process.env.HBUILDERX_PATH ?? '/Applications/HBuilderX.app/Contents/HBuilderX'
const cliDir = resolve(hbx, 'plugins/uniapp-cli-vite')
const uniBin = resolve(cliDir, 'node_modules/.bin/uni')
const prepareBin = resolve(scriptDir, 'prepare-sdk-subpackage.mjs')
const checkBin = resolve(scriptDir, 'check-mp-size.mjs')

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit', ...options })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`命令执行失败（退出码 ${result.status}）：${command} ${commandArgs.join(' ')}`)
}

function outDir(mode) {
  return resolve(hostDir, `unpackage/dist/${mode}/mp-weixin`)
}

function runUni(mode) {
  if (!existsSync(uniBin)) {
    throw new Error(`未找到 HBuilderX 内置编译器：${uniBin}\n请设置 HBUILDERX_PATH 为 HBuilderX 安装目录。`)
  }
  const env = {
    ...process.env,
    NODE_ENV: mode === 'dev' ? 'development' : 'production',
    UNI_APP_X: 'true',
    UNI_PLATFORM: 'mp-weixin',
    UNI_INPUT_DIR: `${hostDir}/`,
    UNI_OUTPUT_DIR: outDir(mode)
  }
  run(process.execPath, [uniBin, ...(mode === 'dev' ? ['-p', 'mp-weixin'] : ['build', '-p', 'mp-weixin'])], {
    cwd: cliDir,
    env
  })
}

try {
  if (command === 'dev') {
    const watcher = spawn(process.execPath, [prepareBin, outDir('dev'), hostDir, '--watch'], { stdio: 'inherit' })
    const stop = () => watcher.kill('SIGTERM')
    process.on('SIGINT', stop)
    process.on('SIGTERM', stop)
    try {
      runUni('dev')
    } finally {
      stop()
    }
  } else if (command === 'build') {
    runUni('build')
    run(process.execPath, [prepareBin, outDir('build'), hostDir])
    run(process.execPath, [checkBin, outDir('build'), hostDir])
  } else if (command === 'check') {
    run(process.execPath, [checkBin, outDir('build'), hostDir])
  } else if (command === 'watch') {
    run(process.execPath, [prepareBin, outDir('dev'), hostDir, '--watch'], { stdio: 'inherit' })
  } else {
    throw new Error('用法：node scripts/mp-weixin.mjs <dev|build|check|watch> [--project <dir>]')
  }
} catch (e) {
  console.error(`[mp-weixin] ${e.message}`)
  process.exitCode = 1
}
