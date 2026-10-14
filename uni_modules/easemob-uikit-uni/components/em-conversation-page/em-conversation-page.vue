<template>
  <view :class="[ns.b(), themeClass]">
    <!-- 自绘导航栏（系统栏右上角被小程序胶囊独占，且与页内标题重复）：返回隐藏，右侧「+」发起单聊 -->
    <em-nav-bar
      :title="t('conversation.title')"
      :show-back="false"
      action-icon="plusempty"
      @action="onOpenCreate"
    />

    <view :class="ns.e('search')">
      <view :class="ns.e('search-box')">
        <EmIcon name="search" :size="16" :class="ns.e('search-icon')" />
        <input
          :class="ns.e('search-input')"
          v-model="keyword"
          :placeholder="t('conversation.searchPlaceholder')"
        />
      </view>
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
        @longpress="onLongPress(entry.item)"
      >
        <em-avatar :src="entry.avatar" :name="entry.name" :size="48" />
        <view :class="ns.e('body')">
          <view :class="ns.e('top')">
            <view :class="ns.e('name-wrap')">
              <em-text :text="entry.name" :text-class="ns.e('name')" :text-style="nameTextStyle" :class="ns.e('name-host')" />
              <!-- 置顶/免打扰徽标：em-icons 无 pin/bell-slash 字形，置顶用 top、免打扰用 eye-slash（与长按菜单图标一致），弱化图标色 -->
              <EmIcon v-if="entry.item.isPinned" name="top" :size="12" :class="ns.e('flag')" />
              <EmIcon v-if="entry.item.isMuted" name="eye-slash" :size="12" :class="ns.e('flag')" />
            </view>
            <text :class="ns.e('time')">{{ entry.timeText }}</text>
          </view>
          <view :class="ns.e('bottom')">
            <view :class="ns.e('message')">
              <text v-if="entry.draft != null" :class="ns.e('draft')">[{{ t('conversation.draft') }}]</text>
              <em-text :text="entry.draft != null ? entry.draft.text : entry.item.lastMessageText" :text-class="ns.e('summary')" :text-style="summaryTextStyle" :class="ns.e('summary-host')" />
            </view>
            <view v-if="entry.item.unreadCount > 0 && entry.item.isMuted" :class="ns.e('unread-dot')"></view>
            <view v-else-if="entry.item.unreadCount > 0" :class="ns.e('unread')">
              <text :class="ns.e('unread-text')">{{ badgeText(entry.item.unreadCount) }}</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <em-action-sheet
      :visible="createSheetVisible"
      :actions="createActions"
      @select="onCreateAction"
      @update:visible="createSheetVisible = $event"
    />
    <em-action-sheet
      :visible="itemSheetVisible"
      :actions="itemActions"
      :title="activeItem != null ? displayNameOf(activeItem.conversationId, activeItem.name) : ''"
      @select="onItemAction"
      @update:visible="itemSheetVisible = $event"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import EmAvatar from '../em-avatar/em-avatar.vue'
import EmIcon from '../em-icon/em-icon.vue'
import EmNavBar from '../em-nav-bar/em-nav-bar.vue'
import EmActionSheet from '../em-action-sheet/em-action-sheet.vue'
import { EmKit } from '../../libs'
import { CONVERSATION_MENU_KEY } from '../../libs/constants'
import { conversationStore } from '../../libs/store/conversation'
import { draftStore } from '../../libs/store/draft'
import { avatarOf, displayNameOf } from '../../libs/store/user'
import type { EmActionSheetAction, EmConversationItem } from '../../libs/types'
import { useNamespace } from '../../libs/use/useNamespace'
import { useTheme } from '../../libs/use/useTheme'
import { useLocale } from '../../libs/use/useLocale'
import { formatConversationTime } from '../../libs/utils/time'

defineOptions({ styleIsolation: 'app-and-page' })

// 文字样式内联兜底（小程序样式隔离下父组件 wxss 够不到 em-text 内部 text，须走 text-style；详见 em-text 注释）
const nameTextStyle = 'font-family: var(--em-font-family); font-size: var(--em-font-size-15); font-weight: var(--em-font-weight-semibold); line-height: 20px; color: var(--em-text-primary);'
const summaryTextStyle = 'font-family: var(--em-font-family); font-size: var(--em-font-size-13); line-height: 18px; color: var(--em-text-secondary);'

const emit = defineEmits<{
  (e: 'select', conversationId: string): void
  (e: 'menu', key: string): void
}>()

const ns = useNamespace('conversation-page')
const { themeClass } = useTheme()
const { t } = useLocale()

const syncing = computed(() => conversationStore.syncing)
const keyword = ref('')

interface Entry {
  item: EmConversationItem
  name: string
  avatar: string
  draft: { text: string, time: number } | null
  timeText: string
}

// 名称/头像回落链（对齐 vue 版 conversation-item）：用户资料 nickname/avatarUrl > SDK conversation.name/avatar > conversationId
// 草稿优先：时间取草稿时间与最后消息时间的较大者（对齐 Web 版 displayTime 规则）
// 搜索：本地过滤名称 / 会话 ID / 摘要（一期不做服务端漫游消息搜索）
const items = computed<Entry[]>(() => {
  const kw = keyword.value.trim().toLowerCase()
  return conversationStore.list
    .map((item) => {
      const name = displayNameOf(item.conversationId, item.name)
      const avatar = avatarOf(item.conversationId)
      const draft = draftStore.map[item.conversationId] ?? null
      const time = draft != null && draft.time > item.lastMessageTime ? draft.time : item.lastMessageTime
      return { item, name, avatar: avatar !== '' ? avatar : item.avatar, draft, timeText: formatConversationTime(time) }
    })
    .filter((entry) => {
      if (kw === '') return true
      return entry.name.toLowerCase().includes(kw)
        || entry.item.conversationId.toLowerCase().includes(kw)
        || entry.item.lastMessageText.toLowerCase().includes(kw)
    })
})

function badgeText(count: number): string {
  return count > 99 ? '99+' : `${count}`
}

function onSelect(item: EmConversationItem): void {
  emit('select', item.conversationId)
}

// 右上角加号：内置 action-sheet，菜单项选择后统一以 menu 事件透出
const createSheetVisible = ref(false)
const itemSheetVisible = ref(false)
const activeItem = ref<EmConversationItem | null>(null)

const createActions = computed<EmActionSheetAction[]>(() => [
  { key: CONVERSATION_MENU_KEY.NEW_CHAT, text: t('conversation.newChat'), icon: 'chat' }
])

const itemActions = computed<EmActionSheetAction[]>(() => {
  const item = activeItem.value
  if (item == null) return []
  return [
    { key: CONVERSATION_MENU_KEY.PIN, text: item.isPinned ? t('conversation.unpin') : t('conversation.pin'), icon: 'top' },
    { key: CONVERSATION_MENU_KEY.MUTE, text: item.isMuted ? t('conversation.unmute') : t('conversation.mute'), icon: 'eye-slash' },
    { key: CONVERSATION_MENU_KEY.DELETE, text: t('conversation.delete'), icon: 'trash', danger: true }
  ]
})

function onOpenCreate(): void {
  createSheetVisible.value = true
}

function onCreateAction(action: EmActionSheetAction): void {
  emit('menu', action.key)
}

function onLongPress(item: EmConversationItem): void {
  activeItem.value = item
  itemSheetVisible.value = true
}

async function onItemAction(action: EmActionSheetAction): Promise<void> {
  const item = activeItem.value
  if (item == null) return
  try {
    if (action.key === CONVERSATION_MENU_KEY.PIN) {
      await EmKit.pinConversation(item.conversationId, !item.isPinned)
    } else if (action.key === CONVERSATION_MENU_KEY.MUTE) {
      await EmKit.setConversationMuted(item.conversationId, !item.isMuted)
    } else if (action.key === CONVERSATION_MENU_KEY.DELETE) {
      await EmKit.deleteConversation(item.conversationId)
    }
  } catch (e) {
    uni.showToast({ title: t('error.unknown'), icon: 'none' })
  }
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

.em-conversation-page__scroll {
  flex: 1;
  height: 0;
}

/* 搜索槽：上下 8px、左右 16px（对齐 vue 版 search 槽口径） */
.em-conversation-page__search {
  display: flex;
  flex-direction: row;
  padding: var(--em-spacing-2) var(--em-spacing-4);
}

.em-conversation-page__search-box {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 36px;
  padding: 0 var(--em-spacing-3);
  background-color: var(--em-control-bg);
  border-radius: var(--em-input-radius);
}

.em-conversation-page__search-icon {
  color: var(--em-icon-muted);
  margin-right: 6px;
  flex-shrink: 0;
}

.em-conversation-page__search-input {
  flex: 1;
  height: 36px;
  font-size: var(--em-font-size-14);
  color: var(--em-text-primary);
  background-color: transparent;
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

/* 名称/摘要的折叠由 em-text 收口；宿主节点补 flex 约束链（小程序宿主参与 flex 布局） */
.em-conversation-page__name-host {
  flex: 1;
  min-width: 0;
}

.em-conversation-page__name {
  font-family: var(--em-font-family);
  font-size: var(--em-font-size-15);
  font-weight: var(--em-font-weight-semibold);
  line-height: 20px;
  color: var(--em-text-primary);
}

/* 置顶/免打扰图标徽标：弱化图标色（对齐 vue 版 pin-badge/mute-badge 的 --uikit-icon-muted） */
.em-conversation-page__flag {
  margin-left: var(--em-spacing-1);
  flex-shrink: 0;
  color: var(--em-icon-muted);
}

.em-conversation-page__time {
  font-family: var(--em-font-family);
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
  font-family: var(--em-font-family);
  font-size: var(--em-font-size-13);
  line-height: 18px;
  color: var(--em-danger-color);
  margin-right: 2px;
  flex-shrink: 0;
}

.em-conversation-page__summary-host {
  flex: 1;
  min-width: 0;
}

.em-conversation-page__summary {
  font-family: var(--em-font-family);
  font-size: var(--em-font-size-13);
  line-height: 18px;
  color: var(--em-text-secondary);
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
