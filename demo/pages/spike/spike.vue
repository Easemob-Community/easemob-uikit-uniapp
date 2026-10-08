<template>
  <view class="spike">
    <view class="spike__header">
      <text class="spike__title">环信 SDK 连通性 Spike</text>
      <text class="spike__status">连接状态：{{ statusText }}</text>
      <text class="spike__error" v-if="errorText !== ''">{{ errorText }}</text>
    </view>

    <view class="spike__form">
      <input class="spike__input" v-model="appkey" placeholder="appkey（环信控制台获取，仅开发用）" />
      <input class="spike__input" v-model="userId" placeholder="userId" />
      <input class="spike__input" v-model="token" placeholder="access token（测试 token，勿提交仓库）" />
      <view class="spike__row">
        <button class="spike__btn" :disabled="isOnline" @click="onLogin">登录</button>
        <button class="spike__btn spike__btn--plain" :disabled="!isOnline" @click="onLogout">登出</button>
      </view>
    </view>

    <scroll-view class="spike__list" scroll-y :scroll-into-view="anchorId">
      <view class="spike__msg" :class="{ 'spike__msg--self': m.self }" v-for="m in messages" :key="m.id">
        <text class="spike__msg-meta">{{ m.self ? '我' : m.from }} → {{ m.to }} · {{ formatTime(m.time) }}</text>
        <text class="spike__msg-text">{{ m.text }}</text>
      </view>
      <view :id="lastAnchor" class="spike__anchor"></view>
    </scroll-view>

    <view class="spike__send">
      <input class="spike__input" v-model="peer" placeholder="对方 userId" />
      <view class="spike__row">
        <input class="spike__input spike__input--grow" v-model="draft" placeholder="输入文本消息" confirm-type="send" @confirm="onSend" />
        <button class="spike__btn spike__btn--send" :disabled="!isOnline" @click="onSend">发送</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { EmKit } from '@/uni_modules/easemob-uikit-uni/libs'
import type { EmTextMessageItem } from '@/uni_modules/easemob-uikit-uni/libs'

const appkey = ref('')
const userId = ref('')
const token = ref('')
const peer = ref('')
const draft = ref('')
const errorText = ref('')
const messages = ref<EmTextMessageItem[]>([])
const anchorId = ref('')
const lastAnchor = 'spike-anchor'

const isOnline = computed(() => EmKit.state.status === 'online')
const statusText = computed(() => {
  switch (EmKit.state.status) {
    case 'connecting': return '连接中…'
    case 'online': return `已连接（${EmKit.state.userId}）`
    case 'closed': return '已断开'
    default: return '未登录'
  }
})

let handlerRegistered = false

function scrollToBottom() {
  anchorId.value = ''
  setTimeout(() => {
    anchorId.value = lastAnchor
  }, 50)
}

function formatTime(time: number): string {
  const d = new Date(time)
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

async function onLogin() {
  errorText.value = ''
  if (appkey.value === '' || userId.value === '' || token.value === '') {
    errorText.value = '请填写 appkey / userId / token'
    return
  }
  try {
    EmKit.init({ appkey: appkey.value })
    if (!handlerRegistered) {
      handlerRegistered = true
      EmKit.onTextMessage((msg) => {
        messages.value.push(msg)
        scrollToBottom()
      })
    }
    await EmKit.login({ userId: userId.value, token: token.value })
  } catch (e: any) {
    errorText.value = '登录失败：' + ((e?.message ?? e?.data?.message ?? JSON.stringify(e)) as string)
  }
}

async function onLogout() {
  try {
    await EmKit.logout()
  } catch (e: any) {
    errorText.value = '登出失败：' + ((e?.message ?? '') as string)
  }
}

async function onSend() {
  errorText.value = ''
  if (peer.value === '' || draft.value === '') {
    errorText.value = '请填写对方 userId 和消息内容'
    return
  }
  const text = draft.value
  try {
    await EmKit.sendText(peer.value, text)
    draft.value = ''
    scrollToBottom()
  } catch (e: any) {
    errorText.value = '发送失败：' + ((e?.message ?? e?.data?.message ?? JSON.stringify(e)) as string)
  }
}
</script>

<style>
.spike {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.spike__header {
  display: flex;
  flex-direction: column;
  padding: 12px 16px;
  background-color: #ffffff;
}

.spike__title {
  font-size: 17px;
  font-weight: 600;
  color: #1a1a1a;
}

.spike__status {
  margin-top: 6px;
  font-size: 13px;
  color: #666666;
}

.spike__error {
  margin-top: 6px;
  font-size: 13px;
  color: #e64545;
}

.spike__form {
  display: flex;
  flex-direction: column;
  padding: 12px 16px;
  background-color: #ffffff;
  margin-top: 8px;
}

.spike__input {
  height: 38px;
  padding: 0 10px;
  margin-bottom: 8px;
  border-width: 1px;
  border-style: solid;
  border-color: #dcdcdc;
  border-radius: 6px;
  font-size: 14px;
  background-color: #ffffff;
}

.spike__row {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.spike__btn {
  height: 36px;
  line-height: 36px;
  padding: 0 18px;
  margin-right: 10px;
  font-size: 14px;
  color: #ffffff;
  background-color: #1677ff;
  border-radius: 6px;
}

.spike__btn--plain {
  color: #1677ff;
  background-color: #ffffff;
  border-width: 1px;
  border-style: solid;
  border-color: #1677ff;
}

.spike__list {
  flex: 1;
  margin-top: 8px;
  padding: 12px 16px;
  background-color: #f5f5f5;
}

.spike__msg {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: 12px;
}

.spike__msg--self {
  align-items: flex-end;
}

.spike__msg-meta {
  font-size: 11px;
  color: #999999;
  margin-bottom: 4px;
}

.spike__msg-text {
  font-size: 15px;
  color: #1a1a1a;
  background-color: #ffffff;
  padding: 8px 12px;
  border-radius: 8px;
}

.spike__anchor {
  height: 1px;
}

.spike__send {
  display: flex;
  flex-direction: column;
  padding: 10px 16px;
  background-color: #ffffff;
}

.spike__input--grow {
  flex: 1;
  margin-right: 8px;
}

.spike__btn--send {
  margin-right: 0;
}
</style>
