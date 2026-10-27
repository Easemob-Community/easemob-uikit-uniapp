#!/usr/bin/env node
// 对外文档校验（零依赖）：
// 1) 公开边界：docs/ 下每个 .md 必须登记在 docs/docs.manifest.mjs，或属于内部材料白名单
// 2) 对外口径：公开页不得出现 P0/P1、M2.x、一期/二期、待验/规划、内部材料名等
// 3) 结构一致：entries / sidebar / editLink / markdownReplacements 与页面清单一致
// 4) 链接：相对链接必须指向已登记页面或已映射资产
// 5) 覆盖：每个 em-* 组件、EmKit 公开方法、EmKitConfig/EmUiConfig 字段都在公开页出现
//
// 用法：node scripts/check-docs.mjs
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const docsRoot = resolve(root, 'docs')
const componentRoot = resolve(root, 'uni_modules/easemob-uikit-uni/components')
const pageComponentRoot = resolve(componentRoot, 'pages')
const libsRoot = resolve(root, 'uni_modules/easemob-uikit-uni/libs')
const manifestPath = resolve(docsRoot, 'docs.manifest.mjs')

const internalDocs = new Set([
  'STATUS.md',
  'EVAL-MULTI-SCENARIO.md',
  'RELEASE-1.0.md',
  'REVIEW-1.0-READINESS.md',
  'SPIKE-SDK-CONNECTIVITY.md',
  'SPIKE-SDK-SUBPACKAGE.md',
  'DX-REVIEW.md',
  'DX-REMEDIATION.md',
])

const errors = []
const fail = message => errors.push(message)

const bannedRules = [
  { re: /\bP[0-3]\b/, label: '内部优先级 P0/P1/P2/P3' },
  { re: /\bM[0-9]+(?:\.[0-9]+)?\b/, label: '内部里程碑编号 M0/M2.9' },
  { re: /\bPhase\s*\d+/i, label: '内部阶段编号 Phase N' },
  { re: /一期|二期|三期/, label: '内部阶段口径 一期/二期/三期' },
  { re: /待验|待验证|挂账|未落地|遗留问题/, label: '内部状态词 待验/挂账/未落地' },
  { re: /路线图|后续里程碑|后续版本|即将支持|计划支持|规划中?/, label: '规划类表述' },
  { re: /\bTODO\b|\bFIXME\b/, label: '待办标记 TODO/FIXME' },
  { re: /\b(?:PLAN|STATUS|SPIKE|REVIEW|RELEASE|EVAL)\b/, label: '内部材料名' },
  { re: /复刻|对齐\s*vue|本轮整改|临时方案|兜底方案/, label: '实现过程口径' },
  { re: /评审结论|内部评审|内部材料/, label: '内部评审口径' },
]

function read(file) {
  return readFileSync(file, 'utf8')
}

function stripFencedCode(text) {
  const lines = text.split('\n')
  let inFence = false
  return lines.map((line) => {
    if (line.trim().startsWith('```')) {
      inFence = !inFence
      return ''
    }
    return inFence ? '' : line
  })
}

function walkMarkdown(dir) {
  const result = []
  for (const name of readdirSync(dir)) {
    const path = resolve(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      if (name === 'assets') continue
      result.push(...walkMarkdown(path))
    } else if (name.endsWith('.md')) {
      result.push(path)
    }
  }
  return result
}

if (!existsSync(manifestPath)) {
  console.error(`✗ 找不到文档清单：${manifestPath}`)
  process.exit(1)
}

const manifestModule = await import(pathToFileURL(manifestPath).href)
const manifest = manifestModule.default
const pages = manifestModule.pages
if (!Array.isArray(pages) || pages.length === 0) {
  console.error('✗ docs.manifest.mjs 未导出 pages 清单')
  process.exit(1)
}

const pageBySource = new Map(pages.map(page => [resolve(root, page.source), page]))
const publicSources = new Set(pages.map(page => resolve(root, page.source)))

// ---------- 1. 公开边界：未登记文档 ----------
for (const file of walkMarkdown(docsRoot)) {
  const name = basename(file)
  const rel = relative(docsRoot, file).replaceAll('\\', '/')
  if (rel.startsWith('superpowers/')) continue
  if (publicSources.has(file)) continue
  if (internalDocs.has(name)) continue
  fail(`docs/${rel}: 未登记到 docs.manifest.mjs 的 pages，也不是内部材料白名单（新增公开页请登记）`)
}

// ---------- 2. 对外口径：内部术语 ----------
const publicMarkdown = pages
  .map(page => resolve(root, page.source))
  .filter(file => file.endsWith('.md') && existsSync(file))

for (const file of publicMarkdown) {
  const rel = relative(root, file).replaceAll('\\', '/')
  const text = read(file)
  const visibleLines = stripFencedCode(text)
  for (const rule of bannedRules) {
    visibleLines.forEach((line, index) => {
      rule.re.lastIndex = 0
      if (rule.re.test(line)) {
        fail(`${rel}:${index + 1}: 出现${rule.label} -> ${line.trim().slice(0, 120)}`)
      }
    })
  }
  if (/\]\((?:\.\.\/)+README\.md\)/.test(text)) {
    fail(`${rel}: 链接到未同步的 ../README.md，请改为已登记页面`)
  }
}

// ---------- 3. 结构一致：entries / sidebar / editLink / replacements ----------
const entrySources = new Set(manifest.entries.map(entry => entry.from))
for (const page of pages) {
  if (!entrySources.has(page.source)) {
    fail(`manifest entries 缺少页面：${page.source}`)
  }
  if (!existsSync(resolve(root, page.source))) {
    fail(`页面源文件不存在：${page.source}`)
  }
}

const sidebarItems = []
const guideGroups = manifest.locale?.themeConfig?.sidebar?.['/uniapp/guide/'] ?? []
for (const group of guideGroups) {
  for (const item of group.items ?? []) sidebarItems.push(item)
}
const sidebarLinks = new Set(sidebarItems.map(item => item.link))
for (const page of pages) {
  if (page.sidebar === false) continue
  const expected = `/${page.to.replace(/\.md$/, '')}`
  if (!sidebarLinks.has(expected)) {
    fail(`sidebar 缺少页面：${page.text}（${expected}）`)
  }
}
for (const link of sidebarLinks) {
  const matched = pages.some(page => `/${page.to.replace(/\.md$/, '')}` === link)
  if (!matched) fail(`sidebar 含未登记链接：${link}`)
}

const editPattern = manifest.locale?.themeConfig?.editLink?.pattern
if (typeof editPattern !== 'function') {
  fail('manifest 缺少 editLink.pattern 函数')
} else {
  for (const page of pages) {
    try {
      const url = editPattern({ relativePath: page.to })
      if (!url.endsWith(`/${page.source}`)) {
        fail(`editLink 映射不一致：${page.to} -> ${url}（期望以 ${page.source} 结尾）`)
      }
    } catch (error) {
      fail(`editLink 缺少映射：${page.to}（${error.message}）`)
    }
  }
}

for (const page of pages) {
  if (!page.source.endsWith('.md')) continue
  const from = `./${basename(page.source)}`
  const to = `./${basename(page.to)}`
  if (from !== to && manifest.markdownReplacements?.[from] !== to) {
    fail(`markdownReplacements 缺少：${from} -> ${to}`)
  }
}

// ---------- 4. 链接 ----------
const publicSourcePaths = new Set(publicSources)
const assetEntry = manifest.entries.find(entry => entry.from === 'docs/assets')
for (const file of publicMarkdown) {
  const rel = relative(root, file).replaceAll('\\', '/')
  const text = read(file)
  const linkRe = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
  let match
  while ((match = linkRe.exec(text)) !== null) {
    const raw = match[1]
    if (/^(?:https?:|mailto:|tel:|#)/.test(raw)) continue
    if (raw.startsWith('/')) continue
    const target = raw.split('#')[0].split('?')[0]
    if (target === '') continue
    const abs = resolve(dirname(file), target)
    if (!existsSync(abs)) {
      fail(`${rel}: 链接目标不存在 -> ${raw}`)
      continue
    }
    if (target.endsWith('.md') && !publicSourcePaths.has(abs)) {
      fail(`${rel}: 链接到未登记 Markdown -> ${raw}`)
    }
    if (!target.endsWith('.md') && !abs.startsWith(resolve(docsRoot, 'assets'))) {
      fail(`${rel}: 链接到未映射资产 -> ${raw}`)
    }
    if (target.endsWith('.md')) {
      const sourceName = basename(abs)
      const destName = basename(pageBySource.get(abs)?.to ?? '')
      if (destName !== '' && sourceName !== destName && manifest.markdownReplacements?.[`./${sourceName}`] == null) {
        fail(`${rel}: 链接 ${raw} 缺少 markdownReplacements 改写`)
      }
    }
  }
}
if (assetEntry == null) fail('manifest entries 缺少 docs/assets 映射')

// ---------- 5. 覆盖：组件 / API / 配置 ----------
const allPublicText = publicMarkdown.map(file => read(file)).join('\n')

const componentNames = []
for (const name of readdirSync(componentRoot)) {
  const path = resolve(componentRoot, name)
  if (!statSync(path).isDirectory()) continue
  if (!name.startsWith('em-')) continue
  componentNames.push(name)
}
if (existsSync(pageComponentRoot)) {
  for (const name of readdirSync(pageComponentRoot)) {
    const path = resolve(pageComponentRoot, name)
    if (!statSync(path).isDirectory()) continue
    if (!name.startsWith('em-')) continue
    componentNames.push(name)
  }
}
for (const name of componentNames) {
  if (!allPublicText.includes(name)) {
    fail(`组件 ${name} 未出现在任何公开页（请补 COMPONENTS-*.md）`)
  }
}

const kitSource = read(resolve(libsRoot, 'index.ts'))
const classStart = kitSource.indexOf('class EmKitImpl')
const classEnd = kitSource.indexOf('export const EmKit', classStart)
const classBody = kitSource.slice(classStart, classEnd)
const methodNames = new Set()
for (const match of classBody.matchAll(/^  (?:async )?([a-zA-Z][A-Za-z0-9]*)\(/gm)) methodNames.add(match[1])
for (const match of classBody.matchAll(/^  get ([a-zA-Z][A-Za-z0-9]*)\b/gm)) methodNames.add(match[1])
const apiDoc = existsSync(resolve(docsRoot, 'API-KIT.md')) ? read(resolve(docsRoot, 'API-KIT.md')) : ''
for (const name of methodNames) {
  const mentioned = apiDoc.includes('EmKit.' + name) || apiDoc.includes('`' + name + '`') || apiDoc.includes('`' + name + '(')
  if (!mentioned) fail(`EmKit 方法 ${name} 未出现在 API-KIT.md`)
}

const typesSource = read(resolve(libsRoot, 'types', 'index.ts'))
function interfaceFields(name) {
  const match = typesSource.match(new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`))
  if (match == null) return []
  return [...match[1].matchAll(/^  ([a-zA-Z][A-Za-z0-9]*)\??:/gm)].map(item => item[1])
}
const configFieldNames = [
  ...new Set([
    ...interfaceFields('EmKitConfig'),
    ...interfaceFields('EmUiConfig'),
  ]),
]
const configDoc = existsSync(resolve(docsRoot, 'CONFIG.md')) ? read(resolve(docsRoot, 'CONFIG.md')) : ''
for (const name of configFieldNames) {
  if (!configDoc.includes('`' + name + '`')) fail(`配置字段 ${name} 未出现在 CONFIG.md`)
}

// ---------- 输出 ----------
if (errors.length > 0) {
  console.error(`✗ 对外文档校验失败（${errors.length} 项）：`)
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}
console.log(`✓ 对外文档校验通过：${pages.length} 个页面 / ${componentNames.length} 个组件 / ${methodNames.size} 个 EmKit 方法 / ${configFieldNames.length} 个配置字段`)
