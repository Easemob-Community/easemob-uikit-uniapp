<template>
  <!-- 通讯录入口项列表（对齐 vue 版 ContactNav）：图标 + 标题 + hot 红点 + 计数徽标 + 右箭头。
       纯呈现原子组件：不连 store、不碰路由，点击原样透出 entry key 由宿主接线 -->
  <view :class="ns.b()">
    <view
      v-for="entry in entries"
      :key="entry.key"
      :class="ns.e('item')"
      @click="emit('entry-click', entry.key)"
    >
      <EmIcon :name="entry.icon" :size="20" :class="ns.e('icon')" />
      <text :class="ns.e('label')">{{ entry.label }}</text>
      <!-- hot 红点：仅 count>0 时生效（对齐 vue 语义），数字已由计数徽标承担 -->
      <em-badge v-if="entry.hot === true && hasCount(entry)" dot :class="ns.e('dot')" />
      <view :class="ns.e('spacer')"></view>
      <em-badge v-if="hasCount(entry)" :count="entry.count ?? 0" :class="ns.e('badge')" />
      <EmIcon name="right" :size="22" :class="ns.e('arrow')" />
    </view>
  </view>
</template>

<script setup lang="ts">
import EmBadge from '../em-badge/em-badge.vue'
import EmIcon from '../em-icon/em-icon.vue'
import type { EmContactNavEntry } from '../../libs/types'
import { useNamespace } from '../../libs/use/useNamespace'

interface Props {
  /** 入口配置列表，按数组顺序展示（内置 key 见 CONTACT_ENTRY_KEY） */
  entries: EmContactNavEntry[]
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'entry-click', key: string): void
}>()

defineOptions({ styleIsolation: 'app-and-page' })

const ns = useNamespace('contact-nav')

function hasCount(entry: EmContactNavEntry): boolean {
  return entry.count != null && entry.count > 0
}
</script>

<style>
@import './em-contact-nav.css';
</style>
