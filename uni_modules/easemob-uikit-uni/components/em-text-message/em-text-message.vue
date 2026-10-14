<template>
  <view :class="[ns.b(), message.self ? 'em-text-message--self' : '']" @longpress="onLongpress">
    <text :class="[ns.e('text'), message.self ? 'em-text-message__text--self' : '']">{{ message.text }}</text>
  </view>
</template>

<script setup lang="ts">
import type { EmMessageItem } from '../../libs/types'
import { useNamespace } from '../../libs/use/useNamespace'

interface Props {
  message: EmMessageItem
}

const props = defineProps<Props>()

defineOptions({ styleIsolation: 'app-and-page', virtualHost: true })

const emit = defineEmits<{
  (e: 'long-press', message: EmMessageItem): void
}>()

const ns = useNamespace('text-message')

function onLongpress(): void {
  emit('long-press', props.message)
}
</script>

<style>
@import '../../libs/style/variables.css';

.em-text-message {
  background-color: var(--em-bubble-bg-other);
  border-radius: var(--em-bubble-radius);
  padding: 12px 14px;
  max-width: 100%;
}

.em-text-message--self {
  background-color: var(--em-bubble-bg-self);
}

.em-text-message__text {
  font-size: var(--em-font-size-15);
  line-height: var(--em-lineheight-normal);
  color: var(--em-bubble-text-other);
  /* 长内容换行：对齐 vue 版 overflow-wrap: break-word 的语义，ucss 下用 word-break 兜底 */
  word-break: break-all;
}

.em-text-message__text--self {
  color: var(--em-bubble-text-self);
}
</style>
