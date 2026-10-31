#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const check = process.argv.includes('--check')
const files = ['mp-weixin.mjs', 'prepare-sdk-subpackage.mjs', 'check-mp-size.mjs']
const targets = [
  'skills/em-host-mp-subpackage/scripts',
  'templates/chat-only/scripts'
]
const stale = []

for (const target of targets) {
  for (const file of files) {
    const source = resolve(root, 'scripts', file)
    const destination = resolve(root, target, file)
    if (!existsSync(destination) || readFileSync(source).equals(readFileSync(destination)) === false) {
      stale.push(relative(root, destination))
      if (!check) {
        mkdirSync(dirname(destination), { recursive: true })
        copyFileSync(source, destination)
      }
    }
  }
}

if (check && stale.length > 0) {
  console.error(`分包脚本缺失或不一致：\n${stale.map((file) => `  - ${file}`).join('\n')}`)
  console.error('请运行 node scripts/sync-mp-subpackage.mjs')
  process.exitCode = 1
} else {
  console.log(check ? '✓ 宿主 Skill 与模板的分包脚本均为最新' : `✓ 已同步 ${files.length * targets.length} 个分包脚本`)
}
