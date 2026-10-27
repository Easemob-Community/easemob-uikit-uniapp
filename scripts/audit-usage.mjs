#!/usr/bin/env node
// 宿主接入用量审计（零依赖）：回答「我到底为 UIKit 付了哪些体积、哪些是真浪费」。
//
// 用法：
//   node scripts/audit-usage.mjs [宿主目录]            // 默认 demo
//   node scripts/audit-usage.mjs demo --json           // 机器可读
//   node scripts/audit-usage.mjs demo --check          // CI：能力清单漂移则退出 1
//   node scripts/audit-usage.mjs demo --out reports/audit-demo.md
//
// 判定模型（和「一眼看源码」的区别，先读这段）：
//   1. 编译根 = pages.json 声明的页面文件；只有从编译根可达的宿主文件才算数。
//      没声明的页面文件即使在仓库里、即使写了 <em-chat-page>，也不会进包 —— 不计入使用。
//   2. 组件的三种状态：
//        direct   宿主源码里直接写了标签 / import —— 在用
//        indirect 宿主没直接用，但被用到的页面组件静态 import 了 —— 已进包，改运行时
//                 配置（inputFeatures/menuKeys）**裁不掉**，只能整页裁
//        out      从编译根不可达 —— 本来就没编译，省 0，不是「可裁收益」
//   3. 页面级裁剪（唯一安全可靠的移除手段）：无入站跳转的页面 + 它的独占组件体积。
//   4. 动态用法（<component :is>、表达式 url、:name 绑定）不猜测：进「未知项」，结论标 inferred。
//
// 退出码：0 = 正常；1 = --check 且能力清单漂移（新组件没归类）。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ATOMIC_COMPONENTS, FEATURES, KIT_REL } from './capability-manifest.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const KIT = path.join(REPO, KIT_REL)
const SKIP_DIRS = new Set([
  'node_modules', 'unpackage', 'uni_modules', '.git', 'dist', 'static', '.hbuilderx',
  'harmony-configs', '.venv-icons', '.superpowers', '.agents', 'reports', 'docs', 'scripts'
])
const SOURCE_EXT = new Set(['.uvue', '.vue', '.uts', '.ts', '.js'])
const RESOLVE_EXT = ['.uvue', '.vue', '.uts', '.ts', '.js', '/index.uts', '/index.ts', '/index.js']
// 不随产物分发的构建期资产：em-icons.ttf 会被 build-icons 内联进 em-icon.css，不能计入组件体积
const BUILD_ONLY_EXT = new Set(['.ttf', '.otf', '.woff', '.woff2'])

// ---------- 命令行 ----------
const argv = process.argv.slice(2)
const flags = new Set(argv.filter((a) => a.startsWith('--')))
const positional = argv.filter((a) => !a.startsWith('--'))
const outFlag = argv.find((a) => a.startsWith('--out='))
const HOST = path.resolve(REPO, positional[0] ?? 'demo')
const jsonMode = flags.has('--json')
const checkMode = flags.has('--check')

// ---------- 通用 ----------
function walk(dir, out = []) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(abs, out)
    } else if (SOURCE_EXT.has(path.extname(entry.name))) {
      out.push(abs)
    }
  }
  return out
}

function dirBytes(dir) {
  let total = 0
  const stack = [dir]
  while (stack.length > 0) {
    const cur = stack.pop()
    let entries
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const abs = path.join(cur, entry.name)
      if (entry.isDirectory()) stack.push(abs)
      else if (entry.isFile() && !BUILD_ONLY_EXT.has(path.extname(entry.name))) total += fs.statSync(abs).size
    }
  }
  return total
}

const rel = (p) => path.relative(REPO, p).split(path.sep).join('/')
const kb = (bytes) => `${(bytes / 1024).toFixed(1)}KB`

// UIKit 自身源码不属于「宿主使用」：宿主 `@/uni_modules/...` 的 import 会解析进来，必须挡掉，
// 否则 kit 内部组件互相引用会被当成宿主直接使用，所有组件都会显示「在用」。
const isKitPath = (p) => p.split(path.sep).includes('uni_modules')

// 去注释但保持长度不变（换行/字符位保留），这样后续 lineOf 的行号仍然准确。
// 目的：注释里的 `EmKit.set*Presentation`、`<em-icon>` 示例不能算使用。
function stripComments(text) {
  const chars = text.split('')
  let inStr = null
  let i = 0
  while (i < chars.length) {
    const ch = chars[i]
    const next = chars[i + 1]
    if (inStr !== null) {
      if (ch === '\\') {
        i += 2
        continue
      }
      if (ch === inStr) inStr = null
      i++
      continue
    }
    if (ch === '"' || ch === "'" || ch === '\x60') {
      inStr = ch
      i++
      continue
    }
    let end = -1
    if (ch === '/' && next === '/') {
      end = text.indexOf('\n', i)
      if (end < 0) end = chars.length
    } else if (ch === '/' && next === '*') {
      const close = text.indexOf('*/', i + 2)
      end = close < 0 ? chars.length : close + 2
    } else if (ch === '<' && next === '!' && text.startsWith('<!--', i)) {
      const close = text.indexOf('-->', i + 4)
      end = close < 0 ? chars.length : close + 3
    }
    if (end > i) {
      for (let k = i; k < end; k++) if (chars[k] !== '\n') chars[k] = ' '
      i = end
      continue
    }
    i++
  }
  return chars.join('')
}

function lineOf(text, index) {
  let line = 1
  for (let i = 0; i < index && i < text.length; i++) if (text.charCodeAt(i) === 10) line++
  return line
}

function resolveSpec(spec, fromFile) {
  let base
  if (spec.startsWith('@/')) base = path.join(HOST, spec.slice(2))
  else if (spec.startsWith('/')) base = path.join(HOST, spec.slice(1))
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec)
  else return null
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base
  for (const ext of RESOLVE_EXT) {
    if (fs.existsSync(base + ext)) return base + ext
  }
  return null
}

// ---------- UIKit 侧：组件图 / 图标 ----------
function kitComponents() {
  const ids = new Map()
  const add = (dir, isPage) => {
    const id = path.basename(dir)
    if (!id.startsWith('em-')) return
    const vue = path.join(dir, `${id}.vue`)
    const source = fs.existsSync(vue) ? fs.readFileSync(vue, 'utf8') : ''
    const deps = new Set()
    // 组件间依赖以模板标签为准：kit 内部既有显式 import 也有 easycom 式标签，标签是两者的并集
    for (const m of source.matchAll(/<(em-[a-z0-9]+(?:-[a-z0-9]+)*)(?![a-z0-9-])/g)) {
      if (m[1] !== id) deps.add(m[1])
    }
    ids.set(id, { id, dir, isPage, deps, bytes: dirBytes(dir) })
  }
  for (const entry of fs.readdirSync(path.join(KIT, 'components'), { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.startsWith('em-')) add(path.join(KIT, 'components', entry.name), false)
  }
  const pagesDir = path.join(KIT, 'components/pages')
  if (fs.existsSync(pagesDir)) {
    for (const entry of fs.readdirSync(pagesDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith('em-')) add(path.join(pagesDir, entry.name), true)
    }
  }
  return ids
}

function iconKeys() {
  const file = path.join(KIT, 'components/em-icon/em-icons.ts')
  if (!fs.existsSync(file)) return new Set()
  const keys = new Set()
  for (const m of fs.readFileSync(file, 'utf8').matchAll(/^\s*'([a-z0-9-]+)':\s*'\\u[0-9a-f]{4}',?$/gm)) keys.add(m[1])
  return keys
}

// ---------- 宿主侧：pages.json ----------
function readPages(hostDir) {
  const candidates = [path.join(hostDir, 'pages.json'), path.join(hostDir, 'src/pages.json')]
  const file = candidates.find((p) => fs.existsSync(p))
  if (file === undefined) return { file: null, pages: [], tabBar: new Set() }
  const raw = fs.readFileSync(file, 'utf8')
  let data
  try {
    data = JSON.parse(raw)
  } catch {
    // pages.json 允许注释：剥离后重试（够用即可，不追求完整 JSONC）
    data = JSON.parse(raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'))
  }
  const base = path.dirname(file)
  const pages = []
  const push = (p, pkg, registerPath) => {
    let pageFile = null
    for (const ext of ['.uvue', '.vue']) {
      const candidate = path.join(base, registerPath + ext)
      if (fs.existsSync(candidate)) pageFile = candidate
    }
    pages.push({ path: p, pkg, file: pageFile })
  }
  for (const p of data.pages ?? []) push(p.path, '主包', p.path)
  for (const sub of data.subPackages ?? data.subpackages ?? []) {
    for (const p of sub.pages ?? []) push(`${sub.root}/${p.path}`, sub.root, `${sub.root}/${p.path}`)
  }
  const tabBar = new Set((data.tabBar?.list ?? []).map((i) => i.pagePath))
  return { file: rel(file), pages, tabBar }
}

// ---------- 宿主侧：文件图 ----------
function hostGraph(hostDir) {
  const files = walk(hostDir)
  const graph = new Map()
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8')
    const deps = new Set()
    for (const m of text.matchAll(/(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]/g)) {
      const resolved = resolveSpec(m[1], file)
      if (resolved !== null && !isKitPath(resolved)) deps.add(resolved)
    }
    // 动态 import / require 也纳入，避免漏掉懒加载的宿主组件
    for (const m of text.matchAll(/(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const resolved = resolveSpec(m[1], file)
      if (resolved !== null && !isKitPath(resolved)) deps.add(resolved)
    }
    graph.set(file, deps)
  }
  return { files, graph }
}

function closure(roots, graph) {
  const seen = new Set()
  const queue = [...roots]
  while (queue.length > 0) {
    const cur = queue.pop()
    if (seen.has(cur)) continue
    seen.add(cur)
    for (const dep of graph.get(cur) ?? []) if (!seen.has(dep)) queue.push(dep)
  }
  return seen
}

// ---------- 宿主侧：源码扫描 ----------
const CONFIG_KEYS = [
  'inputFeatures', 'messageMenuKeys', 'conversationMenuKeys', 'contactMenuKeys', 'emojiList',
  'enableDraft', 'enableTyping', 'enableReEdit', 'enableGroupNameEdit', 'enableStreamMessage',
  'showReadStatus', 'enableGroupReadReceipt', 'primaryColor', 'logPayload', 'messageStatus'
]

function scanFiles(files) {
  const usage = {
    files: files.length,
    tags: new Map(),
    imports: new Map(),
    apis: new Map(),
    libSymbols: new Set(),
    iconsLiteral: new Map(),
    iconDynamic: [],
    navUrls: new Set(),
    routes: new Set(),
    navDynamic: [],
    dynamicComponent: [],
    configKeys: new Map()
  }
  for (const file of files) {
    const text = stripComments(fs.readFileSync(file, 'utf8'))
    const where = (index) => ({ file: rel(file), line: lineOf(text, index) })

    for (const m of text.matchAll(/<(em-[a-z0-9]+(?:-[a-z0-9]+)*)(?![a-z0-9-])/g)) {
      if (!usage.tags.has(m[1])) usage.tags.set(m[1], where(m.index))
    }
    for (const m of text.matchAll(/from\s+['"][^'"]*components\/(em-[a-z0-9-]+)\//g)) {
      if (!usage.imports.has(m[1])) usage.imports.set(m[1], where(m.index))
    }
    for (const m of text.matchAll(/\bEmKit\.([A-Za-z_$][\w$]*)/g)) {
      if (!usage.apis.has(m[1])) usage.apis.set(m[1], where(m.index))
    }
    for (const m of text.matchAll(/import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*['"][^'"]*\/libs(?:\/index)?['"]/g)) {
      for (const raw of m[1].split(',')) {
        const name = raw.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim()
        if (name !== '') usage.libSymbols.add(name)
      }
    }
    // 图标：静态字面量 name 与动态绑定分开统计
    for (const m of text.matchAll(/<(?:em-icon|EmIcon)\b[^>]*?(?<!:)\bname\s*=\s*(["'])([a-z0-9-]+)\1/g)) {
      if (!usage.iconsLiteral.has(m[2])) usage.iconsLiteral.set(m[2], where(m.index))
    }
    for (const m of text.matchAll(/<(?:em-icon|EmIcon)\b[^>]*?:name\s*=/g)) usage.iconDynamic.push(where(m.index))
    // 路由：object 字面量里的 url 才算「可静态识别」；模板字符串先剥掉 ${...} 插值再比对
    for (const m of text.matchAll(/\burl\s*:\s*(["'\x60])([^"'\x60]+)\1/g)) {
      usage.navUrls.add(m[2].replace(/\$\{[^}]*\}/g, ''))
    }
    for (const m of text.matchAll(/\burl\s*:\s*([^"'\x60\s])/g)) usage.navDynamic.push(where(m.index))
    // 路由形状的字符串字面量：宿主常把路由放进目录常量（{ path: '/sub-im/pages/x/y' }）再统一跳转
    for (const m of text.matchAll(/(["'\x60])\/?(?:pages|sub-[a-z0-9-]+)\/[a-z0-9][a-z0-9/-]*\1/g)) {
      const raw = m[0].slice(1, -1).replace(/^\//, '').replace(/\/$/, '')
      if (raw !== '') usage.routes.add(raw)
    }
    for (const m of text.matchAll(/<component\b|:\s*is\s*=/g)) usage.dynamicComponent.push(where(m.index))
    for (const key of CONFIG_KEYS) {
      const index = text.indexOf(key)
      if (index >= 0 && !usage.configKeys.has(key)) usage.configKeys.set(key, where(index))
    }
  }
  return usage
}

// ---------- 判定 ----------
function kitClosure(start, graph) {
  const seen = new Set()
  const queue = [...start]
  while (queue.length > 0) {
    const cur = queue.pop()
    if (seen.has(cur) || !graph.has(cur)) continue
    seen.add(cur)
    for (const dep of graph.get(cur).deps) if (!seen.has(dep)) queue.push(dep)
  }
  return seen
}

function analyze(usage, pages, graph, pageComponents) {
  const direct = new Set()
  const evidence = new Map()
  for (const id of [...usage.tags.keys(), ...usage.imports.keys()]) {
    if (graph.has(id) && !direct.has(id)) {
      direct.add(id)
      evidence.set(id, usage.tags.get(id) ?? usage.imports.get(id))
    }
  }
  const inBundle = kitClosure(direct, graph)

  const components = [...graph.values()].map((c) => ({
    id: c.id,
    isPage: c.isPage,
    bytes: c.bytes,
    status: direct.has(c.id) ? 'direct' : inBundle.has(c.id) ? 'indirect' : 'out',
    evidence: evidence.get(c.id) ?? null,
    pages: pageComponents.filter((p) => p.components.has(c.id)).map((p) => p.path)
  }))

  const features = FEATURES.map((f) => {
    const compHits = f.components.filter((id) => direct.has(id))
    const apiHits = f.apis.filter((name) => usage.apis.has(name))
    const reachOnly = f.components.filter((id) => inBundle.has(id) && !direct.has(id))
    let status = 'unused'
    if (compHits.length > 0 || apiHits.length > 0) status = 'direct'
    else if (reachOnly.length > 0) status = 'indirect'
    return {
      id: f.id,
      label: f.label,
      status,
      components: f.components,
      apis: f.apis,
      compHits,
      apiHits,
      reachOnly,
      bytes: f.components.reduce((sum, id) => sum + (graph.get(id)?.bytes ?? 0), 0)
    }
  })

  const pageRows = pages.pages.map((p, index) => {
    const normalized = p.path.replace(/^\//, '')
    const navHits = [...usage.navUrls].filter((u) => u.replace(/^\//, '').split('?')[0] === normalized).length
    const routeHits = navHits > 0 ? 0 : [...usage.routes].filter((r) => r === normalized).length
    const isEntry = index === 0 || pages.tabBar.has(p.path)
    const own = pageComponents.find((x) => x.path === p.path)
    // 独占体积：只被这一页直接使用的组件（近似「删掉这页能省多少」）
    const exclusive = own === undefined
      ? 0
      : [...own.components]
        .filter((id) => components.find((c) => c.id === id)?.pages.length === 1)
        .reduce((sum, id) => sum + (graph.get(id)?.bytes ?? 0), 0)
    return {
      ...p,
      inbound: navHits + routeHits,
      routeLiteral: routeHits > 0,
      isEntry,
      missing: p.file === null,
      componentCount: own?.components.size ?? 0,
      exclusive,
      status: isEntry || navHits + routeHits > 0 ? 'used' : 'unreferenced'
    }
  })

  return { components, features, pageRows, direct, inBundle }
}

function manifestDrift(graph) {
  const assigned = new Set([...FEATURES.flatMap((f) => f.components), ...ATOMIC_COMPONENTS])
  return [...graph.keys()].filter((id) => !assigned.has(id)).sort()
}

// ---------- 渲染 ----------
function render(result, usage, pages, graph, icons, drift) {
  const L = []
  const direct = result.components.filter((c) => c.status === 'direct')
  const indirect = result.components.filter((c) => c.status === 'indirect')
  const out = result.components.filter((c) => c.status === 'out')
  const indirectBytes = indirect.reduce((s, c) => s + c.bytes, 0)
  const outBytes = out.reduce((s, c) => s + c.bytes, 0)
  const deadPages = result.pageRows.filter((p) => p.status === 'unreferenced')
  const deadBytes = deadPages.reduce((s, p) => s + p.exclusive, 0)
  const featUnused = result.features.filter((f) => f.status === 'unused')
  const uncertain = usage.iconDynamic.length + usage.navDynamic.length + usage.dynamicComponent.length

  L.push(`# UIKit 接入用量审计 · ${path.basename(HOST)}`, '')
  L.push(`生成时间：${new Date().toISOString()}　宿主：\`${rel(HOST)}\`　编译根：\`${pages.file ?? '（无 pages.json，回退全量扫描）'}\``, '')

  L.push('## 摘要', '')
  L.push(`- 声明页面 ${result.pageRows.length} 个；组件 ${graph.size} 个：**直接使用 ${direct.length}** / 间接带入 ${indirect.length} / 包外 ${out.length}`)
  L.push(`- 能力 ${result.features.length} 项：在用 ${result.features.filter((f) => f.status === 'direct').length} / 间接 ${result.features.filter((f) => f.status === 'indirect').length} / **未接入 ${featUnused.length}**`)
  L.push(`- 可裁收益：**无入站引用的页面 ${deadPages.length} 个，独占体积 ≈ ${kb(deadBytes)}**（唯一安全可靠的移除手段）`)
  L.push(`- 已进包但没直接用：间接带入 ≈ ${kb(indirectBytes)}（改运行时配置无效，只能整页裁）`)
  L.push(`- 包外（本来就没编译，省 0）：≈ ${kb(outBytes)}`)
  L.push(`- 图标 可用 ${icons.size} / 字面量 ${usage.iconsLiteral.size} / 数据命中 ${usage.iconsDataCount} / 动态 ${usage.iconDynamic.length}`)
  if (uncertain > 0) L.push(`- ⚠ ${uncertain} 处动态用法，相关结论按 **inferred** 处理`)
  L.push('')

  L.push('## 页面（裁剪收益在这里）', '')
  if (result.pageRows.length === 0) L.push('未找到 pages.json，无法按页面判定。', '')
  else {
    L.push('| 页面 | 包 | 入口 | 入站引用 | 独占体积 | 结论 |', '|---|---|---|---|---|---|')
    for (const p of result.pageRows) {
      const refs = `${p.inbound}${p.routeLiteral ? '（字面量）' : ''}`
      const verdict = p.missing ? '✗ 文件缺失' : p.status === 'used' ? '✓' : '✗ 无入站引用'
      L.push(`| \`${p.path}\` | ${p.pkg} | ${p.isEntry ? '是' : '—'} | ${refs} | ${kb(p.exclusive)} | ${verdict} |`)
    }
    L.push('')
    if (deadPages.length > 0) {
      L.push('> 删掉「无入站引用」的页面（从 `pages.json` + 文件）即可让这些组件不再编译；独占体积为近似值，共享组件会保留。', '')
    }
  }

  L.push('## 能力', '', '| 能力 | 结论 | 直接证据 | 间接带入的组件 |', '|---|---|---|---|')
  for (const f of result.features) {
    const verdict = f.status === 'direct' ? '✓ 在用' : f.status === 'indirect' ? '⚠ 间接' : '✗ 未接入'
    const ev = [...f.compHits.map((id) => `\`${id}\``), ...f.apiHits.map((a) => `EmKit.${a}`)].slice(0, 3).join('、')
    L.push(`| ${f.label} | ${verdict} | ${ev || '—'} | ${f.reachOnly.join('、') || '—'} |`)
  }
  L.push('')

  if (featUnused.length > 0) {
    L.push('### 未接入能力', '')
    for (const f of featUnused) {
      const detail = f.components.length > 0
        ? `组件 \`${f.components.join('`、`')}\`，源码 ${kb(f.bytes)}`
        : `纯 API 能力（${f.apis.length} 个方法），无独立组件体积`
      L.push(`- **${f.label}**（\`${f.id}\`）：${detail}`)
    }
    L.push('')
  }

  L.push('## 组件', '', '| 组件 | 层 | 结论 | 源码 | 证据 |', '|---|---|---|---|---|')
  for (const c of [...result.components].sort((a, b) => b.bytes - a.bytes)) {
    const verdict = c.status === 'direct' ? '✓ 直接' : c.status === 'indirect' ? '⚠ 间接' : '— 包外'
    L.push(`| \`${c.id}\` | ${c.isPage ? '页面' : '原子'} | ${verdict} | ${kb(c.bytes)} | ${c.evidence !== null ? `\`${c.evidence.file}:${c.evidence.line}\`` : '—'} |`)
  }
  L.push('')

  L.push('## 图标', '')
  L.push(`可用 ${icons.size} 个，静态字面量 ${usage.iconsLiteral.size} 个：\`${[...usage.iconsLiteral.keys()].join('`、`') || '—'}\``, '')
  if (usage.iconsData.length > 0) {
    L.push(`数据字面量疑似 ${usage.iconsData.length} 个（保守保留）：\`${usage.iconsData.slice(0, 40).join('`、`')}\``, '')
  }
  if (usage.iconDynamic.length > 0) {
    L.push(`动态 \`:name\` ${usage.iconDynamic.length} 处，按「全量保留」处理：`)
    for (const d of usage.iconDynamic.slice(0, 8)) L.push(`- \`${d.file}:${d.line}\``)
    L.push('')
  }

  const unknowns = []
  if (usage.dynamicComponent.length > 0) unknowns.push(`动态组件（\`<component :is>\`）${usage.dynamicComponent.length} 处，使用集合可能不完整`)
  if (usage.navDynamic.length > 0) unknowns.push(`表达式 \`url\` ${usage.navDynamic.length} 处，「无入站引用」可能是假阴性`)
  if (drift.length > 0) unknowns.push(`能力清单未归类：\`${drift.join('`、`')}\``)
  L.push('## 未知项', '')
  if (unknowns.length === 0) L.push('无。', '')
  else for (const u of unknowns) L.push(`- ${u}`)
  L.push('')

  L.push('## 说明', '')
  L.push('- 只有 `pages.json` 声明的页面及其 import 链会被编译；仓库里没声明的页面文件不算使用，也不产出体积。')
  L.push('- 「间接带入」= 用到的页面组件静态 import 了它。`inputFeatures.video=false` 这类运行时开关**不改变体积**。')
  L.push('- 体积为 UIKit 源码字节，不含 websdk（走 sub-sdk 分包）、压缩与跨端差异。')
  return L.join('\n')
}

// ---------- 主流程 ----------
const graph = kitComponents()
const icons = iconKeys()
const pages = readPages(HOST)
const { files, graph: hostFileGraph } = hostGraph(HOST)

// 编译根：pages.json 声明的页面文件；没有 pages.json 时退回全量扫描（结果会偏乐观）
let roots = pages.pages.map((p) => p.file).filter((f) => f !== null)
const fallback = roots.length === 0
if (fallback) roots = files
const compiledFiles = [...closure(roots, hostFileGraph)]
const usage = scanFiles(compiledFiles)

// 每页的直接组件集合（用于页面级裁剪收益）
const pageComponents = pages.pages.map((p) => {
  const own = p.file === null ? new Set() : closure([p.file], hostFileGraph)
  const used = new Set()
  for (const file of own) {
    const text = stripComments(fs.readFileSync(file, 'utf8'))
    for (const m of text.matchAll(/<(em-[a-z0-9]+(?:-[a-z0-9]+)*)(?![a-z0-9-])/g)) {
      if (graph.has(m[1])) used.add(m[1])
    }
  }
  return { path: p.path, components: used }
})

const result = analyze(usage, pages, graph, pageComponents)
const drift = manifestDrift(graph)

// 图标数据层：只认「icon/name 字段的值」这种强形状，避免普通字符串（'image'/'list'）把 420 个键全命中
const dataHits = new Set()
for (const file of compiledFiles) {
  const text = stripComments(fs.readFileSync(file, 'utf8'))
  for (const m of text.matchAll(/[{,]\s*['"]?[A-Za-z0-9_$]*(?:[Ii]con|[Nn]ame|[Gg]lyph)['"]?\s*:\s*['"]([a-z0-9-]{2,32})['"]/g)) {
    if (icons.has(m[1])) dataHits.add(m[1])
  }
}
usage.iconsData = [...dataHits].filter((n) => !usage.iconsLiteral.has(n)).sort()
usage.iconsDataCount = usage.iconsData.length

if (jsonMode) {
  console.log(JSON.stringify({
    host: rel(HOST),
    pagesJson: pages.file,
    fallback,
    compiledFiles: compiledFiles.length,
    components: result.components,
    features: result.features,
    pages: result.pageRows,
    icons: {
      available: icons.size,
      literal: [...usage.iconsLiteral.keys()],
      data: usage.iconsData,
      dynamic: usage.iconDynamic
    },
    apis: [...usage.apis.keys()].sort(),
    libSymbols: [...usage.libSymbols].sort(),
    configKeys: [...usage.configKeys.keys()],
    drift,
    unknown: { dynamicComponent: usage.dynamicComponent, dynamicUrl: usage.navDynamic }
  }, null, 2))
} else if (checkMode) {
  console.log(`[审计] ${rel(HOST)}：页面 ${result.pageRows.length} / 组件 ${graph.size} / 能力 ${result.features.length}`)
  if (drift.length > 0) {
    console.error('\n✗ 能力清单漂移（新组件未归类到 capability-manifest.mjs）：')
    for (const id of drift) console.error(`  - ${id}`)
    process.exit(1)
  }
  console.log('✓ 能力清单无漂移')
} else {
  const report = render(result, usage, pages, graph, icons, drift)
  const outArg = outFlag?.slice('--out='.length)
  if (outArg !== undefined) {
    const outPath = path.resolve(REPO, outArg)
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, report + '\n')
    console.log(`报告已写入 ${rel(outPath)}`)
  } else {
    console.log(report)
  }
}
