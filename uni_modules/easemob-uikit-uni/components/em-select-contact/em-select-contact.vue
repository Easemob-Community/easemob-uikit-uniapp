<template>
  <em-popup :visible="show" @update:visible="onPopupVisible">
    <view :class="ns.e('sheet')" :style="sheetStyle">
      <!-- 头部：标题 + 关闭（半屏底部弹层形态，对齐 vue 版 new-chat-modal 语义） -->
      <view :class="ns.e('header')">
        <text :class="ns.e('title')">{{ titleText }}</text>
        <view :class="ns.e('close')" @click="onClose">
          <EmIcon name="closeempty" :size="20" :class="ns.e('close-icon')" />
        </view>
      </view>
      <em-search-bar v-model="keyword" :placeholder="t('contact.searchPlaceholder')" />
      <scroll-view :class="ns.e('list')" scroll-y>
        <view
          v-for="entry in filtered"
          :key="entry.userId"
          :class="ns.e('row')"
          @click="onSelect(entry.userId)"
        >
          <em-avatar :src="entry.avatar" :name="entry.name" :size="40" />
          <em-text :text="entry.name" :text-class="ns.e('name')" :text-style="nameTextStyle" :class="ns.e('name-host')" />
        </view>
        <em-empty v-if="filtered.length === 0" icon="search" :description="t('contact.noSearchResult')" />
      </scroll-view>
    </view>
  </em-popup>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import EmAvatar from '../em-avatar/em-avatar.vue'
import EmEmpty from '../em-empty/em-empty.vue'
import EmIcon from '../em-icon/em-icon.vue'
import EmPopup from '../em-popup/em-popup.vue'
import EmSearchBar from '../em-search-bar/em-search-bar.vue'
import EmText from '../em-text/em-text.vue'
import { TEXT_STYLE_NAME } from '../../libs/style/textStyles'
import type { EmSelectContactItem } from '../../libs/types'
import { useNamespace } from '../../libs/use/useNamespace'
import { useLocale } from '../../libs/use/useLocale'

// 选人弹层原子组件（M2.9 Phase 2 先 single 模式，对齐 vue 版 new-chat-modal：单选直点、无字母导航）：
// 数据 props 进、事件 emits 出，不连 store 不碰路由；字母分组/索引/multiple 模式 Phase 4 补
interface Props {
  items: EmSelectContactItem[]   // 候选联系人（userId/展示名/avatar 由父组件装配好传入）
  show: boolean                  // 弹层显隐（v-model:show）
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'select', userId: string): void
}>()

defineOptions({ styleIsolation: 'app-and-page' })

const ns = useNamespace('select-contact')
const { t } = useLocale()

const titleText = t('conversation.newChat')
const nameTextStyle = TEXT_STYLE_NAME

// 半屏高度：按窗口高 60% 预计算（读取时刻快照，弹层存续期内不响应旋转，同 useSafeArea 口径）
const sheetStyle = `height: ${Math.round(uni.getWindowInfo().windowHeight * 0.6)}px;`

const keyword = ref('')

const filtered = computed<EmSelectContactItem[]>(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (kw === '') return props.items
  return props.items.filter((item) =>
    item.name.toLowerCase().includes(kw) || item.userId.toLowerCase().includes(kw)
  )
})

function onSelect(userId: string): void {
  emit('select', userId)
}

function onClose(): void {
  emit('update:show', false)
}

function onPopupVisible(value: boolean): void {
  if (!value) {
    keyword.value = ''
  }
  emit('update:show', value)
}
</script>

<style>
@import './em-select-contact.css';
</style>
