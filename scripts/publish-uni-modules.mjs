#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const defaultCli = '/Applications/HBuilderX.app/Contents/MacOS/cli'

function printHelp() {
  console.log(`用法：
  node scripts/publish-uni-modules.mjs --change-log "更新摘要"
  node scripts/publish-uni-modules.mjs --change-log-file changelog.txt --publish

选项：
  --project <dir>          宿主工程，默认仓库 demo
  --plugin <id>            插件 ID，默认 easemob-uikit-uni
  --cli <path>             HBuilderX CLI，也可用 HBUILDERX_CLI 设置
  --change-log <text>      本次更新摘要
  --change-log-file <path> 从 UTF-8 文件读取更新摘要
  --publish                dry-run 通过后正式发布；默认只校验和 dry-run
  --help                   显示帮助`)
}

function parseArgs(argv) {
  const options = {
    project: resolve(repoRoot, 'demo'),
    plugin: 'easemob-uikit-uni',
    cli: process.env.HBUILDERX_CLI || defaultCli,
    publish: false
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help') return { help: true }
    if (arg === '--publish') {
      options.publish = true
      continue
    }
    const keys = {
      '--project': 'project',
      '--plugin': 'plugin',
      '--cli': 'cli',
      '--change-log': 'changeLog',
      '--change-log-file': 'changeLogFile'
    }
    const key = keys[arg]
    if (key == null) throw new Error(`未知参数：${arg}`)
    index += 1
    if (index >= argv.length) throw new Error(`${arg} 缺少值`)
    options[key] = argv[index]
  }
  return options
}

function runOfficial(options, action, outcome, extraArgs = []) {
  const args = [
    'uni_modules',
    action,
    options.plugin,
    '--project', options.project
  ]
  if (action === '--publish') args.push('--changeLog', options.changeLog)
  args.push(...extraArgs, '--json')
  const result = spawnSync(options.cli, args, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`HBuilderX CLI 退出码 ${result.status}`)
  const lastLine = result.stdout.trim().split('\n').filter((line) => line.trim() !== '').at(-1)
  if (lastLine == null) throw new Error('HBuilderX CLI 未返回 JSON')
  let payload
  try {
    payload = JSON.parse(lastLine)
  } catch {
    throw new Error(`HBuilderX CLI 返回了非法 JSON：${lastLine}`)
  }
  if (payload.success !== true || payload.result?.outcome !== outcome) {
    throw new Error(`${action} 未达到预期结果 ${outcome}`)
  }
}

try {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    process.exit(0)
  }
  if (options.changeLog != null && options.changeLogFile != null) {
    throw new Error('--change-log 与 --change-log-file 不能同时使用')
  }
  if (options.changeLogFile != null) {
    options.changeLog = readFileSync(resolve(options.changeLogFile), 'utf8')
  }
  if (options.changeLog == null || options.changeLog.trim() === '') {
    throw new Error('必须通过 --change-log 或 --change-log-file 提供更新摘要')
  }
  options.project = resolve(options.project)
  const packagePath = resolve(options.project, 'uni_modules', options.plugin, 'package.json')
  if (!existsSync(packagePath)) throw new Error(`找不到插件清单：${packagePath}`)
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8'))
  if (pkg.id != null && pkg.id !== options.plugin) {
    throw new Error(`插件清单 ID ${pkg.id} 与参数 ${options.plugin} 不一致`)
  }
  if (typeof pkg.version !== 'string' || pkg.version === '') {
    throw new Error(`插件清单缺少版本号：${packagePath}`)
  }
  console.log(`插件 ${options.plugin}，版本 ${pkg.version}，模式 ${options.publish ? '正式发布' : 'validate + dry-run'}`)
  runOfficial(options, '--validate', 'validated')
  runOfficial(options, '--publish', 'validated', ['--dryRun'])
  if (options.publish) runOfficial(options, '--publish', 'published')
} catch (error) {
  console.error(`发布流程失败：${error.message}`)
  process.exit(1)
}
