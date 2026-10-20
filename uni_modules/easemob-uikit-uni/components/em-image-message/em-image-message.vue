<template>
  <view :class="[ns.b(), 'em-bubble']" @touchstart="onTouchStart" @click="onPreview" @longpress="onLongpress">
    <image
      :class="ns.e('image')"
      :src="message.thumbUrl !== '' ? message.thumbUrl : message.url"
      mode="aspectFill"
      :style="imageStyle"
    />
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EmMessageItem } from '../../libs/types'
import { useNamespace } from '../../libs/use/useNamespace'
import { useLongPressClickGuard } from '../../libs/use/useLongPressClickGuard'

interface Props {
  message: EmMessageItem
}

const props = defineProps<Props>()

defineOptions({ styleIsolation: 'app-and-page', virtualHost: true })

const emit = defineEmits<{
  (e: 'preview', message: EmMessageItem): void
  (e: 'long-press', message: EmMessageItem): void
}>()

const ns = useNamespace('image-message')
// H5 长按后仍会补发 click：吞掉长按抬手那一次 click，避免菜单与图片预览同时触发
const { onTouchStart, shouldSkipClick } = useLongPressClickGuard()

// 气泡图尺寸：按宽高比约束在 120~200px 区间
const imageStyle = computed(() => {
  const maxW = 200
  const maxH = 200
  let w = props.message.width > 0 ? props.message.width : 120
  let h = props.message.height > 0 ? props.message.height : 160
  const scale = Math.min(maxW / w, maxH / h, 1)
  w = Math.round(w * scale)
  h = Math.round(h * scale)
  return `width: ${w}px; height: ${h}px;`
})

function onPreview(): void {
  if (shouldSkipClick()) return
  emit('preview', props.message)
}

function onLongpress(): void {
  emit('long-press', props.message)
}
</script>

<style>
@import './em-image-message.css';
</style>
