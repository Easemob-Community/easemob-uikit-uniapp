#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const host = resolve(root, 'templates/chat-only')
const required = [
  'manifest.json', 'pages.json', 'App.uvue', 'main.uts', 'index.html', 'uni.scss',
  'theme.json', 'package.json', 'README.md', 'common/im-config.ts', 'common/session.ts',
  'pages/login/login.uvue', 'pages/chat/chat.uvue'
]
const failures = []
for (const rel of required) {
  if (!existsSync(resolve(host, rel))) failures.push(`缺少 templates/chat-only/${rel}`)
}
const link = resolve(host, 'uni_modules/easemob-uikit-uni')
if (!existsSync(link) || !lstatSync(link).isSymbolicLink()) {
  failures.push('模板 uni_modules/easemob-uikit-uni 必须是相对软链')
} else if (realpathSync(link) !== resolve(root, 'uni_modules/easemob-uikit-uni')) {
  failures.push('模板插件软链目标错误')
}
if (existsSync(resolve(host, 'package.json'))) {
  const pkg = JSON.parse(readFileSync(resolve(host, 'package.json'), 'utf8'))
  if (pkg.dependencies?.['easemob-websdk'] !== '5.1.3') failures.push('模板必须精确锁 easemob-websdk@5.1.3')
}
if (existsSync(resolve(host, 'pages/chat/chat.uvue'))) {
  const chat = readFileSync(resolve(host, 'pages/chat/chat.uvue'), 'utf8')
  if (!chat.includes('CONVERSATION_TYPE.SINGLE_CHAT')) failures.push('聊天页必须使用合法 SINGLE_CHAT 枚举')
}
if (!existsSync(resolve(host, 'node_modules/easemob-websdk/package.json'))) failures.push('请先运行 npm install --prefix templates/chat-only')
for (const message of failures) console.error(`FAIL ${message}`)
if (failures.length > 0) process.exit(1)
console.log('OK chat-only 模板结构校验通过')
if (process.argv.includes('--structure-only')) process.exit(0)

const hbx = process.env.HBUILDERX_PATH ?? '/Applications/HBuilderX.app/Contents/HBuilderX'
const cli = resolve(hbx, 'plugins/uniapp-cli-vite/node_modules/.bin/uni')
for (const platform of ['web', 'mp-weixin']) {
  const out = resolve(host, `unpackage/dist/build/${platform}`)
  execFileSync(cli, ['build', '-p', platform], {
    cwd: resolve(cli, '../../..'),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      UNI_APP_X: 'true',
      UNI_PLATFORM: platform,
      UNI_INPUT_DIR: `${host}/`,
      UNI_OUTPUT_DIR: out
    },
    stdio: 'inherit'
  })
  if (platform === 'mp-weixin') {
    execFileSync(process.execPath, [resolve(root, 'scripts/prepare-sdk-subpackage.mjs'), out, host], { stdio: 'inherit' })
    execFileSync(process.execPath, [resolve(root, 'scripts/check-mp-size.mjs'), out, host], { stdio: 'inherit' })
  }
  if (!existsSync(resolve(out, platform === 'web' ? 'index.html' : 'pages/chat/chat.js'))) {
    throw new Error(`${platform} 构建缺少聊天页产物`)
  }
}
console.log('OK chat-only web/mp 构建与分包校验通过')
