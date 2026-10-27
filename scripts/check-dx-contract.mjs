#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
function read(rel) { return readFileSync(resolve(root, rel), 'utf8') }
function expect(ok, message) { if (!ok) failures.push(message) }

const chat = read('uni_modules/easemob-uikit-uni/components/pages/em-chat-page/em-chat-page.vue')
const constants = read('uni_modules/easemob-uikit-uni/libs/constants/index.ts')
const zh = read('uni_modules/easemob-uikit-uni/libs/locale/zh-CN.ts')
const en = read('uni_modules/easemob-uikit-uni/libs/locale/en.ts')
expect(chat.includes('v-if="showNavBar"'), '聊天页缺少 showNavBar 渲染开关')
expect(chat.includes(':show-back="showBack"'), '聊天页未向 em-nav-bar 透传 showBack')
expect(chat.includes("(e: 'unauthorized'): void"), '聊天页缺少 unauthorized 事件')
expect(constants.includes("UNAUTHORIZED: 'EM_UNAUTHORIZED'"), '缺少 UNAUTHORIZED 错误码')
expect(zh.includes("'chat.unauthorized'") && en.includes("'chat.unauthorized'"), '未登录文案未中英文同步')
expect(chat.includes('inputFeatures?: Partial<EmInputFeatures>'), '缺少页面级 inputFeatures')
expect(chat.includes('messageMenuKeys?: MessageMenuKeyValue[]'), '缺少页面级 messageMenuKeys')
expect((chat.match(/:features="resolvedInputFeatures"/g) ?? []).length === 2, '两条输入栏路径都必须使用页面级 features')
expect(chat.includes('const resolvedMessageMenuKeys = computed'), '缺少页面级菜单解析')
expect(chat.includes('peerName?: string') && chat.includes('peerAvatar?: string'), '缺少对端身份 props')
expect(chat.includes('function syncPeerPresentation'), '缺少身份 props 同步与清理逻辑')
expect(chat.includes('if (unauthorized.value || errorCodeOf(e) === ERROR_CODE.UNAUTHORIZED) return'), '加载更早消息未拦截登出后的旧失败回调')
const kit = read('uni_modules/easemob-uikit-uni/libs/index.ts')
expect(kit.includes('getSDKClient(): Promise<ChatClient>'), '缺少语义明确的 getSDKClient 公开 API')
expect(kit.includes('whenReady(): Promise<ChatClient>'), 'whenReady 返回值必须是明确的 ChatClient 类型')

for (const message of failures) console.error(`FAIL ${message}`)
if (failures.length > 0) process.exit(1)
console.log('OK DX 组件契约校验通过')
