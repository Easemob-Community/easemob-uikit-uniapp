<template>
  <view :class="ns.b()" :style="sizeStyle" @click="onPlay" @longpress="onLongpress">
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

interface Props {
  message: EmMessageItem
}

const props = defineProps<Props>()

defineOptions({ styleIsolation: 'app-and-page' })

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

const durationText = computed(() => {
  const d = Math.max(0, Math.round(props.message.duration))
  const min = Math.floor(d / 60)
  const sec = d % 60
  return `${min}:${sec < 10 ? '0' + sec : '' + sec}`
})

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
@import '../../libs/style/variables.css';

.em-video-message {
  position: relative;
  border-radius: var(--em-bubble-radius);
  overflow: hidden;
  background-color: var(--em-bubble-bg-other);
}

.em-video-message__thumb {
  width: 100%;
  height: 100%;
}

.em-video-message__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--em-bg-tertiary);
}

.em-video-message__overlay {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.em-video-message__play {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 播放三角：纯 border 绘制（em-icons 无 play 字形，ucss 兼容的 view 画法） */
.em-video-message__play-triangle {
  width: 0;
  height: 0;
  border-top-width: 7px;
  border-top-style: solid;
  border-top-color: transparent;
  border-bottom-width: 7px;
  border-bottom-style: solid;
  border-bottom-color: transparent;
  border-left-width: 12px;
  border-left-style: solid;
  border-left-color: #ffffff;
  margin-left: 3px;
}

.em-video-message__duration {
  position: absolute;
  right: 6px;
  bottom: 4px;
  padding: 1px 6px;
  border-radius: 6px;
  background-color: rgba(0, 0, 0, 0.4);
}

.em-video-message__duration-text {
  font-size: var(--em-font-size-11);
  color: #ffffff;
}
</style>
