<template>
  <view :class="[ns.b(), themeClass]" :style="primaryColorStyle()">
    <!-- 自绘导航栏（系统栏右上角被小程序胶囊独占，且与页内标题重复）：返回隐藏，右侧「+」发起单聊 -->
    <em-nav-bar
      :title="t('conversation.title')"
      :show-back="false"
      action-icon="plusempty"
      @action="onOpenCreate"
    />

    <em-search-bar v-if="showSearch" v-model="keyword" :placeholder="t('conversation.searchPlaceholder')" />

    <scroll-view :class="ns.e('scroll')" scroll-y>
      <!-- 首次同步骨架（对齐 vue 版 conversation-list：替代转圈，6 条会话条目占位） -->
      <view v-if="syncing && items.length === 0" :class="ns.e('skeleton')">
        <view v-for="index in SKELETON_COUNT" :key="index" :class="ns.e('skeleton-item')">
          <em-skeleton variant="avatar" shape="rounded" width="48px" height="48px" />
          <view :class="ns.e('skeleton-lines')">
            <em-skeleton :width="SKELETON_LINE_WIDTHS[0]" />
            <em-skeleton :width="SKELETON_LINE_WIDTHS[1]" :class="ns.e('skeleton-line-sub')" />
          </view>
        </view>
      </view>
      <view v-else-if="items.length === 0">
        <slot name="empty">
          <em-empty :icon="keyword.trim() !== '' ? 'search' : 'list'" :description="emptyTipText" />
        </slot>
      </view>

      <em-conversation-item
        v-for="entry in items"
        :key="entry.item.conversationId"
        :item="entry.item"
        :name="entry.name"
        :avatar="entry.avatar"
        :time-text="entry.timeText"
        :draft="entry.draft"
        @click="onSelect"
        @long-press="onLongPress"
      />
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
import EmNavBar from '../../em-nav-bar/em-nav-bar.vue'
import EmActionSheet from '../../em-action-sheet/em-action-sheet.vue'
import EmSearchBar from '../../em-search-bar/em-search-bar.vue'
import EmConversationItem from '../../em-conversation-item/em-conversation-item.vue'
import EmEmpty from '../../em-empty/em-empty.vue'
import EmSkeleton from '../../em-skeleton/em-skeleton.vue'
import { EmKit } from '../../../libs'
import { CONVERSATION_MENU_KEY } from '../../../libs/constants'
import { conversationStore } from '../../../libs/store/conversation'
import { primaryColorStyle, useConfig } from '../../../libs/store/config'
import { draftStore } from '../../../libs/store/draft'
import { avatarOf, displayNameOf } from '../../../libs/store/user'
import type { EmActionSheetAction, EmConversationItem as EmConversationData } from '../../../libs/types'
import { useNamespace } from '../../../libs/use/useNamespace'
import { useTheme } from '../../../libs/use/useTheme'
import { useLocale } from '../../../libs/use/useLocale'
import { formatConversationTime } from '../../../libs/utils/time'

defineOptions({ styleIsolation: 'app-and-page' })

interface Props {
  /** 顶部搜索条显隐，默认 true */
  showSearch?: boolean
  /** 列表空态文案（仅空列表场景，搜索无结果仍走 searchEmpty 文案）；空串走 i18n 默认 */
  emptyText?: string
}

const props = withDefaults(defineProps<Props>(), {
  showSearch: true,
  emptyText: ''
})

const emit = defineEmits<{
  (e: 'select', conversationId: string): void
  (e: 'menu', key: string): void
}>()

const ns = useNamespace('conversation-page')
const { themeClass } = useTheme()
const { t } = useLocale()
const { config } = useConfig()

// 空态文案：搜索无结果 > emptyText prop > i18n 默认（#empty 插槽整体优先于三者，见模板）
const emptyTipText = computed(() => {
  if (keyword.value.trim() !== '') return t('conversation.searchEmpty')
  return props.emptyText !== '' ? props.emptyText : t('conversation.empty')
})

const syncing = computed(() => conversationStore.syncing)
const keyword = ref('')

// 首次同步骨架：条数与行宽对齐 vue 版 conversation-list（6 条、40%/70% 两行）
const SKELETON_COUNT = 6
const SKELETON_LINE_WIDTHS = ['40%', '70%']

interface Entry {
  item: EmConversationData
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
  return conversationStore.items
    .map((item) => {
      const name = displayNameOf(item.conversationId, item.name)
      const avatar = avatarOf(item.conversationId)
      const draft = draftStore.draftByConversationId[item.conversationId] ?? null
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

function onSelect(conversationId: string): void {
  emit('select', conversationId)
}

// 右上角加号：内置 action-sheet，菜单项选择后统一以 menu 事件透出
const createSheetVisible = ref(false)
const itemSheetVisible = ref(false)
const activeItem = ref<EmConversationData | null>(null)

const createActions = computed<EmActionSheetAction[]>(() => [
  { key: CONVERSATION_MENU_KEY.NEW_CHAT, text: t('conversation.newChat'), icon: 'chat' }
])

const itemActions = computed<EmActionSheetAction[]>(() => {
  const item = activeItem.value
  if (item == null) return []
  // 候选全集按 uiConfig.conversationMenuKeys 过滤排序（默认 pin/mute/delete 全量）
  const candidates: EmActionSheetAction[] = [
    { key: CONVERSATION_MENU_KEY.PIN, text: item.isPinned ? t('conversation.unpin') : t('conversation.pin'), icon: 'top' },
    { key: CONVERSATION_MENU_KEY.MUTE, text: item.isMuted ? t('conversation.unmute') : t('conversation.mute'), icon: 'eye-slash' },
    { key: CONVERSATION_MENU_KEY.DELETE, text: t('conversation.delete'), icon: 'trash', danger: true }
  ]
  return config.conversationMenuKeys
    .map((key) => candidates.find((a) => a.key === key))
    .filter((a): a is EmActionSheetAction => a != null)
})

function onOpenCreate(): void {
  createSheetVisible.value = true
}

function onCreateAction(action: EmActionSheetAction): void {
  emit('menu', action.key)
}

function onLongPress(conversationId: string): void {
  activeItem.value = conversationStore.items.find(i => i.conversationId === conversationId) ?? null
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
@import './em-conversation-page.css';
</style>
