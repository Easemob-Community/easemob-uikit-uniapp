#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateLoginRoute } from './mp-route-check.mjs'
import { buildWeb } from './web-sdk-build.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const host = resolve(root, 'templates/chat-only')
const required = [
  'manifest.json', 'pages.json', 'App.uvue', 'main.uts', 'index.html', 'uni.scss',
  'theme.json', 'package.json', 'README.md', 'common/im-config.ts', 'common/session.ts',
  'pages/login/login.uvue', 'sub-im/pages/chat/chat.uvue'
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
  if (pkg.dependencies?.['easemob-websdk'] !== '5.2.0') failures.push('模板必须精确锁 easemob-websdk@5.2.0')
}
if (existsSync(resolve(host, 'pages/chat/chat.uvue'))) failures.push('聊天页必须位于 sub-im 分包')
if (existsSync(resolve(host, 'sub-im/pages/chat/chat.uvue'))) {
  const chat = readFileSync(resolve(host, 'sub-im/pages/chat/chat.uvue'), 'utf8')
  if (!chat.includes('CONVERSATION_TYPE.SINGLE_CHAT')) failures.push('聊天页必须使用合法 SINGLE_CHAT 枚举')
}
if (!existsSync(resolve(host, 'node_modules/easemob-websdk/package.json'))) failures.push('请先运行 npm install --prefix templates/chat-only')
validateLoginRoute(readFileSync(resolve(host, 'pages/login/login.uvue'), 'utf8'), 'chat-only 登录页源码')
for (const message of failures) console.error(`FAIL ${message}`)
if (failures.length > 0) process.exit(1)
execFileSync(process.execPath, [resolve(root, 'scripts/sync-mp-subpackage.mjs'), '--check'], { stdio: 'inherit' })
console.log('OK chat-only 模板结构与脚本同步校验通过')
if (process.argv.includes('--structure-only')) process.exit(0)

const hbx = process.env.HBUILDERX_PATH ?? '/Applications/HBuilderX.app/Contents/HBuilderX'
const cli = resolve(hbx, 'plugins/uniapp-cli-vite/node_modules/.bin/uni')
for (const platform of ['web', 'mp-weixin']) {
  const out = resolve(host, `unpackage/dist/build/${platform}`)
  if (platform === 'web') {
    buildWeb(host)
  } else {
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
  }
  if (platform === 'mp-weixin') {
    execFileSync(process.execPath, [resolve(root, 'scripts/prepare-sdk-subpackage.mjs'), out, host], { stdio: 'inherit' })
    execFileSync(process.execPath, [resolve(root, 'scripts/check-mp-size.mjs'), out, host], { stdio: 'inherit' })
    const appJson = JSON.parse(readFileSync(resolve(out, 'app.json'), 'utf8'))
    validateLoginRoute(readFileSync(resolve(out, 'pages/login/login.js'), 'utf8'), 'mp-weixin 编译后登录页')
    const imPackage = appJson.subPackages?.find((item) => item.root === 'sub-im')
    if (imPackage?.independent !== false || !imPackage.pages.includes('pages/chat/chat')) {
      throw new Error('mp-weixin 产物未将聊天页纳入 sub-im 普通分包')
    }
  }
  const chatOutput = platform === 'web' ? 'index.html' : 'sub-im/pages/chat/chat.js'
  if (!existsSync(resolve(out, chatOutput))) throw new Error(`${platform} 构建缺少聊天页产物 ${chatOutput}`)
}
console.log('OK chat-only web/mp 构建与分包校验通过')
