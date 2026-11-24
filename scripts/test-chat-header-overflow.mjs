#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const chatPage = readFileSync('uni_modules/easemob-uikit-uni/components/pages/em-chat-page/em-chat-page.vue', 'utf8')
const chatStyles = readFileSync('uni_modules/easemob-uikit-uni/components/pages/em-chat-page/em-chat-page.css', 'utf8')
const textStyles = readFileSync('uni_modules/easemob-uikit-uni/components/em-text/em-text.css', 'utf8')
const titleSlotStart = chatPage.indexOf('<slot name="title"')
const titleSlotEnd = chatPage.indexOf('</slot>', titleSlotStart)
assert.ok(titleSlotStart >= 0 && titleSlotEnd > titleSlotStart, '聊天页应保留标题插槽回退内容')
const titleFallback = chatPage.slice(titleSlotStart, titleSlotEnd)

assert.match(titleFallback, /<em-text\b/, '内置导航标题必须使用 em-text，避免普通 text 换行挤压副标题')
assert.ok(titleFallback.includes(':text="navTitle"'), '标题必须保留完整 navTitle，不能在脚本中截断')
assert.ok(titleFallback.includes(':lines="1"'), '内置导航标题必须显式限制为单行')
assert.ok(titleFallback.includes(':text-class="ns.e(\'nav-title\')"'), '标题必须提供 H5/App 文字样式类')
assert.ok(titleFallback.includes(':text-style="fallbackTitleTextStyle"'), '标题必须提供小程序内联文字样式')
assert.ok(titleFallback.includes(':class="ns.e(\'nav-title-host\')"'), '标题必须提供 flex 宿主布局类')
assert.match(chatPage, /const fallbackTitleTextStyle =\s*'[^']*white-space: nowrap;'/, '小程序内联标题样式必须禁止换行')
assert.match(chatStyles, /\.em-chat-page__nav-title-host\s*\{[^}]*width: 100%;[^}]*min-width: 0;[^}]*\}/s, '标题宿主必须占满可用宽度并允许 flex 收缩')
assert.match(chatStyles, /\.em-chat-page__nav-title\s*\{[^}]*font-size: var\(--em-font-size-16\);[^}]*line-height: 22px;[^}]*\}/s, '标题必须保持原有文字规格')
assert.match(textStyles, /\.em-text__value--line1\s*\{[^}]*lines: 1;[^}]*overflow: hidden;[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;[^}]*\}/s, 'em-text 单行档必须继续提供完整省略能力')

console.log('OK 聊天页内置标题保持单行省略，成员数副标题不再受长标题换行挤压')
