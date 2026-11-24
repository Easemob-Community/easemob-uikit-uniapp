#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const contactPage = readFileSync('uni_modules/easemob-uikit-uni/components/pages/em-contact-page/em-contact-page.vue', 'utf8')
const contactListPage = readFileSync('uni_modules/easemob-uikit-uni/components/pages/em-contact-list-page/em-contact-list-page.vue', 'utf8')

assert.equal(contactPage.includes('<em-search-bar'), false, '通讯录入口页不应再显示搜索框')
assert.equal(contactPage.includes('const keyword'), false, '通讯录入口页不应再维护搜索关键词')
assert.equal(contactPage.includes('const entries'), false, '通讯录入口页不应再过滤入口项')
assert.ok(contactPage.includes(':entries="allEntries"'), '通讯录入口页应直接展示全部入口')
assert.equal(contactPage.includes(':keyword="keyword"'), false, '通讯录入口页水印插槽不应再暴露搜索关键词')

assert.ok(contactListPage.includes('<em-search-bar'), '好友列表页应保留搜索框')
assert.ok(
  contactListPage.includes('matchContact(c, nameOf(c), keyword.value)'),
  '好友列表页应保留按展示名和 userId 的搜索链路'
)

console.log('OK 通讯录入口页无搜索，好友列表搜索保持不变')
