#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const skillsRoot = resolve(root, 'skills')
const docsRoot = resolve(root, 'docs')
const manifestPath = resolve(docsRoot, 'docs.manifest.mjs')
const { pages } = await import(pathToFileURL(manifestPath).href)

function outputName(skillName) {
  return `SKILLS-${skillName.slice('em-host-'.length).replaceAll('-', '_').toUpperCase().replaceAll('_', '-')}.md`
}

function stripFrontmatter(text) {
  return text.replace(/^---\n[\s\S]*?\n---\n+/, '')
}

function publicDocumentName(file) {
  return file.endsWith('.md') ? `./${basename(file)}` : null
}

export function syncSkillsDocs({ check = false } = {}) {
  const skillNames = readdirSync(skillsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith('em-host-'))
    .map(entry => entry.name)
    .sort()
  const sourceOutputs = new Map([
    [resolve(skillsRoot, 'README.md'), 'GUIDE-AGENT-SKILLS.md'],
    ...skillNames.map(name => [resolve(skillsRoot, name, 'SKILL.md'), outputName(name)]),
  ])
  const publicSources = new Map(pages.map(page => [resolve(root, page.source), page.source]))

  function rewriteLinks(text, sourceFile) {
    return text.replace(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (match, raw) => {
      if (/^(?:https?:|mailto:|tel:|#|\/)/.test(raw)) return match
      const [target, suffix = ''] = raw.split(/(?=#)/)
      if (target === '') return match
      const absoluteTarget = resolve(dirname(sourceFile), target)
      const output = sourceOutputs.get(absoluteTarget)
      if (output) return match.replace(raw, `./${output}${suffix}`)
      const publicSource = publicSources.get(absoluteTarget)
      const publicName = publicSource ? publicDocumentName(publicSource) : null
      if (publicName) return match.replace(raw, `${publicName}${suffix}`)
      return match
    })
  }

  const documents = [{ source: resolve(skillsRoot, 'README.md'), output: 'GUIDE-AGENT-SKILLS.md' }]
  skillNames.forEach(name => {
    documents.push({ source: resolve(skillsRoot, name, 'SKILL.md'), output: outputName(name) })
  })

  const stale = []
  const outputs = documents.map(({ source, output }) => {
    let text = readFileSync(source, 'utf8')
    text = output === 'GUIDE-AGENT-SKILLS.md'
      ? text.split(/^## 事实来源与维护\s*$/m)[0].trimEnd()
      : stripFrontmatter(text).trimStart()
    text = rewriteLinks(text, source)
    const relativeSource = relative(root, source).replaceAll('\\', '/')
    const content = `<!-- Generated from ${relativeSource} by scripts/sync-skills-docs.mjs. Do not edit directly. -->\n\n${text.trimEnd()}\n`
    const destination = resolve(docsRoot, output)
    if (check) {
      if (!existsSync(destination) || readFileSync(destination, 'utf8') !== content)
        stale.push(relative(root, destination).replaceAll('\\', '/'))
    } else {
      writeFileSync(destination, content)
    }
    return destination
  })

  if (stale.length > 0) {
    throw new Error(`Skills 公开文档缺失或已过期：\n${stale.map(file => `  - ${file}`).join('\n')}\n请运行 node scripts/sync-skills-docs.mjs`)
  }
  return outputs
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const check = process.argv.includes('--check')
    const outputs = syncSkillsDocs({ check })
    console.log(`✓ ${check ? 'Skills 公开文档均为最新' : '已生成 Skills 公开文档'}：${outputs.length} 页`)
  } catch (error) {
    console.error(`✗ ${error.message}`)
    process.exitCode = 1
  }
}
