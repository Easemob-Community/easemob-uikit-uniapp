#!/usr/bin/env node
import { copyFileSync, existsSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function withRebundledWebSdk(hostDir, esbuildBin, build) {
  const sdkEntry = resolve(hostDir, 'node_modules/easemob-websdk/index.js')
  if (!existsSync(sdkEntry)) {
    throw new Error(`找不到 websdk 入口：${sdkEntry}\n  先执行 npm install easemob-websdk@5.2.0 --save-exact`)
  }
  if (!existsSync(esbuildBin)) {
    throw new Error(`找不到 esbuild：${esbuildBin}\n  请设置 HBUILDERX_PATH 或 ESBUILD_BIN`)
  }

  const backup = `${sdkEntry}.uikit-${process.pid}-${Date.now()}.backup`
  copyFileSync(sdkEntry, backup)
  try {
    execFileSync(esbuildBin, [
      backup,
      '--loader:.backup=js',
      '--bundle',
      '--format=esm',
      `--outfile=${sdkEntry}`
    ], { stdio: 'inherit' })
    return build()
  } finally {
    copyFileSync(backup, sdkEntry)
    rmSync(backup, { force: true })
  }
}

export function buildWeb(hostDir) {
  const hbx = process.env.HBUILDERX_PATH ?? '/Applications/HBuilderX.app/Contents/HBuilderX'
  const cliDir = resolve(hbx, 'plugins/uniapp-cli-vite')
  const uniBin = resolve(cliDir, 'node_modules/.bin/uni')
  const esbuildBin = process.env.ESBUILD_BIN ?? resolve(cliDir, 'node_modules/.bin/esbuild')
  if (!existsSync(uniBin)) throw new Error(`找不到 HBuilderX 内置编译器：${uniBin}`)

  return withRebundledWebSdk(hostDir, esbuildBin, () => {
    execFileSync(process.execPath, [uniBin, 'build', '-p', 'web'], {
      cwd: cliDir,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        UNI_APP_X: 'true',
        UNI_PLATFORM: 'web',
        UNI_INPUT_DIR: `${resolve(hostDir)}/`,
        UNI_OUTPUT_DIR: resolve(hostDir, 'unpackage/dist/build/web')
      },
      stdio: 'inherit'
    })
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildWeb(process.argv[2] ? resolve(process.argv[2]) : resolve(root, 'demo'))
}
