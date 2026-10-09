<template>
  <view :class="[ns.b(), themeClass]">
    <view :class="ns.e('header')">
      <text :class="ns.e('title')">{{ t('conversation.title') }}</text>
      <view :class="ns.e('add')" @click="emit('create')">
        <EmIcon name="plus" :size="16" />
      </view>
    </view>

    <view :class="ns.e('search')">
      <input
        :class="ns.e('search-input')"
        v-model="keyword"
        :placeholder="t('conversation.searchPlaceholder')"
      />
    </view>

    <scroll-view :class="ns.e('scroll')" scroll-y>
      <view v-if="syncing && items.length === 0" :class="ns.e('tip')">
        <text :class="ns.e('tip-text')">{{ t('conversation.syncing') }}</text>
      </view>
      <view v-else-if="items.length === 0" :class="ns.e('tip')">
        <text :class="ns.e('tip-text')">{{ keyword.trim() !== '' ? t('conversation.searchEmpty') : t('conversation.empty') }}</text>
      </view>

      <view
        v-for="entry in items"
        :key="entry.item.conversationId"
        :class="[ns.e('item'), entry.item.isPinned ? 'em-conversation-page__item--pinned' : '']"
        @click="onSelect(entry.item)"
      >
        <em-avatar :src="entry.item.avatar" :name="entry.item.name" :size="48" />
        <view :class="ns.e('body')">
          <view :class="ns.e('top')">
            <view :class="ns.e('name-wrap')">
              <text :class="ns.e('name')">{{ entry.item.name }}</text>
              <text v-if="entry.item.isPinned" :class="ns.e('flag')">📌</text>
              <text v-if="entry.item.isMuted" :class="ns.e('flag')">🔕</text>
            </view>
            <text :class="ns.e('time')">{{ entry.timeText }}</text>
          </view>
          <view :class="ns.e('bottom')">
            <view :class="ns.e('message')">
              <text v-if="entry.draft != null" :class="ns.e('draft')">[{{ t('conversation.draft') }}]</text>
              <text :class="ns.e('summary')">{{ entry.draft != null ? entry.draft.text : entry.item.lastMessageText }}</text>
            </view>
            <view v-if="entry.item.unreadCount > 0 && entry.item.isMuted" :class="ns.e('unread-dot')"></view>
            <view v-else-if="entry.item.unreadCount > 0" :class="ns.e('unread')">
              <text :class="ns.e('unread-text')">{{ badgeText(entry.item.unreadCount) }}</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import EmAvatar from '../em-avatar/em-avatar.vue'
import EmIcon from '../em-icon/em-icon.vue'
import { conversationStore } from '../../libs/store/conversation'
import { draftStore } from '../../libs/store/draft'
import type { EmConversationItem } from '../../libs/types'
import { useNamespace } from '../../libs/use/useNamespace'
import { useTheme } from '../../libs/use/useTheme'
import { useLocale } from '../../libs/use/useLocale'
import { formatConversationTime } from '../../libs/utils/time'

defineOptions({ styleIsolation: 'app-and-page' })

const emit = defineEmits<{
  (e: 'select', conversationId: string): void
  (e: 'create'): void
}>()

const ns = useNamespace('conversation-page')
const { themeClass } = useTheme()
const { t } = useLocale()

const syncing = computed(() => conversationStore.syncing)
const keyword = ref('')

interface Entry {
  item: EmConversationItem
  draft: { text: string, time: number } | null
  timeText: string
}

// 草稿优先：时间取草稿时间与最后消息时间的较大者（对齐 Web 版 displayTime 规则）
// 搜索：本地过滤名称 / 会话 ID / 摘要（一期不做服务端漫游消息搜索）
const items = computed<Entry[]>(() => {
  const kw = keyword.value.trim().toLowerCase()
  return conversationStore.list
    .filter((item) => {
      if (kw === '') return true
      return item.name.toLowerCase().includes(kw)
        || item.conversationId.toLowerCase().includes(kw)
        || item.lastMessageText.toLowerCase().includes(kw)
    })
    .map((item) => {
      const draft = draftStore.map[item.conversationId] ?? null
      const time = draft != null && draft.time > item.lastMessageTime ? draft.time : item.lastMessageTime
      return { item, draft, timeText: formatConversationTime(time) }
    })
})

function badgeText(count: number): string {
  return count > 99 ? '99+' : `${count}`
}

function onSelect(item: EmConversationItem): void {
  emit('select', item.conversationId)
}
</script>

<style>
@import '../../libs/style/variables.css';

.em-conversation-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  background-color: var(--em-conversation-list-bg);
}

.em-conversation-page__header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: var(--em-spacing-3) var(--em-spacing-4);
}

.em-conversation-page__title {
  font-size: var(--em-font-size-18);
  font-weight: var(--em-font-weight-semibold);
  color: var(--em-text-primary);
}

.em-conversation-page__add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border-width: 1px;
  border-style: solid;
  border-color: var(--em-border-color);
}

.em-conversation-page__scroll {
  flex: 1;
  height: 0;
}

.em-conversation-page__search {
  display: flex;
  flex-direction: row;
  padding: 0 var(--em-spacing-4) var(--em-spacing-2);
}

.em-conversation-page__search-input {
  flex: 1;
  height: 36px;
  padding: 0 var(--em-spacing-3);
  font-size: var(--em-font-size-14);
  color: var(--em-text-primary);
  background-color: var(--em-control-bg);
  border-radius: var(--em-input-radius);
}

.em-conversation-page__tip {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--em-spacing-7) var(--em-spacing-4);
}

.em-conversation-page__tip-text {
  font-size: var(--em-font-size-14);
  color: var(--em-empty-text-color);
}

.em-conversation-page__item {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: var(--em-spacing-3) var(--em-spacing-4);
  background-color: var(--em-bg-base);
}

.em-conversation-page__item--pinned {
  background-color: var(--em-bg-hover);
  border-radius: var(--em-radius);
}

.em-conversation-page__body {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 1;
  margin-left: var(--em-spacing-3);
  align-self: stretch;
  border-bottom-width: 1px;
  border-bottom-style: solid;
  border-bottom-color: var(--em-divider-color);
}

.em-conversation-page__top {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  height: 20px;
}

.em-conversation-page__name-wrap {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: 1;
}

.em-conversation-page__name {
  font-size: var(--em-font-size-15);
  font-weight: var(--em-font-weight-semibold);
  line-height: 20px;
  color: var(--em-text-primary);
  lines: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.em-conversation-page__flag {
  font-size: var(--em-font-size-12);
  margin-left: var(--em-spacing-1);
  flex-shrink: 0;
}

.em-conversation-page__time {
  font-size: var(--em-font-size-11);
  line-height: 16px;
  color: var(--em-text-tertiary);
  margin-left: var(--em-spacing-2);
  flex-shrink: 0;
}

.em-conversation-page__bottom {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  height: 18px;
  margin-top: var(--em-spacing-1);
}

.em-conversation-page__message {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: 1;
  overflow: hidden;
}

.em-conversation-page__draft {
  font-size: var(--em-font-size-13);
  line-height: 18px;
  color: var(--em-danger-color);
  margin-right: 2px;
  flex-shrink: 0;
}

.em-conversation-page__summary {
  font-size: var(--em-font-size-13);
  line-height: 18px;
  color: var(--em-text-secondary);
  lines: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.em-conversation-page__unread {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding-left: 5px;
  padding-right: 5px;
  border-radius: 9px;
  background-color: var(--em-badge-bg);
  margin-left: var(--em-spacing-2);
  flex-shrink: 0;
}

.em-conversation-page__unread-text {
  font-size: var(--em-font-size-11);
  line-height: 1;
  color: var(--em-badge-text);
}

.em-conversation-page__unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background-color: var(--em-badge-bg);
  margin-left: var(--em-spacing-2);
  flex-shrink: 0;
}
</style>
