import assert from 'node:assert/strict'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
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
  'skills/em-host-troubleshooting/SKILL.md'
]
const publicCurrentFiles = [
  'docs/HOME.md',
  'docs/GUIDE-MULTI-SCENARIO.md',
  'docs/DESIGN-TOKENS.md',
  'docs/GUIDE-STYLING.md',
  'docs/CONFIG.md',
  'docs/FAQ.md',
  'uni_modules/easemob-uikit-uni/readme.md'
]

function createFixture(t, version = '1.0.0') {
  const root = mkdtempSync(join(tmpdir(), 'em-release-check-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const write = (rel, content) => {
    const path = join(root, rel)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content)
  }
  write('scripts/check-release.mjs', '')
  copyFileSync(join(repoRoot, 'scripts/check-release.mjs'), join(root, 'scripts/check-release.mjs'))
  write('uni_modules/easemob-uikit-uni/package.json', JSON.stringify({
    version,
    uni_modules: {
      platforms: {
        client: {
          'uni-app': {},
          'uni-app-x': {
            app: {
              android: { minVersion: '6.0' },
              ios: { minVersion: '15.0' },
              harmony: '√'
            },
            web: { chrome: '√', safari: '√' },
            mp: { weixin: '√' }
          }
        }
      }
    }
  }))
  const suffix = version.includes('-') ? '（未发布）' : ''
  write('uni_modules/easemob-uikit-uni/changelog.md', `# 更新日志\n\n## ${version}${suffix}\n`)
  write('README.md', `# UIKit\n\n当前版本 ${version}\n`)
  write('LICENSE', 'MIT License\n')
  write('demo/package.json', JSON.stringify({ version }))
  write('demo/manifest.json', JSON.stringify({ versionName: version, versionCode: 10000 }))
  write('uni_modules/easemob-uikit-uni/libs/constants/index.ts', `export const UIKIT_VERSION = '${version}'\n`)
  write('docs/RELEASE-1.0.md', `目标版本 ${version}\n`)
  for (const rel of versionReferences) write(rel, `版本 ${version}\n`)
  for (const rel of publicCurrentFiles) write(rel, `当前版本 ${version}\n`)
  return { root, write }
}

function runCheck(root) {
  return spawnSync(process.execPath, [join(root, 'scripts/check-release.mjs')], {
    cwd: root,
    encoding: 'utf8'
  })
}

test('stable release rejects demo and runtime version drift', (t) => {
  const { root, write } = createFixture(t)
  write('demo/package.json', JSON.stringify({ version: '1.0.0-rc.2' }))
  write('demo/manifest.json', JSON.stringify({ versionName: '1.0.0-rc.2', versionCode: 102 }))
  write('uni_modules/easemob-uikit-uni/libs/constants/index.ts', "export const UIKIT_VERSION = '1.0.0-rc.2'\n")
  const result = runCheck(root)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /demo\/package\.json/)
  assert.match(result.stderr, /demo\/manifest\.json/)
  assert.match(result.stderr, /UIKIT_VERSION/)
})

test('stable release rejects unpublished wording in current public material', (t) => {
  const { root, write } = createFixture(t)
  write('README.md', '当前版本 1.0.0（候选）\n')
  write('docs/HOME.md', '当前版本 1.0.0，处于内测阶段\n')
  write('uni_modules/easemob-uikit-uni/readme.md', '当前版本 1.0.0（未发布）\n')
  write('uni_modules/easemob-uikit-uni/changelog.md', '# 更新日志\n\n## 1.0.0（未发布）\n')
  const result = runCheck(root)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /README\.md/)
  assert.match(result.stderr, /docs\/HOME\.md/)
  assert.match(result.stderr, /uni_modules\/easemob-uikit-uni\/readme\.md/)
  assert.match(result.stderr, /changelog\.md/)
})

test('stable release rejects prerelease references in versioned guides and skills', (t) => {
  const { root, write } = createFixture(t)
  write('skills/README.md', '版本基线 1.0.0-rc.2\n')
  write('docs/CONFIG.md', '示例 android_1.0.0-rc.2_stable-id\n')
  const result = runCheck(root)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /skills\/README\.md/)
  assert.match(result.stderr, /docs\/CONFIG\.md/)
})

test('consistent stable release passes', (t) => {
  const { root } = createFixture(t)
  const result = runCheck(root)
  assert.equal(result.status, 0, result.stderr)
})

test('release candidate may retain unpublished wording', (t) => {
  const { root, write } = createFixture(t, '1.0.0-rc.2')
  write('README.md', '当前版本 1.0.0-rc.2（候选，未发布）\n')
  write('docs/HOME.md', '当前版本 1.0.0-rc.2（内测）\n')
  const result = runCheck(root)
  assert.equal(result.status, 0, result.stderr)
})
