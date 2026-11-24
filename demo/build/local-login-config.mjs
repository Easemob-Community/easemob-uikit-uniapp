import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const EMPTY_LOGIN_CONFIG = {
  appkey: '',
  userId: '',
  token: ''
}

export function readLocalLoginConfig(filePath) {
  if (!existsSync(filePath)) {
    return { ...EMPTY_LOGIN_CONFIG }
  }
  const config = JSON.parse(readFileSync(filePath, 'utf8'))
  return {
    appkey: typeof config.appkey === 'string' ? config.appkey : '',
    userId: typeof config.userId === 'string' ? config.userId : '',
    token: typeof config.token === 'string' ? config.token : ''
  }
}

export function writeLocalLoginConfigModule(filePath, config) {
  const source = `import type { DemoLoginConfig } from './login-config'\n\nexport const DEMO_LOGIN_CONFIG: DemoLoginConfig = ${JSON.stringify(config, null, 2)}\n`
  writeFileSync(filePath, source)
}
