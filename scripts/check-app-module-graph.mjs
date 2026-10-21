#!/usr/bin/env node
// App 端（Android/iOS/鸿蒙）产物模块图自检：零依赖。
//
// 背景：App 编译会把 for-of 等语法的降级辅助（__values/__spreadArray…）提升到某个共享 chunk。
// 一旦落到 components/ 下，libs 里的 store 就会出现 `from "../../components/..."` 的反向 import，
// 串成 libs/index → chat → store → 页面组件 → libs/index 的 ESM 循环；首屏页面求值时
// 顶层 store 仍处 TDZ，抛「xxx is not initialized」→ 白屏（鸿蒙实测，见 skill em-crossend-pitfalls §5c）。
//
// 用法：node scripts/check-app-module-graph.mjs [App 产物目录]
//   默认自动找 demo/unpackage/dist/dev/.app-harmony（HBuilderX「运行到鸿蒙」的 JS 产物），
//   其次 demo/unpackage/dist/dev/app-harmony；传入目录含 assets/ 时自动下钻。
// 退出码：0 = 通过；1 = 命中反向 import 或 libs 参与的循环依赖。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CANDIDATES = [
  path.join(ROOT, 'demo/unpackage/dist/dev/.app-harmony'),
  path.join(ROOT, 'demo/unpackage/dist/dev/app-harmony')
]
const base = path.resolve(process.argv[2] ?? CANDIDATES.find((p) => fs.existsSync(path.join(p, 'assets'))) ?? CANDIDATES[1])

function resolveAssets(dir) {
  const nested = path.join(dir, 'assets')
  if (fs.existsSync(nested) && fs.statSync(nested).isDirectory()) return nested
  return dir
}

const assets = resolveAssets(base)
if (!fs.existsSync(assets)) {
  console.error(`[模块图] 找不到 App 产物目录: ${assets}`)
  console.error('       先跑一次 App/鸿蒙编译（HBuilderX「运行到鸿蒙」或 CLI app-harmony 构建）再执行本检查。')
  process.exit(1)
}

const files = []
;(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(abs)
    else if (entry.name.endsWith('.js')) files.push(abs)
  }
})(assets)

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g

const graph = new Map()
const reverse = []
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8')
  const deps = []
  let m
  IMPORT_RE.lastIndex = 0
  while ((m = IMPORT_RE.exec(src))) {
    const spec = m[1]
    if (!spec.startsWith('.')) continue
    const dep = path.resolve(path.dirname(file), spec)
    if (!deps.includes(dep)) deps.push(dep)
    // libs/** 反向依赖 components/**：helper 提升造成的跨 chunk 引用
    const fromLibs = file.includes(`${path.sep}libs${path.sep}`)
    const toComponents = dep.includes(`${path.sep}components${path.sep}`)
    if (fromLibs && toComponents) reverse.push({ from: file, to: dep })
  }
  graph.set(file, deps)
}

function rel(p) {
  return path.relative(assets, p).split(path.sep).join('/')
}

// 循环依赖：state 0=未访问 1=求值中 2=完成（同 ESM 求值语义）
const state = new Map()
const stack = []
const cycles = []
function dfs(node) {
  state.set(node, 1)
  stack.push(node)
  for (const dep of graph.get(node) ?? []) {
    if (!graph.has(dep)) continue
    const s = state.get(dep) ?? 0
    if (s === 1) {
      cycles.push(stack.slice(stack.indexOf(dep)).concat(dep))
    } else if (s === 0) {
      dfs(dep)
    }
  }
  stack.pop()
  state.set(node, 2)
}
for (const file of files) if (!state.get(file)) dfs(file)

const libsCycles = cycles.filter((c) => c.some((p) => rel(p).includes('libs/index.js')))
let failed = false

console.log(`[模块图] 扫描 ${files.length} 个 ESM 模块: ${path.relative(process.cwd(), assets) || assets}`)

if (reverse.length > 0) {
  failed = true
  console.error(`\n✗ libs 反向依赖 components（${reverse.length} 处）：`)
  for (const { from, to } of reverse) console.error(`  ${rel(from)} → ${rel(to)}`)
  console.error('  多为 for-of 等语法 helper 被提升到组件 chunk；改 forEach/索引 for，见 skill em-crossend-pitfalls §5c。')
} else {
  console.log('✓ libs 无反向依赖 components')
}

if (libsCycles.length > 0) {
  failed = true
  console.error(`\n✗ 命中 libs/index 参与的循环依赖（${libsCycles.length} 条）：`)
  for (const cycle of libsCycles) console.error(`  ${cycle.map(rel).join(' → ')}`)
} else {
  console.log('✓ libs/index 无循环依赖')
}

if (cycles.length > libsCycles.length) {
  console.log(`（另有 ${cycles.length - libsCycles.length} 条与 libs/index 无关的循环，仅提示）`)
}

process.exit(failed ? 1 : 0)
