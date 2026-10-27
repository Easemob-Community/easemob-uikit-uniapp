#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const types = readFileSync(resolve(root, 'uni_modules/easemob-uikit-uni/libs/types/index.ts'), 'utf8')
const doc = readFileSync(resolve(root, 'docs/CONFIG.md'), 'utf8')
const failures = []

function interfaceFields(name) {
  const match = types.match(new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`))
  if (match == null) throw new Error(`找不到 ${name}`)
  return [...match[1].matchAll(/^  ([A-Za-z][A-Za-z0-9]*)\??:/gm)].map((item) => item[1])
}

function row(field) {
  return doc.split('\n').find((line) => line.startsWith(`| \`${field}\` |`)) ?? ''
}

const configFields = interfaceFields('EmKitConfig')
const uiConfigStart = doc.indexOf('## 2.')
const publicConfigDoc = uiConfigStart >= 0 ? doc.slice(0, uiConfigStart) : doc
for (const field of configFields) {
  const count = publicConfigDoc.split(`| \`${field}\` |`).length - 1
  if (count !== 1) failures.push(`EmKitConfig.${field} 在配置表出现 ${count} 次，应为 1 次`)
}
if (!row('showReadStatus').includes('单聊已读态图标')) failures.push('showReadStatus 缺少已读态展示说明')
if (!row('messageStatus').includes('发送状态（发送中/失败/未读/已读）')) failures.push('messageStatus 说明串到了其他配置')
if (!row('enableGroupReadReceipt').includes('needReadReceipt')) failures.push('enableGroupReadReceipt 缺少群回执说明')

for (const message of failures) console.error(`FAIL ${message}`)
if (failures.length > 0) process.exit(1)
console.log(`OK 配置文档校验通过（${configFields.length} 个 EmKitConfig 字段）`)
