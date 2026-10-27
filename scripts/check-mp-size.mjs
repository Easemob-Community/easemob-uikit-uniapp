#!/usr/bin/env node
// 微信小程序产物防回归检查（PLAN.md M2.8 / 验证门禁）：
//   1. easemob-websdk 精确锁版（无 ^/~ 漂移）
//   2. SDK 分包文件存在、含 module.exports、主包无 SDK 静态依赖残留（msync 特征串）
//   3. 跨分包 require 引用存活（产物中存在指向 sub-sdk/im-sdk.js 的 require）
//   4. 主包体积阈值（验证门禁：demo 主包 ≤ 1.5MB）
//   5. 产物 JS 语法检查（node --check）
// 用法: node scripts/check-mp-size.mjs [mp-weixin产物目录]
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const hostDir = resolve(process.argv[3] ?? resolve(root, 'demo'))
const outDir = resolve(process.argv[2] ?? resolve(hostDir, 'unpackage/dist/build/mp-weixin'))

const MAIN_PACKAGE_LIMIT = 1.5 * 1024 * 1024
const SDK_FEATURE = 'msync' // websdk 协议层特征串，主包出现即说明 SDK 静态依赖残留

let failed = false
function check(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `（${detail}）` : ''}`)
  if (!ok) failed = true
}

// 1. SDK 精确锁版
const hostPkg = JSON.parse(readFileSync(resolve(hostDir, 'package.json'), 'utf8'))
const dep = hostPkg.dependencies?.['easemob-websdk'] ?? ''
check('websdk 精确锁版', /^[0-9]+\.[0-9]+\.[0-9]+$/.test(dep), `${hostDir}/package.json = "${dep}"`)

// 2. SDK 分包文件与主包残留
const sdkFile = join(outDir, 'sub-sdk/im-sdk.js')
check('SDK 分包文件存在', existsSync(sdkFile), sdkFile)
if (existsSync(sdkFile)) {
  const code = readFileSync(sdkFile, 'utf8')
  check('分包含 module.exports', /module\.exports\s*=\s*IMSDK/.test(code))
  // ?. 必为 0（esbuild target=es2017 保证语言级别；?? 不查——正则字面量 quantifier 如 `)??$` 会造成误报）
  check('分包无 ?. 残留（esbuild 降级生效）', !/\?\./.test(code))
}

// 2.1 未使用文件忽略必须关闭（异步 require 的 SDK 文件不在静态依赖图，开了会被剔除）
const projectConfigPath = join(outDir, 'project.config.json')
if (existsSync(projectConfigPath)) {
  const setting = JSON.parse(readFileSync(projectConfigPath, 'utf8')).setting ?? {}
  check(
    '未使用文件忽略已关闭（ignoreDevUnusedFiles/ignoreUploadUnusedFiles = false）',
    setting.ignoreDevUnusedFiles === false && setting.ignoreUploadUnusedFiles === false
  )
}

// 主包体积：按 app.json subPackages 声明划分开，其余计入主包
const appJson = JSON.parse(readFileSync(join(outDir, 'app.json'), 'utf8'))
const subRoots = new Set((appJson.subPackages ?? []).map((p) => p.root))
function isInSubpackage(rel) {
  for (const r of subRoots) {
    if (rel === r || rel.startsWith(r + '/')) return true
  }
  return false
}
let mainBytes = 0
let subBytes = 0
function walk(dir, relBase) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const rel = relBase === '' ? entry : `${relBase}/${entry}`
    const stat = statSync(full)
    if (stat.isDirectory()) {
      walk(full, rel)
    } else if (isInSubpackage(rel)) {
      subBytes += stat.size
    } else {
      mainBytes += stat.size
    }
  }
}
walk(outDir, '')
check(
  `主包体积 ≤ ${(MAIN_PACKAGE_LIMIT / 1024 / 1024).toFixed(1)}MB`,
  mainBytes <= MAIN_PACKAGE_LIMIT,
  `主包 ${(mainBytes / 1024).toFixed(0)}KB，分包合计 ${(subBytes / 1024).toFixed(0)}KB`
)

// 3. 主包无 SDK 静态依赖残留 + require 引用存活
const vendorFile = join(outDir, 'common/vendor.js')
check('主包 vendor.js 无 SDK 特征串', !existsSync(vendorFile) || !readFileSync(vendorFile, 'utf8').includes(SDK_FEATURE))
let requireAlive = false
function scanRequire(dir, relBase, depth) {
  if (depth > 6 || requireAlive) return
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const rel = relBase === '' ? entry : `${relBase}/${entry}`
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (!isInSubpackage(rel) || rel.startsWith('sub-sdk')) scanRequire(full, rel, depth + 1)
    } else if (entry.endsWith('.js') && stat.size < 5 * 1024 * 1024) {
      if (readFileSync(full, 'utf8').includes('sub-sdk/im-sdk.js')) requireAlive = true
    }
  }
}
scanRequire(outDir, '', 0)
check('跨分包 require 引用存活（主包代码中存在 sub-sdk/im-sdk.js 引用）', requireAlive)

// 4. 产物语法检查（抽查主入口与 SDK 分包）
for (const f of [join(outDir, 'app.js'), vendorFile, sdkFile]) {
  if (!existsSync(f)) continue
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' })
    check(`语法通过 ${f.replace(outDir + '/', '')}`, true)
  } catch (e) {
    check(`语法通过 ${f.replace(outDir + '/', '')}`, false, e.stderr?.toString().slice(0, 120))
  }
}

if (failed) {
  console.error('\n防回归检查未通过')
  process.exit(1)
}
console.log('\n全部防回归检查通过')
