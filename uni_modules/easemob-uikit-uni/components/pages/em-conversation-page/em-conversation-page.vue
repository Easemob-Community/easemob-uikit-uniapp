<template>
  <view :class="[ns.b(), themeClass]" :style="primaryColorStyle()">
    <!-- 自绘导航栏（系统栏右上角被小程序胶囊独占，且与页内标题重复）：返回隐藏，右侧「+」发起单聊 -->
    <em-nav-bar
      :title="t('conversation.title')"
      :show-back="false"
      action-icon="circle-plus"
      @action="onOpenCreate"
    />

    <!-- 连接状态条：重连中/断开/被踢（宿主可 showConnectionBanner=false 关闭） -->
    <em-connection-banner :show="showConnectionBanner" />

    <!-- 筛选 tab（对齐 vue 版 conversation-tabs：全部/未读/@我/单聊/群组，tabs 传空数组可隐藏） -->
    <em-conversation-tabs v-if="tabs.length > 0" :tabs="tabs" :active="activeTab" @change="onTabChange" />

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
          <em-empty :icon="keyword.trim() !== '' ? 'search' : 'list-bullet'" :description="emptyTipText" />
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
        :has-at-me="entry.hasAtMe"
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
      :title="activeItem != null ? sheetTitleOf(activeItem) : ''"
      @select="onItemAction"
      @update:visible="itemSheetVisible = $event"
    />

    <!-- 发起单聊选人弹层（内置闭环：选完人 addConversation 后以 select 事件透出，宿主负责跳聊天页） -->
    <em-select-contact
      :items="contactItems"
      :show="selectContactVisible"
      @update:show="selectContactVisible = $event"
      @select="onSelectContact"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import EmNavBar from '../../em-nav-bar/em-nav-bar.vue'
import EmConnectionBanner from '../../em-connection-banner/em-connection-banner.vue'
import EmActionSheet from '../../em-action-sheet/em-action-sheet.vue'
import EmSearchBar from '../../em-search-bar/em-search-bar.vue'
import EmConversationTabs from '../../em-conversation-tabs/em-conversation-tabs.vue'
import EmConversationItem from '../../em-conversation-item/em-conversation-item.vue'
import EmEmpty from '../../em-empty/em-empty.vue'
import EmSkeleton from '../../em-skeleton/em-skeleton.vue'
import EmSelectContact from '../../em-select-contact/em-select-contact.vue'
import { EmKit } from '../../../libs'
import { CONVERSATION_MENU_KEY, CONVERSATION_TAB_KEY, CONVERSATION_TYPE, DEFAULT_CONVERSATION_TABS } from '../../../libs/constants'
import { conversationStore } from '../../../libs/store/conversation'
import { primaryColorStyle, useConfig } from '../../../libs/store/config'
import { draftStore } from '../../../libs/store/draft'
import { connectionStore } from '../../../libs/store/connection'
import { contactDisplayNameOf, contactStore } from '../../../libs/store/contact'
import { groupDisplayNameOf, groupStore } from '../../../libs/store/group'
import { avatarOf, displayNameOf } from '../../../libs/store/user'
import type { ConversationTypeValue, ConversationTabKeyValue } from '../../../libs/constants'
import type { EmActionSheetAction, EmConversationItem as EmConversationData, EmSelectContactItem } from '../../../libs/types'
import { useNamespace } from '../../../libs/use/useNamespace'
import { useTheme } from '../../../libs/use/useTheme'
import { useLocale } from '../../../libs/use/useLocale'
import { formatConversationTime } from '../../../libs/utils/time'

defineOptions({ styleIsolation: 'app-and-page' })

interface Props {
  /** 顶部搜索条显隐，默认 true */
  showSearch?: boolean
  /** 筛选 tab 及顺序（对齐 vue conversation-tabs），默认全部五项；传空数组隐藏 tab 栏 */
  tabs?: ConversationTabKeyValue[]
  /** 列表空态文案（仅空列表场景，搜索无结果仍走 searchEmpty 文案）；空串走 i18n 默认 */
  emptyText?: string
  /** 首次挂载自动拉会话快照，默认 true；宿主可关闭后自行控制同步时机 */
  autoSync?: boolean
  /** 顶部连接状态条显隐，默认 true */
  showConnectionBanner?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showSearch: true,
  tabs: () => DEFAULT_CONVERSATION_TABS,
  emptyText: '',
  autoSync: true,
  showConnectionBanner: true
})

const emit = defineEmits<{
  (e: 'select', conversationId: string, chatType: ConversationTypeValue): void
  (e: 'menu', key: string): void
}>()

const ns = useNamespace('conversation-page')
const { themeClass } = useTheme()
const { t } = useLocale()
const { config } = useConfig()

// 首次挂载自拉一次（P1-11）：宿主漏调 syncConversations 时不再出现空列表；
// 返回页面后的刷新仍建议宿主在 onShow 再调一次（组件拿不到页面级 onShow）。
onMounted(() => {
  if (!props.autoSync || connectionStore.userId === '') return
  EmKit.syncConversations().catch(() => {})
})

// 空态文案：搜索无结果 > emptyText prop > 分 tab i18n 默认（#empty 插槽整体优先于三者，见模板）
const emptyTipText = computed(() => {
  if (keyword.value.trim() !== '') return t('conversation.searchEmpty')
  return props.emptyText !== '' ? props.emptyText : tabEmptyText.value[activeTab.value] ?? t('conversation.empty')
})

const syncing = computed(() => conversationStore.syncing)
const keyword = ref('')

// 筛选 tab 激活态（页面内部状态，不透出；对齐 vue conversation-list effectiveActiveTab）
const activeTab = ref<ConversationTabKeyValue>(CONVERSATION_TAB_KEY.ALL)

function onTabChange(tab: ConversationTabKeyValue): void {
  activeTab.value = tab
}

// 分 tab 空态文案（对齐 vue 版 conversation-list tabEmptyTexts）
const tabEmptyText = computed<Record<ConversationTabKeyValue, string>>(() => ({
  [CONVERSATION_TAB_KEY.ALL]: t('conversation.empty'),
  [CONVERSATION_TAB_KEY.UNREAD]: t('conversation.emptyUnread'),
  [CONVERSATION_TAB_KEY.AT_ME]: t('conversation.emptyAtMe'),
  [CONVERSATION_TAB_KEY.SINGLE]: t('conversation.emptySingle'),
  [CONVERSATION_TAB_KEY.GROUP]: t('conversation.emptyGroup')
}))

// 首次同步骨架：条数与行宽对齐 vue 版 conversation-list（6 条、40%/70% 两行）
const SKELETON_COUNT = 6
const SKELETON_LINE_WIDTHS = ['40%', '70%']

interface Entry {
  item: EmConversationData
  name: string
  avatar: string
  draft: { text: string, time: number } | null
  timeText: string
  hasAtMe: boolean
}

// 名称回落链（对齐 vue 版 conversation-item）：
// 单聊——用户资料 nickname/avatarUrl > SDK conversation.name/avatar > conversationId；
// 群聊——群数据层 groupDisplayNameOf（拉到即回填，响应式）> SDK conversation.name > groupId；
// 群头像取群 avatar，缺失走 em-avatar 文字占位（图标纪律禁 svg/png 默认群头像）。
// 草稿优先：时间取草稿时间与最后消息时间的较大者（对齐 Web 版 displayTime 规则）
// 搜索：本地过滤名称 / 会话 ID / 摘要（一期不做服务端漫游消息搜索）
// 排序（对齐 vue 版 sortedConversationList）：置顶优先，置顶区间按置顶时间倒序；
// 非置顶按最后消息时间倒序。不能直接用 SDK 快照顺序——它会被 lastAccess/资料刷新等
// 非消息因素带动重排，导致「点进会话再回来置顶顺序变了」。sort 稳定，同时间保持原相对顺序。
function compareEntry(a: Entry, b: Entry): number {
  if (a.item.isPinned !== b.item.isPinned) return a.item.isPinned ? -1 : 1
  const aTime = a.item.isPinned && a.item.pinnedTime > 0 ? a.item.pinnedTime : a.item.lastMessageTime
  const bTime = b.item.isPinned && b.item.pinnedTime > 0 ? b.item.pinnedTime : b.item.lastMessageTime
  return bTime - aTime
}

const items = computed<Entry[]>(() => {
  const kw = keyword.value.trim().toLowerCase()
  return conversationStore.items
    .map((item) => {
      const isGroup = item.chatType === CONVERSATION_TYPE.GROUP_CHAT
      const groupName = isGroup ? groupDisplayNameOf(item.conversationId) : ''
      const name = isGroup && groupName !== item.conversationId
        ? groupName
        : displayNameOf(item.conversationId, item.name)
      const userAvatar = avatarOf(item.conversationId)
      const groupAvatar = isGroup ? (groupStore.infoByGroupId[item.conversationId]?.avatar ?? '') : ''
      const avatar = userAvatar !== '' ? userAvatar : (groupAvatar !== '' ? groupAvatar : item.avatar)
      const draft = draftStore.draftByConversationId[item.conversationId] ?? null
      const time = draft != null && draft.time > item.lastMessageTime ? draft.time : item.lastMessageTime
      const hasAtMe = conversationStore.atMeByConversationId[item.conversationId] === true
      return { item, name, avatar, draft, timeText: formatConversationTime(time), hasAtMe }
    })
    .filter((entry) => {
      // 筛选 tab 维度（对齐 vue 版 conversation-list：unread=unreadCount>0、atMe=atMeMap 命中、single/group=chatType）
      if (activeTab.value === CONVERSATION_TAB_KEY.UNREAD) return entry.item.unreadCount > 0
      if (activeTab.value === CONVERSATION_TAB_KEY.AT_ME) return entry.hasAtMe
      if (activeTab.value === CONVERSATION_TAB_KEY.SINGLE) return entry.item.chatType === CONVERSATION_TYPE.SINGLE_CHAT
      if (activeTab.value === CONVERSATION_TAB_KEY.GROUP) return entry.item.chatType === CONVERSATION_TYPE.GROUP_CHAT
      return true
    })
    .filter((entry) => {
      if (kw === '') return true
      return entry.name.toLowerCase().includes(kw)
        || entry.item.conversationId.toLowerCase().includes(kw)
        || entry.item.lastMessageText.toLowerCase().includes(kw)
    })
    .sort(compareEntry)
})

function onSelect(conversationId: string): void {
  const item = conversationStore.items.find(i => i.conversationId === conversationId)
  emit('select', conversationId, item?.chatType ?? CONVERSATION_TYPE.SINGLE_CHAT)
}

// 发起单聊选人（em-select-contact 数据装配：联系人展示名走 remark > nickname > userId 回落链）
const selectContactVisible = ref(false)

const contactItems = computed<EmSelectContactItem[]>(() =>
  contactStore.items.map((c) => ({
    userId: c.userId,
    name: contactDisplayNameOf(c.userId),
    avatar: c.avatarUrl !== '' ? c.avatarUrl : avatarOf(c.userId)
  }))
)

// 选人闭环（对齐 vue 版 new-chat-modal）：拒绝自己 → 本地构造会话（已存在不动）→ select 透出由宿主跳聊天页
function onSelectContact(userId: string): void {
  if (userId === connectionStore.userId) {
    uni.showToast({ title: t('conversation.newChatSelfError'), icon: 'none' })
    return
  }
  EmKit.addConversation(userId, CONVERSATION_TYPE.SINGLE_CHAT)
  selectContactVisible.value = false
  emit('select', userId, CONVERSATION_TYPE.SINGLE_CHAT)
}

// 右上角加号：内置 action-sheet，菜单项选择后统一以 menu 事件透出
const createSheetVisible = ref(false)
const itemSheetVisible = ref(false)
const activeItem = ref<EmConversationData | null>(null)

const createActions = computed<EmActionSheetAction[]>(() => [
  { key: CONVERSATION_MENU_KEY.NEW_CHAT, text: t('conversation.menu.newChat'), icon: 'bubble-rect-empty' },
  { key: CONVERSATION_MENU_KEY.CREATE_GROUP, text: t('conversation.menu.createGroup'), icon: 'person-double' }
])

const itemActions = computed<EmActionSheetAction[]>(() => {
  const item = activeItem.value
  if (item == null) return []
  // 候选全集按 uiConfig.conversationMenuKeys 过滤排序（默认 pin/mute/delete 全量）
  // 图标逐项对齐 vue conversation-item 右键菜单：pin/slash ↔ pin、bell ↔ bell/slash
  const candidates: EmActionSheetAction[] = [
    { key: CONVERSATION_MENU_KEY.PIN, text: item.isPinned ? t('conversation.unpin') : t('conversation.pin'), icon: item.isPinned ? 'pin-slash' : 'pin' },
    { key: CONVERSATION_MENU_KEY.MUTE, text: item.isMuted ? t('conversation.unmute') : t('conversation.mute'), icon: item.isMuted ? 'bell' : 'bell-slash' },
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
  // new-chat 内置选人闭环（em-select-contact）；create-group 本阶段直接 emit 由宿主占位（建群 Phase 4）
  if (action.key === CONVERSATION_MENU_KEY.NEW_CHAT) {
    selectContactVisible.value = true
    return
  }
  emit('menu', action.key)
}

function onLongPress(conversationId: string): void {
  activeItem.value = conversationStore.items.find(i => i.conversationId === conversationId) ?? null
  itemSheetVisible.value = true
}

// 长按菜单标题：群会话走群展示名回落链（与列表条目同名口径）
function sheetTitleOf(item: EmConversationData): string {
  if (item.chatType === CONVERSATION_TYPE.GROUP_CHAT) {
    const groupName = groupDisplayNameOf(item.conversationId)
    if (groupName !== item.conversationId) return groupName
  }
  return displayNameOf(item.conversationId, item.name)
}

async function onItemAction(action: EmActionSheetAction): Promise<void> {
  const item = activeItem.value
  if (item == null) return
  try {
    if (action.key === CONVERSATION_MENU_KEY.PIN) {
      await EmKit.pinConversation(item.conversationId, item.chatType, !item.isPinned)
    } else if (action.key === CONVERSATION_MENU_KEY.MUTE) {
      await EmKit.setConversationMuted(item.conversationId, item.chatType, !item.isMuted)
    } else if (action.key === CONVERSATION_MENU_KEY.DELETE) {
      await EmKit.deleteConversation(item.conversationId, item.chatType)
    }
  } catch (e) {
    uni.showToast({ title: t('error.unknown'), icon: 'none' })
  }
}
</script>

<style>
@import './em-conversation-page.css';
</style>
