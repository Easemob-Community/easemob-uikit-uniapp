#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
function expect(ok, message) { if (!ok) failures.push(message) }
function read(rel) { return readFileSync(resolve(root, rel), 'utf8') }
const chromePath = 'uni_modules/easemob-uikit-uni/libs/use/useThemeChrome.ts'
expect(existsSync(resolve(root, chromePath)), '缺少 useThemeChrome')
expect(read('uni_modules/easemob-uikit-uni/libs/index.ts').includes("export { useThemeChrome }"), 'useThemeChrome 未公开导出')
for (const name of ['em-conversation-page', 'em-contact-page', 'em-group-page', 'em-chat-info-page']) {
  const source = read(`uni_modules/easemob-uikit-uni/components/pages/${name}/${name}.vue`)
  expect(source.includes('title?: string'), `${name} 缺少 title prop`)
  expect(source.includes(':title="title !== \'\' ? title :'), `${name} 未按空串回落默认标题`)
}
const types = read('uni_modules/easemob-uikit-uni/libs/types/index.ts')
expect(types.includes('export type EmLocaleName = LocaleValue | (string & {})'), 'EmLocaleName 未开放扩展语言')
const locale = read('uni_modules/easemob-uikit-uni/libs/use/useLocale.ts')
expect(locale.includes('messages[saved] != null'), '偏好恢复未识别已注入的第三语言')
const client = read('uni_modules/easemob-uikit-uni/libs/client/index.ts')
expect(client.includes("process.env.NODE_ENV !== 'production'"), '能力提示必须只在开发期执行')
expect(client.includes('voice=true') && client.includes('file=true'), '缺少 voice/file 不可用配置提示')

for (const message of failures) console.error(`FAIL ${message}`)
if (failures.length > 0) process.exit(1)
console.log('OK 主题、页面标题与国际化契约校验通过')
