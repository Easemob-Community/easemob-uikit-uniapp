#!/usr/bin/env node
// 1.0 发布物料自检（零依赖）：版本/ changelog / README / 平台矩阵 / LICENSE / 公开面敏感信息。
// 用法：node scripts/check-release.mjs
// 退出码 0 = 通过；1 = 有阻塞项（逐条打印）。
import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const warnings = []

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8')
}

function fail(message) {
  failures.push(message)
}

function warn(message) {
  warnings.push(message)
}

// 1) 插件版本与 changelog 首节一致
const pkgPath = 'uni_modules/easemob-uikit-uni/package.json'
const pkg = JSON.parse(read(pkgPath))
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(pkg.version ?? '')) {
  fail(`${pkgPath}: version 不是合法 semver（${pkg.version}）`)
}
const changelog = read('uni_modules/easemob-uikit-uni/changelog.md')
const firstHeading = changelog.match(/^##\s+([^\s（(]+)/m)
if (firstHeading == null) {
  fail('changelog.md: 找不到首个 ## 版本小节')
} else if (firstHeading[1] !== pkg.version) {
  fail(`changelog.md: 首节版本 ${firstHeading[1]} 与 package.json ${pkg.version} 不一致`)
}

// 2) README 状态与版本
const readme = read('README.md')
if (readme.includes('开发中')) fail('README.md: 仍含「开发中」')
if (!readme.includes(pkg.version)) fail(`README.md: 未出现当前版本 ${pkg.version}`)
if (!existsSync(resolve(root, 'docs/QUICKSTART.md'))) fail('缺少 docs/QUICKSTART.md')

const versionReferences = [
  'AGENTS.md',
  'docs/QUICKSTART.md',
  'skills/README.md',
  'skills/em-host-integration/SKILL.md',
  'skills/em-host-conversation-chat/SKILL.md',
  'skills/em-host-contacts-groups/SKILL.md',
  'skills/em-host-business-extension/SKILL.md',
  'skills/em-host-ai-stream/SKILL.md',
  'skills/em-host-theme-i18n/SKILL.md',
  'skills/em-host-mp-subpackage/SKILL.md',
  'skills/em-host-troubleshooting/SKILL.md',
  'docs/HOME.md',
  'docs/GUIDE-MULTI-SCENARIO.md',
  'docs/DESIGN-TOKENS.md',
  'docs/GUIDE-STYLING.md',
  'docs/CONFIG.md',
  'docs/FAQ.md',
  'docs/RELEASE-1.0.md',
  'uni_modules/easemob-uikit-uni/readme.md',
  'uni_modules/easemob-uikit-uni/libs/constants/index.ts'
]
for (const rel of versionReferences) {
  const content = read(rel)
  if (!content.includes(pkg.version)) fail(`${rel}: 未引用当前版本 ${pkg.version}`)
  if (!pkg.version.includes('-') && content.includes(`${pkg.version}-`)) {
    fail(`${rel}: 仍引用 ${pkg.version} 的预发布版本`)
  }
}

const demoPkg = JSON.parse(read('demo/package.json'))
if (demoPkg.version !== pkg.version) {
  fail(`demo/package.json: version ${demoPkg.version} 与插件版本 ${pkg.version} 不一致`)
}
const demoManifest = read('demo/manifest.json')
const demoManifestJson = JSON.parse(demoManifest)
if (demoManifestJson.versionName !== pkg.version) {
  fail(`demo/manifest.json: versionName ${demoManifestJson.versionName} 与插件版本 ${pkg.version} 不一致`)
}
if (!Number.isInteger(demoManifestJson.versionCode) || demoManifestJson.versionCode <= 0) {
  fail('demo/manifest.json: versionCode 必须是正整数')
}
const constants = read('uni_modules/easemob-uikit-uni/libs/constants/index.ts')
const uikitVersion = constants.match(/export const UIKIT_VERSION = '([^']+)'/)?.[1]
if (uikitVersion !== pkg.version) {
  fail(`UIKIT_VERSION ${uikitVersion ?? '(缺失)'} 与插件版本 ${pkg.version} 不一致`)
}

if (!pkg.version.includes('-')) {
  const currentMaterial = [
    'README.md',
    'docs/HOME.md',
    'docs/QUICKSTART.md',
    'docs/GUIDE-MULTI-SCENARIO.md',
    'docs/DESIGN-TOKENS.md',
    'uni_modules/easemob-uikit-uni/readme.md'
  ]
  for (const rel of currentMaterial) {
    if (/未发布|内测|候选/.test(read(rel))) fail(`${rel}: 正式版仍含候选/未发布/内测口径`)
  }
  const firstChangelogHeading = changelog.match(/^##\s+.+$/m)?.[0] ?? ''
  if (/未发布|内测|候选/.test(firstChangelogHeading)) {
    fail('changelog.md: 正式版首节仍含候选/未发布/内测口径')
  }
}

// 3) 平台矩阵（HBuilderX 4.71+ 新规范）
const client = pkg.uni_modules?.platforms?.client
if (client == null) {
  fail(`${pkgPath}: 缺少 uni_modules.platforms.client`)
} else {
  if (client['uni-app-x'] == null) fail(`${pkgPath}: 缺少 uni-app-x 平台矩阵`)
  if (client['uni-app'] == null) fail(`${pkgPath}: 缺少 uni-app 平台矩阵（应显式全 x）`)
  const ux = client['uni-app-x'] ?? {}
  const app = ux.app ?? {}
  const web = ux.web ?? {}
  const mp = ux.mp ?? {}
  if (app.android == null) fail(`${pkgPath}: uni-app-x 未声明 android`)
  if (app.ios == null) fail(`${pkgPath}: uni-app-x 未声明 ios`)
  if (app.harmony == null) fail(`${pkgPath}: uni-app-x 未声明 harmony`)
  if (web.chrome == null) fail(`${pkgPath}: uni-app-x 未声明 web.chrome`)
  if (mp.weixin == null) fail(`${pkgPath}: uni-app-x 未声明 mp.weixin`)
  const rawPlatforms = JSON.stringify(pkg.uni_modules.platforms)
  if (/"u"/.test(rawPlatforms)) fail(`${pkgPath}: 平台矩阵仍含旧规范 "u" 值`)
}

// 4) LICENSE
if (!existsSync(resolve(root, 'LICENSE'))) {
  fail('缺少根 LICENSE')
} else if (!read('LICENSE').includes('MIT License')) {
  fail('LICENSE: 不是 MIT 文本')
}

// 5) demo manifest 不得含签名配置/绝对路径
if (/signingConfigs|keyPassword|storePassword|"\/Users\//.test(demoManifest)) {
  fail('demo/manifest.json: 含签名配置、密码或本机绝对路径')
}

// 6) 公开面文件不得出现本机绝对路径
const publicFiles = [
  'README.md',
  'docs/QUICKSTART.md',
  'docs/RELEASE-1.0.md',
  'uni_modules/easemob-uikit-uni/readme.md',
  'uni_modules/easemob-uikit-uni/changelog.md'
]
for (const rel of publicFiles) {
  if (existsSync(resolve(root, rel)) && read(rel).includes('/Users/')) {
    fail(`${rel}: 含本机绝对路径 /Users/`)
  }
}

// 7) 提醒：历史提交里的签名密码无法由工作树检查覆盖
try {
  const history = execSync('git log -S keyPassword --oneline -- demo/manifest.json', {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  }).trim()
  if (history !== '') {
    warn('git 历史仍含 demo/manifest.json 的 keyPassword；公开发布前请轮换证书密码并重写历史/重建仓库')
  }
} catch {
  warn('无法检查 git 历史（可能不在 git 仓库中）')
}

for (const message of warnings) console.warn(`WARN  ${message}`)
if (failures.length > 0) {
  for (const message of failures) console.error(`FAIL  ${message}`)
  console.error(`\n发布自检未通过：${failures.length} 项阻塞`)
  process.exit(1)
}
console.log(`OK    发布自检通过（${pkg.version}）；WARN ${warnings.length} 项`)
