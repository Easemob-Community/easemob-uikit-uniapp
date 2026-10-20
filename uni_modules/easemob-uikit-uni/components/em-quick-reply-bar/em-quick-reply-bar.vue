<template>
  <!-- 快捷回复条（M2.12，P1）：输入栏上方常用语胶囊，横向滚动；纯呈现原子组件，不连 store -->
  <scroll-view :class="ns.b()" scroll-x :show-scrollbar="false">
    <view :class="ns.e('track')">
      <view
        v-for="(item, index) in items"
        :key="index"
        :class="ns.e('item')"
        @click="onSelect(item)"
      >
        <text :class="ns.e('text')">{{ item.label }}</text>
      </view>
    </view>
  </scroll-view>
</template>

<script setup lang="ts">
import type { EmQuickReply } from '../../libs/types'
import { useNamespace } from '../../libs/use/useNamespace'

// props 进、事件出：点击哪条由宿主决定填草稿还是直接发送（em-chat-page.quickReplyMode）
defineOptions({ styleIsolation: 'app-and-page' })

interface Props {
  /** 常用语列表（label 展示，text 由宿主取用；空数组不渲染内容） */
  items: EmQuickReply[]
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'select', item: EmQuickReply): void
}>()

const ns = useNamespace('quick-reply-bar')

function onSelect(item: EmQuickReply): void {
  emit('select', item)
}
</script>

<style>
@import './em-quick-reply-bar.css';
</style>
