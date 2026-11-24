import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

test('共享建群弹层保留通知与跳转事件，但不创建会被同步覆盖的空会话', () => {
  const source = readFileSync(resolve(root, 'uni_modules/easemob-uikit-uni/components/pages/em-create-group-modal/em-create-group-modal.vue'), 'utf8')
  const flow = source.slice(source.indexOf('async function onCreateConfirm'), source.indexOf('</script>'))
  assert.doesNotMatch(flow, /EmKit\.addConversation\(/)
  assert.match(flow, /EmKit\.insertGroupNotice\(groupId,/)
  assert.match(flow, /emit\('created', groupId\)/)
})

test('会话页直接打开建群弹层，成功后以群聊类型透出 select', () => {
  const source = readFileSync(resolve(root, 'uni_modules/easemob-uikit-uni/components/pages/em-conversation-page/em-conversation-page.vue'), 'utf8')
  assert.match(source, /EmCreateGroupModal/)
  assert.match(source, /createGroupVisible\.value = true/)
  assert.match(source, /emit\('select', groupId, CONVERSATION_TYPE\.GROUP_CHAT\)/)
  assert.doesNotMatch(source, /emit\('menu'/)
})

test('demo 不再把创建群组路由到群列表', () => {
  const source = readFileSync(resolve(root, 'demo/pages/conversation/conversation.uvue'), 'utf8')
  assert.doesNotMatch(source, /@menu="onMenu"/)
  assert.doesNotMatch(source, /url: '\/sub-im\/pages\/group\/group'/)
})
