#!/usr/bin/env node
// 校验宿主接入技能包（skills/）的结构与本地链接：
// - 每个 skills/<name>/SKILL.md 存在，frontmatter 有 name/description
// - name 与目录同名、符合 Agent Skills 命名（小写字母/数字/连字符，≤64）
// - description 非空且 ≤1024 字符
// - 代码围栏成对；本地 markdown 链接目标存在
// 零依赖，可挂 CI：node scripts/check-skills.mjs
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { syncSkillsDocs } from './sync-skills-docs.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const skillsRoot = resolve(root, 'skills')
const errors = []
const names = new Map()

function readFrontmatter(text, file) {
  if (!text.startsWith('---\n')) {
    errors.push(`${file}: 缺少 frontmatter（应以 --- 开头）`)
    return {}
  }
  const end = text.indexOf('\n---', 4)
  if (end < 0) {
    errors.push(`${file}: frontmatter 未闭合`)
    return {}
  }
  const block = text.slice(4, end)
  const data = {}
  block.split('\n').forEach((line) => {
    const index = line.indexOf(':')
    if (index <= 0) return
    const key = line.slice(0, index).trim()
    const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, '')
    data[key] = value
  })
  return data
}

function checkLinks(text, file) {
  const linkRe = /\]\((?!https?:|mailto:|#)([^)\s]+)\)/g
  let match
  while ((match = linkRe.exec(text)) !== null) {
    const raw = match[1]
    if (raw.startsWith('#')) continue
    const target = raw.split('#')[0]
    if (target === '') continue
    const abs = resolve(dirname(file), target)
    if (!existsSync(abs)) errors.push(`${file}: 链接目标不存在 -> ${target}`)
  }
}

function checkFences(text, file) {
  const fences = text.split('\n').filter((line) => line.trim().startsWith('```')).length
  if (fences % 2 !== 0) errors.push(`${file}: 代码围栏数量为奇数（${fences}），可能未闭合`)
}

if (!existsSync(skillsRoot)) {
  console.error('✗ 缺少 skills/ 目录')
  process.exit(1)
}

const dirs = readdirSync(skillsRoot)
  .filter((name) => statSync(resolve(skillsRoot, name)).isDirectory())
  .sort()

if (dirs.length === 0) {
  console.error('✗ skills/ 下没有技能目录')
  process.exit(1)
}

dirs.forEach((dir) => {
  const file = resolve(skillsRoot, dir, 'SKILL.md')
  if (!existsSync(file)) {
    errors.push(`${dir}: 缺少 SKILL.md`)
    return
  }
  const text = readFileSync(file, 'utf8')
  const meta = readFrontmatter(text, file)
  const name = meta.name ?? ''
  const description = meta.description ?? ''

  if (name === '') errors.push(`${file}: 缺少 name`)
  if (name !== dir) errors.push(`${file}: name（${name}）与目录名（${dir}）不一致`)
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) errors.push(`${file}: name 只能用小写字母/数字/连字符`)
  if (name.length > 64) errors.push(`${file}: name 超过 64 字符`)
  if (description === '') errors.push(`${file}: 缺少 description`)
  if (description.length > 1024) errors.push(`${file}: description 超过 1024 字符（${description.length}）`)
  if (text.trim().length < 200) errors.push(`${file}: 正文过短，疑似占位`)

  if (names.has(name)) errors.push(`${file}: name 与 ${names.get(name)} 重复`)
  names.set(name, file)

  checkLinks(text, file)
  checkFences(text, file)
})

// README 里的技能链接
const readme = resolve(skillsRoot, 'README.md')
if (existsSync(readme)) checkLinks(readFileSync(readme, 'utf8'), readme)

try {
  syncSkillsDocs({ check: true })
} catch (error) {
  errors.push(error.message)
}

if (errors.length > 0) {
  console.error(`✗ 技能校验失败（${errors.length} 项）：`)
  errors.forEach((e) => console.error(`  - ${e}`))
  process.exit(1)
}

console.log(`✓ 技能校验通过：${dirs.length} 个技能（${dirs.join(', ')}）`)
