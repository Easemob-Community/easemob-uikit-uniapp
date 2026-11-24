import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const libraryRoot = resolve(root, 'uni_modules/easemob-uikit-uni')

function sourceFilesOf(dir) {
  const files = []
  readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...sourceFilesOf(path))
    } else if (['.ts', '.vue'].includes(extname(entry.name))) {
      files.push(path)
    }
  })
  return files
}

test('定时器与录音手势不重复创建原生 toast 或 loading', () => {
  const files = sourceFilesOf(libraryRoot)
  files.forEach((file) => {
    const source = readFileSync(file, 'utf8')
    const intervals = source.matchAll(/setInterval\(\(\)\s*=>\s*\{([\s\S]*?)\}\s*,/g)
    for (const match of intervals) {
      assert.doesNotMatch(match[1], /uni\.show(?:Toast|Loading)\(/, `${file} 的 setInterval 不得创建原生弹层`)
    }
  })

  const composer = readFileSync(resolve(libraryRoot, 'libs/use/useChatComposer.ts'), 'utf8')
  const touchMove = composer.match(/function onRecordTouchMove\([^)]*\): void \{([\s\S]*?)\n  \}/)
  assert.ok(touchMove)
  assert.doesNotMatch(touchMove[1], /uni\.show(?:Toast|Loading)\(/)
  assert.match(composer, /if \(recordErrorNotified\) return[\s\S]*?uni\.showToast/)
})

test('全库原生 loading 只保留单次下载状态出口', () => {
  const calls = []
  sourceFilesOf(libraryRoot).forEach((file) => {
    const source = readFileSync(file, 'utf8')
    const matches = source.match(/uni\.showLoading\(/g)
    if (matches != null) calls.push({ file, count: matches.length })
  })
  assert.deepEqual(calls, [{
    file: resolve(libraryRoot, 'components/pages/em-chat-page/em-chat-page.vue'),
    count: 1
  }])
})
