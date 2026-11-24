import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(repoRoot, 'scripts/publish-uni-modules.mjs')

function createFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'em-uni-modules-publish-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const project = join(root, 'host')
  const pluginDir = join(project, 'uni_modules/easemob-uikit-uni')
  mkdirSync(pluginDir, { recursive: true })
  writeFileSync(join(pluginDir, 'package.json'), JSON.stringify({
    id: 'easemob-uikit-uni',
    version: '1.2.3'
  }))
  const log = join(root, 'calls.jsonl')
  const cli = join(root, 'fake-hbuilderx-cli.mjs')
  writeFileSync(cli, `#!/usr/bin/env node
import { appendFileSync } from 'node:fs'
const args = process.argv.slice(2)
appendFileSync(process.env.FAKE_CLI_LOG, JSON.stringify(args) + '\\n')
if (process.env.FAKE_CLI_INVALID === '1') {
  console.log('not-json')
  process.exit(0)
}
const action = args[1]
const dryRun = args.includes('--dryRun')
const failed = (action === '--validate' && process.env.FAKE_CLI_FAIL_VALIDATE === '1') ||
  (action === '--publish' && dryRun && process.env.FAKE_CLI_FAIL_DRY_RUN === '1')
const outcome = failed ? 'failed' : action === '--validate' || dryRun ? 'validated' : 'published'
console.log(JSON.stringify({ success: !failed, result: { action: action.slice(2), outcome } }))
process.exit(process.env.FAKE_CLI_EXIT_ERROR === '1' ? 2 : 0)
`)
  chmodSync(cli, 0o755)
  return { root, project, log, cli }
}

function run(fixture, args = [], env = {}) {
  return spawnSync(process.execPath, [
    script,
    '--project', fixture.project,
    '--change-log', '修复 网络 & 状态',
    ...args
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      FAKE_CLI_LOG: fixture.log,
      ...env
    }
  })
}

function calls(fixture) {
  if (!existsSync(fixture.log)) return []
  return readFileSync(fixture.log, 'utf8').trim().split('\n').map((line) => JSON.parse(line))
}

test('default runs validate and dry-run without publishing', (t) => {
  const fixture = createFixture(t)
  const result = run(fixture, ['--cli', fixture.cli])
  assert.equal(result.status, 0, result.stderr)
  const records = calls(fixture)
  assert.equal(records.length, 2)
  assert.deepEqual(records[0].slice(0, 2), ['uni_modules', '--validate'])
  assert.deepEqual(records[1].slice(0, 2), ['uni_modules', '--publish'])
  assert.ok(records[1].includes('--dryRun'))
  assert.equal(records[1][records[1].indexOf('--changeLog') + 1], '修复 网络 & 状态')
  assert.match(result.stdout, /1\.2\.3/)
})

test('explicit publish runs validate dry-run and publish in order', (t) => {
  const fixture = createFixture(t)
  const result = run(fixture, ['--cli', fixture.cli, '--publish'])
  assert.equal(result.status, 0, result.stderr)
  const records = calls(fixture)
  assert.equal(records.length, 3)
  assert.ok(records[1].includes('--dryRun'))
  assert.ok(!records[2].includes('--dryRun'))
  assert.match(result.stdout, /"outcome"\s*:\s*"published"/)
})

test('failed dry-run stops before real publish', (t) => {
  const fixture = createFixture(t)
  const result = run(fixture, ['--cli', fixture.cli, '--publish'], { FAKE_CLI_FAIL_DRY_RUN: '1' })
  assert.equal(result.status, 1)
  assert.equal(calls(fixture).length, 2)
  assert.match(result.stderr, /validated|failed|dry-run/i)
})

test('invalid official JSON and process failure stop the workflow', (t) => {
  const invalid = createFixture(t)
  const invalidResult = run(invalid, ['--cli', invalid.cli], { FAKE_CLI_INVALID: '1' })
  assert.equal(invalidResult.status, 1)
  assert.equal(calls(invalid).length, 1)
  assert.match(invalidResult.stderr, /JSON/i)

  const failed = createFixture(t)
  const failedResult = run(failed, ['--cli', failed.cli, '--publish'], { FAKE_CLI_EXIT_ERROR: '1' })
  assert.equal(failedResult.status, 1)
  assert.equal(calls(failed).length, 1)
})

test('HBUILDERX_CLI environment selects the official executable', (t) => {
  const fixture = createFixture(t)
  const result = run(fixture, [], { HBUILDERX_CLI: fixture.cli })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(calls(fixture).length, 2)
})

test('custom plugin and change-log file work with the generic interface', (t) => {
  const fixture = createFixture(t)
  const customDir = join(fixture.project, 'uni_modules/example-plugin')
  mkdirSync(customDir, { recursive: true })
  writeFileSync(join(customDir, 'package.json'), JSON.stringify({ id: 'example-plugin', version: '2.3.4' }))
  const notes = join(fixture.root, 'notes.md')
  writeFileSync(notes, '支持自定义插件\n第二行')
  const result = spawnSync(process.execPath, [
    script,
    '--project', fixture.project,
    '--plugin', 'example-plugin',
    '--cli', fixture.cli,
    '--change-log-file', notes
  ], {
    encoding: 'utf8',
    env: { ...process.env, FAKE_CLI_LOG: fixture.log }
  })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /2\.3\.4/)
  const records = calls(fixture)
  assert.equal(records.length, 2)
  assert.ok(records[0].includes('example-plugin'))
  assert.equal(records[1][records[1].indexOf('--changeLog') + 1], '支持自定义插件\n第二行')
})

test('invalid inputs fail before invoking the official CLI', (t) => {
  const fixture = createFixture(t)
  const missingLog = spawnSync(process.execPath, [script, '--project', fixture.project, '--cli', fixture.cli], {
    encoding: 'utf8',
    env: { ...process.env, FAKE_CLI_LOG: fixture.log }
  })
  assert.equal(missingLog.status, 1)
  assert.match(missingLog.stderr, /change-log/)
  assert.equal(calls(fixture).length, 0)

  const conflict = run(fixture, ['--cli', fixture.cli, '--change-log-file', join(fixture.root, 'notes.md')])
  assert.equal(conflict.status, 1)
  assert.match(conflict.stderr, /change-log/)
  assert.equal(calls(fixture).length, 0)
})
