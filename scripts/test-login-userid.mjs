import assert from 'node:assert/strict'
import test from 'node:test'

async function loadNormalizer() {
  return import('../uni_modules/easemob-uikit-uni/libs/client/login.ts').catch(() => ({}))
}

test('大小写混写的 userId 触发一次警告并生成全小写登录参数', async () => {
  const { normalizeLoginOptions } = await loadNormalizer()
  assert.equal(typeof normalizeLoginOptions, 'function')

  const options = { userId: 'User123', token: 'server-token' }
  const warnings = []
  const result = normalizeLoginOptions(options, (message) => warnings.push(message))

  assert.deepEqual(result, { userId: 'user123', token: 'server-token' })
  assert.deepEqual(options, { userId: 'User123', token: 'server-token' })
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /User123/)
  assert.match(warnings[0], /user123/)
  assert.match(warnings[0], /请勿使用大写英文字母 A-Z/)
})

test('全大写 userId 触发一次警告并生成全小写登录参数', async () => {
  const { normalizeLoginOptions } = await loadNormalizer()
  assert.equal(typeof normalizeLoginOptions, 'function')

  const cases = [
    { userId: 'PFH', expected: 'pfh' },
    { userId: 'USER123', expected: 'user123' }
  ]
  for (const { userId, expected } of cases) {
    const options = { userId, token: 'server-token' }
    const warnings = []
    const result = normalizeLoginOptions(options, (message) => warnings.push(message))
    assert.deepEqual(result, { userId: expected, token: 'server-token' })
    assert.deepEqual(options, { userId, token: 'server-token' })
    assert.equal(warnings.length, 1)
    assert.match(warnings[0], new RegExp(userId))
    assert.match(warnings[0], new RegExp(expected))
  }
})

test('不含大写英文字母的 userId 保持原值且不警告', async () => {
  const { normalizeLoginOptions } = await loadNormalizer()
  assert.equal(typeof normalizeLoginOptions, 'function')

  const cases = ['user123', '', '用户_123']
  for (const userId of cases) {
    const warnings = []
    const result = normalizeLoginOptions({ userId, token: 'server-token' }, (message) => warnings.push(message))
    assert.deepEqual(result, { userId, token: 'server-token' })
    assert.deepEqual(warnings, [])
  }
})
