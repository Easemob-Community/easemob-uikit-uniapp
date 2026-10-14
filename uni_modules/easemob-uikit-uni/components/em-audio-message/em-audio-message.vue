<template>
  <view
    :class="[ns.b(), message.self ? 'em-audio-message--self' : '', playing ? 'em-audio-message--playing' : '']"
    :style="bubbleStyle"
    @click="onPlay"
    @longpress="onLongpress"
  >
    <EmIcon :name="playing ? 'sound-filled' : 'sound'" :size="18" :class="[ns.e('icon'), message.self ? 'em-audio-message__icon--self' : '']" />
    <text :class="[ns.e('duration'), message.self ? 'em-audio-message__duration--self' : '']">{{ durationText }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import EmIcon from '../em-icon/em-icon.vue'
import type { EmMessageItem } from '../../libs/types'
import { playAudio, stopAudio } from '../../libs/platform'
import { useNamespace } from '../../libs/use/useNamespace'
import { useLocale } from '../../libs/use/useLocale'

interface Props {
  message: EmMessageItem
}

const props = defineProps<Props>()

defineOptions({ styleIsolation: 'app-and-page', virtualHost: true })

const emit = defineEmits<{
  (e: 'long-press', message: EmMessageItem): void
}>()

const ns = useNamespace('audio-message')
const { t } = useLocale()

// 微信式宽度阶梯：随时长线性缩放，夹在 [72, 240]（对齐 vue 版 VOICE_MIN/MAX/PX_PER_SECOND）
const MIN_WIDTH = 72
const MAX_WIDTH = 240
const PX_PER_SECOND = 6

const durationSeconds = computed(() => Math.max(0, Math.round(props.message.duration)))

const bubbleStyle = computed(() => {
  const w = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, durationSeconds.value * PX_PER_SECOND))
  return `width: ${w}px;`
})

const durationText = computed(() => t('message.seconds', { seconds: durationSeconds.value }))

const playing = ref(false)

// 播放全局互斥在 platform.playAudio 内（播新停旧，旧播放经 onEnd 回调复位）
// 播放中的波形动画一期不做（ucss 多段 keyframes 成本），仅用图标/透明度区分
function onPlay(): void {
  if (playing.value) {
    stopAudio()
    return
  }
  const url = props.message.url
  if (url === '') return
  playing.value = true
  playAudio(url, () => {
    playing.value = false
  })
}

function onLongpress(): void {
  emit('long-press', props.message)
}

onUnmounted(() => {
  if (playing.value) {
    stopAudio()
  }
})
</script>

<style>
@import '../../libs/style/variables.css';

.em-audio-message {
  display: flex;
  flex-direction: row;
  align-items: center;
  background-color: var(--em-bubble-bg-other);
  border-radius: var(--em-bubble-radius);
  padding: 10px 14px;
}

.em-audio-message--self {
  background-color: var(--em-bubble-bg-self);
}

.em-audio-message--playing {
  opacity: 0.85;
}

.em-audio-message__icon {
  color: var(--em-bubble-text-other);
  margin-right: 6px;
  flex-shrink: 0;
}

.em-audio-message__icon--self {
  color: var(--em-bubble-text-self);
}

.em-audio-message__duration {
  font-size: var(--em-font-size-15);
  color: var(--em-bubble-text-other);
}

.em-audio-message__duration--self {
  color: var(--em-bubble-text-self);
}
</style>
