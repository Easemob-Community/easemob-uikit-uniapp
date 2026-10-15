<template>
  <view :class="[ns.b(), 'em-bubble', message.self ? 'em-bubble--self' : '']" @longpress="onLongpress">
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
@import './em-text-message.css';
</style>
