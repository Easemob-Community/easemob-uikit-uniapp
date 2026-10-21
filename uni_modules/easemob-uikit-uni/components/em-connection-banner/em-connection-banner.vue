<template>
  <view v-if="visible" :class="[ns.b(), ns.m(tone)]">
    <EmIcon :name="icon" :size="14" :class="ns.e('icon')" />
    <text :class="ns.e('text')">{{ text }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import EmIcon from '../em-icon/em-icon.vue'
import type { EmIconName } from '../em-icon/em-icons'
import { CONNECTION_STATUS } from '../../libs/constants'
import { connectionStore } from '../../libs/store/connection'
import { useNamespace } from '../../libs/use/useNamespace'
import { useLocale } from '../../libs/use/useLocale'

// 连接状态条（P1-3）：重连中/首次连接/断开/被踢时在页面顶部给一条轻量提示。
// 只消费 connectionStore，不参业务；宿主可用页面级 showConnectionBanner=false 关闭。
interface Props {
  /** 是否允许展示（页面级透传），默认 true */
  show?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  show: true
})

defineOptions({ styleIsolation: 'app-and-page' })

const ns = useNamespace('connection-banner')
const { t } = useLocale()

interface BannerState {
  tone: 'warning' | 'error'
  icon: EmIconName
  text: string
}

const state = computed<BannerState | null>(() => {
  const status = connectionStore.status
  if (status === CONNECTION_STATUS.ONLINE || status === CONNECTION_STATUS.IDLE) return null
  if (status === CONNECTION_STATUS.CONNECTING) {
    return { tone: 'warning', icon: 'loading-arc-normal', text: t('status.connecting') }
  }
  if (status === CONNECTION_STATUS.RECONNECTING) {
    return { tone: 'warning', icon: 'loading-arc-normal', text: t('status.reconnecting') }
  }
  // CLOSED：按 SDK 断开原因区分被踢/Token 过期/普通网络异常
  const reason = connectionStore.reason
  if (reason === 'token-expired') {
    return { tone: 'error', icon: 'circle-bang', text: t('status.tokenExpired') }
  }
  if (reason === 'limit') {
    return { tone: 'error', icon: 'circle-bang', text: t('status.kickedDeviceLimit') }
  }
  return { tone: 'error', icon: 'circle-bang', text: t('status.networkError') }
})

const visible = computed(() => props.show && state.value != null)
const tone = computed(() => state.value?.tone ?? 'warning')
const icon = computed<EmIconName>(() => state.value?.icon ?? 'circle-bang')
const text = computed(() => state.value?.text ?? '')
</script>

<style>
@import './em-connection-banner.css';
</style>
