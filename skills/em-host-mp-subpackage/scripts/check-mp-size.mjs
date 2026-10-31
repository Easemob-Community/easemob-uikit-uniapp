#!/usr/bin/env node
// 微信小程序产物检查：分包声明、SDK 文件与导出、项目配置、主包体积和语法。
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const hostDir = resolve(process.argv[3] ?? (existsSync(resolve(root, 'demo/package.json')) ? resolve(root, 'demo') : process.cwd()))
const outDir = resolve(process.argv[2] ?? resolve(hostDir, 'unpackage/dist/build/mp-weixin'))
const MAIN_PACKAGE_LIMIT = 1.5 * 1024 * 1024
const SDK_FEATURE = 'msync'
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

export function validateUnusedFileSettings(outDir) {
  const failures = []
  const publicPath = join(outDir, 'project.config.json')
  if (!existsSync(publicPath)) return [`缺少 project.config.json：${publicPath}，请确认产物目录`]
  for (const name of ['project.config.json', 'project.private.config.json']) {
    const path = join(outDir, name)
    if (!existsSync(path)) continue
    const setting = JSON.parse(readFileSync(path, 'utf8')).setting ?? {}
    for (const key of ['ignoreDevUnusedFiles', 'ignoreUploadUnusedFiles']) {
      if (setting[key] !== false) {
        failures.push(`${name} 的 ${key}=${String(setting[key])}，请运行 prepare-sdk-subpackage.mjs 修复`)
      }
    }
  }
  return failures
}

function run() {
  console.log(`检查产物目录：${outDir}`)
  const appJsonPath = join(outDir, 'app.json')
  if (!existsSync(appJsonPath)) {
    console.error(`✗ 未找到 app.json：${appJsonPath}\n  请先修复 HBuilderX 编译错误，再执行分包后处理与检查。`)
    process.exitCode = 1
    return
  }

  let appJson
  try {
    appJson = JSON.parse(readFileSync(appJsonPath, 'utf8'))
  } catch (e) {
    console.error(`✗ app.json 不可解析：${e.message}\n  请重新执行 HBuilderX 编译。`)
    process.exitCode = 1
    return
  }

  let failed = false
  function check(name, ok, detail = '') {
    console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `（${detail}）` : ''}`)
    if (!ok) failed = true
  }

  const hostPkg = JSON.parse(readFileSync(resolve(hostDir, 'package.json'), 'utf8'))
  const dep = hostPkg.dependencies?.['easemob-websdk'] ?? ''
  check('websdk 精确锁版', /^[0-9]+\.[0-9]+\.[0-9]+$/.test(dep), `${hostDir}/package.json = "${dep}"`)

  const subPackages = appJson.subPackages ?? []
  const sdkPackage = subPackages.find((item) => item.root === 'sub-sdk')
  check('sub-sdk 普通分包已声明', sdkPackage != null && sdkPackage.independent === false)
  check(
    'sub-sdk 占位页已声明',
    sdkPackage?.pages?.includes('pages/placeholder/placeholder') === true
  )
  const imPackage = subPackages.find((item) => item.root === 'sub-im')
  if (imPackage != null) check('sub-im 使用普通分包', imPackage.independent === false)
  const preloadPackages = Object.values(appJson.preloadRule ?? {}).flatMap((rule) => rule.packages ?? [])
  check('已配置 sub-sdk 预下载', preloadPackages.includes('sub-sdk'), '检查 app.json preloadRule')

  const sdkFile = join(outDir, 'sub-sdk/im-sdk.js')
  check('SDK 分包文件存在', existsSync(sdkFile), sdkFile)
  if (existsSync(sdkFile)) {
    const code = readFileSync(sdkFile, 'utf8')
    check('分包含 module.exports', /module\.exports\s*=\s*IMSDK/.test(code))
    check('分包无 ?. 残留（esbuild 降级生效）', !/\?\./.test(code))
    try {
      execFileSync(
        process.execPath,
        [
          '-e',
          `const m=require(${JSON.stringify(sdkFile)});` +
            `const miss=${JSON.stringify(REQUIRED_EXPORTS)}.filter(k=>!m[k]);` +
            `if(miss.length){console.error(miss.join(','));process.exit(1)}`
        ],
        { stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 }
      )
      check('SDK 必需导出可用', true)
    } catch (e) {
      check('SDK 必需导出可用', false, e.stderr?.toString().slice(0, 160))
    }
  }

  for (const failure of validateUnusedFileSettings(outDir)) check('未使用文件忽略已关闭', false, failure)
  if (validateUnusedFileSettings(outDir).length === 0) check('公共/私有未使用文件忽略均已关闭', true)

  const subRoots = new Set(subPackages.map((item) => item.root))
  function isInSubpackage(rel) {
    for (const root of subRoots) {
      if (rel === root || rel.startsWith(`${root}/`)) return true
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
      if (stat.isDirectory()) walk(full, rel)
      else if (isInSubpackage(rel)) subBytes += stat.size
      else mainBytes += stat.size
    }
  }
  walk(outDir, '')
  check(
    '主包体积 ≤ 1.5MB',
    mainBytes <= MAIN_PACKAGE_LIMIT,
    `主包 ${(mainBytes / 1024).toFixed(0)}KB，分包合计 ${(subBytes / 1024).toFixed(0)}KB`
  )

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
  check('跨分包 require 引用存活', requireAlive, '主包代码应引用 sub-sdk/im-sdk.js')

  for (const file of [join(outDir, 'app.js'), vendorFile, sdkFile]) {
    if (!existsSync(file)) continue
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' })
      check(`语法通过 ${file.replace(`${outDir}/`, '')}`, true)
    } catch (e) {
      check(`语法通过 ${file.replace(`${outDir}/`, '')}`, false, e.stderr?.toString().slice(0, 120))
    }
  }

  if (failed) {
    console.error('\n分包检查未通过')
    process.exitCode = 1
    return
  }
  console.log('\n全部分包检查通过')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    run()
  } catch (e) {
    console.error(`✗ 分包检查执行失败：${e.message}`)
    process.exitCode = 1
  }
}
