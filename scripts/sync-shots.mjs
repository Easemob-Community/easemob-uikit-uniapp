#!/usr/bin/env node
/**
 * 截图发布流水线：把「内部工作区原图」按「对外文档的实际引用」发布到 docs/assets/shots。
 *
 * 为什么这么做：
 * - 原图在 reports/assets/shots/（gitignored，保留 1080 宽 PNG 与全部试拍），
 *   对外站点只需要被公开页真正引用到的那部分，且必须是压缩后的 WebP。
 * - 用「扫文档引用」而不是维护一份图片清单：文档引用什么就发布什么，
 *   增删截图只改 Markdown，不会出现「资产在但文档没引用」或反之的漂移。
 *
 * 用法：
 *   node scripts/sync-shots.mjs           # 生成/更新 docs/assets/shots/**
 *   node scripts/sync-shots.mjs --check   # 只校验：引用有源图、已发布、无孤儿文件
 *
 * 约定：
 * - 正文引用写 `assets/shots/<platform>/<name>.webp`（相对站点 uniapp/guide/assets）。
 * - 源图放 `reports/assets/shots/<platform>/<name>.png`。
 * - 统一输出 WebP：截图含照片，同尺寸 PNG 是 WebP 的 6-8 倍（实测 750 宽聊天页 404KB → 53KB）。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const docsRoot = resolve(root, 'docs')
const sourceRoot = resolve(root, 'reports/assets/shots')
const publisher = resolve(root, 'scripts/shots-publish.py')
const composerScript = resolve(root, 'scripts/shots-compose.py')
const composeSpec = resolve(root, 'scripts/shots-compose.json')
const REF_PREFIX = 'assets/shots/'
const COMPOSITE_PREFIX = `${REF_PREFIX}compare/`
const MAX_WIDTH = 750
const SIZE_WARN_KB = 400

const checkOnly = process.argv.includes('--check')

function fail(message) {
  console.error(`\u2717 ${message}`)
  process.exitCode = 1
}

function listMarkdown(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'assets') out.push(...listMarkdown(path))
    }
    else if (entry.name.endsWith('.md')) {
      out.push(path)
    }
  }
  return out
}

// 只扫对外发布的页面：manifest 里登记的 docs/*.md（内部文档不参与截图发布）
async function publicPages() {
  const { pages } = await import(pathToFileURL(resolve(docsRoot, 'docs.manifest.mjs')).href)
  return pages
    .filter(page => page.source.endsWith('.md') && page.source.startsWith('docs/'))
    .map(page => resolve(root, page.source))
}

function collectRefs(files) {
  const refs = new Map()
  const patterns = [
    /!?\[[^\]]*\]\(([^)\s]*assets\/shots\/[^)\s]+)\)/g,
    /<DocsImage\s+[^>]*\bsrc="([^"]*assets\/shots\/[^"]+)"/g,
  ]
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const re of patterns) {
      let match
      while ((match = re.exec(text)) !== null) {
        const raw = match[1].split('#')[0].split('?')[0]
        const key = raw.startsWith(REF_PREFIX) ? raw : raw.slice(raw.indexOf(REF_PREFIX))
        if (!refs.has(key)) refs.set(key, [])
        const owner = relative(root, file)
        if (!refs.get(key).includes(owner)) refs.get(key).push(owner)
      }
    }
  }
  return refs
}

function sourceFor(rel) {
  // rel 是站点侧引用（assets/shots/<platform>/x.webp），源图根目录已经指向 reports/assets/shots
  const local = rel.startsWith(REF_PREFIX) ? rel.slice(REF_PREFIX.length) : rel
  const withoutExt = local.slice(0, local.lastIndexOf('.'))
  for (const ext of ['.png', '.webp', '.jpg', '.jpeg']) {
    const candidate = resolve(sourceRoot, `${withoutExt}${ext}`)
    if (existsSync(candidate)) return candidate
  }
  return null
}

function loadComposites() {
  const spec = JSON.parse(readFileSync(composeSpec, 'utf8'))
  const byName = new Map()
  for (const item of spec.composites) {
    const shots = item.shots.map(rel => resolve(sourceRoot, rel))
    byName.set(item.name, {
      name: item.name,
      height: item.height ?? spec.height,
      gap: item.gap ?? spec.gap,
      shots,
      rels: item.shots,
    })
  }
  return byName
}

function publishedFiles() {
  const out = []
  const walk = (dir) => {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else out.push(path)
    }
  }
  walk(resolve(docsRoot, REF_PREFIX))
  return out
}

async function main() {
  const refs = collectRefs(await publicPages())
  if (refs.size === 0) {
    fail('公开文档里没有任何 assets/shots/ 引用')
    return
  }

  const composites = loadComposites()
  const rows = []
  const compositeRows = []
  for (const [rel, owners] of [...refs].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!rel.endsWith('.webp')) {
      fail(`${rel}: 引用必须用 .webp（发布格式统一），出现在 ${owners.join(', ')}`)
      continue
    }
    if (rel.startsWith(COMPOSITE_PREFIX)) {
      const name = rel.slice(COMPOSITE_PREFIX.length).replace(/\.webp$/, '')
      const spec = composites.get(name)
      if (spec == null) {
        fail(`${rel}: scripts/shots-compose.json 里没有名为 ${name} 的合成规格`)
        continue
      }
      const missing = spec.shots.filter(shot => !existsSync(shot))
      if (missing.length > 0) {
        fail(`${rel}: 合成图的源图缺失 -> ${missing.map(shot => relative(root, shot)).join(', ')}`)
        continue
      }
      compositeRows.push({ rel, owners, spec, dest: resolve(docsRoot, rel) })
      continue
    }
    const source = sourceFor(rel)
    if (source == null) {
      fail(`${rel}: 找不到源图（期望 reports/assets/shots/${rel.slice(REF_PREFIX.length).replace(/\.webp$/, '.png')}）`)
      continue
    }
    rows.push({ rel, owners, source, dest: resolve(docsRoot, rel) })
  }

  const expected = new Set([...rows, ...compositeRows].map(row => row.dest))
  const stale = publishedFiles().filter(file => !expected.has(file))
  for (const file of stale) {
    if (checkOnly) fail(`孤儿文件（没有文档引用）：${relative(root, file)}`)
    else rmSync(file, { force: true })
  }

  if (checkOnly) {
    for (const row of [...rows, ...compositeRows]) {
      if (!existsSync(row.dest)) fail(`未发布：${row.rel}`)
    }
    if (process.exitCode !== 1)
      console.log(`\u2713 截图引用校验通过：${rows.length} 张单图 + ${compositeRows.length} 张对照图`)
    return
  }

  if (process.exitCode === 1) {
    console.error('\u5b58\u5728\u672a\u5904\u7406\u7684\u5f15\u7528\u9519\u8bef\uff0c\u672a\u5199\u5165\u4efb\u4f55\u56fe\u7247\u3002')
    return
  }

  mkdirSync(resolve(docsRoot, REF_PREFIX), { recursive: true })

  const composePlan = compositeRows.map(row => ({
    name: row.spec.name,
    dest: row.dest,
    height: row.spec.height,
    gap: row.spec.gap,
    shots: row.spec.shots,
  }))
  const composed = composePlan.length === 0
    ? []
    : JSON.parse(execFileSync('python3', [composerScript], { input: JSON.stringify(composePlan), encoding: 'utf8' }))
  for (const item of composed) {
    const row = compositeRows.find(entry => entry.spec.name === item.name)
    console.log(`\u2713 ${row.rel}  ${item.width}x${item.height}  ${Math.round(item.bytes / 1024)}KB  <- ${row.spec.rels.length} 张源图`)
  }

  const plan = rows.map(row => ({ ref: row.rel, source: row.source, dest: row.dest }))
  const published = JSON.parse(
    execFileSync('python3', [publisher], { input: JSON.stringify(plan), encoding: 'utf8' }),
  )
  const byRef = new Map(published.map(item => [item.ref, item]))

  let totalKb = 0
  for (const row of rows) {
    const info = byRef.get(row.rel)
    const kb = Math.round((info?.bytes ?? 0) / 1024)
    totalKb += kb
    console.log(
      `\u2713 ${row.rel}  ${info?.width ?? '?'}px  ${kb}KB  <- ${relative(root, row.source)}`,
    )
    if (kb > SIZE_WARN_KB) console.warn(`! ${row.rel}: ${kb}KB 超过 ${SIZE_WARN_KB}KB，考虑裁切后再引用`)
  }

  const manifestPath = resolve(docsRoot, '.shots-manifest.json')
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        generatedBy: 'scripts/sync-shots.mjs',
        format: 'webp',
        maxWidth: MAX_WIDTH,
        composites: compositeRows.map(row => ({
          ref: row.rel,
          sources: row.spec.rels,
          referencedBy: row.owners,
        })),
        shots: rows.map(row => ({
          ref: row.rel,
          source: relative(root, row.source),
          width: byRef.get(row.rel)?.width ?? null,
          bytes: byRef.get(row.rel)?.bytes ?? null,
          referencedBy: row.owners,
          sourceMtime: statSync(row.source).mtime.toISOString(),
        })),
      },
      null,
      2,
    )}\n`,
  )
  console.log(`\u5b8c\u6210\uff1a${rows.length} \u5f20\uff0c${totalKb}KB\u3002\u5df2\u5199\u5165 ${relative(root, manifestPath)}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
