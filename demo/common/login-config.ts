export type DemoLoginConfig = {
  appkey: string
  userId: string
  token: string
}

export type DemoLoginConfigInput = {
  appkey?: string
  userId?: string
  token?: string
}

export function resolveDemoLoginConfig(
  stored: DemoLoginConfigInput = {},
  defaults: DemoLoginConfigInput = {}
): DemoLoginConfig {
  return {
    appkey: stored.appkey || defaults.appkey || '',
    userId: stored.userId || defaults.userId || '',
    token: stored.token || defaults.token || ''
  }
}
