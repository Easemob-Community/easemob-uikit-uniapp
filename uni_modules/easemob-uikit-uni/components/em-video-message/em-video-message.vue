<template>
  <view :class="[ns.b(), 'em-bubble']" :style="sizeStyle" @touchstart="onTouchStart" @click="onPlay" @longpress="onLongpress">
    <image
      v-if="message.thumbUrl !== ''"
      :class="ns.e('thumb')"
      :src="message.thumbUrl"
      mode="aspectFill"
    />
    <view v-else :class="ns.e('placeholder')"></view>
    <view :class="ns.e('overlay')">
      <view :class="ns.e('play')">
        <!-- 播放三角逐项对齐 vue video-message：Icon triangle 20 / 白色（不再用 border 手绘 / videocam 占位） -->
        <EmIcon name="triangle" :size="20" color="#ffffff" />
      </view>
    </view>
    <view v-if="message.duration > 0" :class="ns.e('duration')">
      <text :class="ns.e('duration-text')">{{ durationText }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import EmIcon from '../em-icon/em-icon.vue'
import type { EmMessageItem } from '../../libs/types'
import { useNamespace } from '../../libs/use/useNamespace'
import { useLongPressClickGuard } from '../../libs/use/useLongPressClickGuard'
import { formatVideoDuration } from '../../libs/utils/time'

interface Props {
  message: EmMessageItem
}

const props = defineProps<Props>()

defineOptions({ styleIsolation: 'app-and-page', virtualHost: true })

const emit = defineEmits<{
  (e: 'preview', message: EmMessageItem): void
  (e: 'long-press', message: EmMessageItem): void
}>()

const ns = useNamespace('video-message')
// H5 长按后仍会补发 click：吞掉长按抬手那一次 click，避免菜单与视频预览同时触发
const { onTouchStart, shouldSkipClick } = useLongPressClickGuard()

// 展示尺寸按宽高比约束在 240 内；无元数据回落 16:9 占位（对齐 vue 版，避免加载后撑高列表）
const MAX_WIDTH = 240
const MAX_HEIGHT = 240

const sizeStyle = computed(() => {
  let w = props.message.width
  let h = props.message.height
  if (w <= 0 || h <= 0) {
    return `width: ${MAX_WIDTH}px; height: 135px;`
  }
  const scale = Math.min(MAX_WIDTH / w, MAX_HEIGHT / h, 1)
  w = Math.round(w * scale)
  h = Math.round(h * scale)
  return `width: ${w}px; height: ${h}px;`
})

const durationText = computed(() => formatVideoDuration(props.message.duration))

// 点击行为纯 emit 透传（与 em-image-message 对齐）：默认播放/预览逻辑由宿主（em-chat-page 的 preview 监听）实现
function onPlay(): void {
  if (shouldSkipClick()) return
  emit('preview', props.message)
}

function onLongpress(): void {
  emit('long-press', props.message)
}
</script>

<style>
@import './em-video-message.css';
</style>
