<template>
  <view :class="[ns.b(), 'em-bubble']" :style="sizeStyle" @click="onPlay" @longpress="onLongpress">
    <image
      v-if="message.thumbUrl !== ''"
      :class="ns.e('thumb')"
      :src="message.thumbUrl"
      mode="aspectFill"
    />
    <view v-else :class="ns.e('placeholder')">
      <EmIcon name="videocam" :size="28" />
    </view>
    <view :class="ns.e('overlay')">
      <view :class="ns.e('play')">
        <view :class="ns.e('play-triangle')"></view>
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
import { useLocale } from '../../libs/use/useLocale'
import { formatVideoDuration } from '../../libs/utils/time'

interface Props {
  message: EmMessageItem
}

const props = defineProps<Props>()

defineOptions({ styleIsolation: 'app-and-page', virtualHost: true })

const emit = defineEmits<{
  (e: 'long-press', message: EmMessageItem): void
}>()

const ns = useNamespace('video-message')
const { t } = useLocale()

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

// 播放：H5 直接新窗口打开流地址；小程序/App 暂无全屏视频预览收口，toast 降级
function onPlay(): void {
  const url = props.message.url
  if (url === '') return
  // #ifdef WEB
  window.open(url, '_blank')
  // #endif
  // #ifndef WEB
  uni.showToast({ title: t('message.preview.unsupported'), icon: 'none' })
  // #endif
}

function onLongpress(): void {
  emit('long-press', props.message)
}
</script>

<style>
@import './em-video-message.css';
</style>
