<template>
  <view :class="[ns.b(), themeClass]" :style="primaryColorStyle()">
    <!-- 自绘导航栏（宿主页面需配 navigationStyle:custom / App titleNView:false）：右侧「+」建群 -->
    <em-nav-bar
      :title="t('group.title')"
      action-icon="plusempty"
      @back="emit('back')"
      @action="onOpenCreate"
    />

    <em-search-bar v-model="keyword" :placeholder="t('group.searchPlaceholder')" />

    <scroll-view :class="ns.e('scroll')" scroll-y @scrolltolower="onScrollToLower">
      <!-- 群同步骨架（对齐 vue 版 group-list：8 条条目占位、35%/65% 两行） -->
      <view v-if="syncing && items.length === 0" :class="ns.e('skeleton')">
        <view v-for="index in SKELETON_COUNT" :key="index" :class="ns.e('skeleton-item')">
          <em-skeleton variant="avatar" shape="rounded" width="48px" height="48px" />
          <view :class="ns.e('skeleton-lines')">
            <em-skeleton :width="SKELETON_LINE_WIDTHS[0]" />
            <em-skeleton :width="SKELETON_LINE_WIDTHS[1]" :class="ns.e('skeleton-line-sub')" />
          </view>
        </view>
      </view>
      <em-empty
        v-else-if="items.length === 0"
        icon="chatboxes"
        :description="keyword.trim() !== '' ? t('group.noSearchResult') : t('group.empty')"
      />

      <!-- 群条目：头像 + 群名 + 人数 meta（对齐 vue 版 group-item-default 排版） -->
      <view
        v-for="entry in items"
        :key="entry.group.groupId"
        :class="ns.e('item')"
        @click="emit('click-group', entry.group.groupId)"
      >
        <em-avatar :src="entry.avatar" :name="entry.name" :size="48" shape="square" />
        <em-text :text="entry.name" :text-class="ns.e('name')" :text-style="nameTextStyle" :class="ns.e('name-host')" />
        <text v-if="entry.group.memberCount > 0" :class="ns.e('count')">{{ entry.group.memberCount }}</text>
      </view>

      <!-- 触底加载 footer：SDK 本地全量返回，hasMore 恒 false（契约预留，恒不触发加载） -->
      <em-load-more v-if="items.length > 0" :state="loadMoreState" @load="onLoadMore" />
    </scroll-view>

    <!-- 建群弹层（控制器裁定落在本组件内）：em-select-contact multiple + #panel-top 注入群名/开关表单
         （对齐 vue create-group-modal = contact-transfer-modal + panel-top 的移动端形态） -->
    <em-select-contact
      :items="contactItems"
      :show="createVisible"
      :select-mode="SELECT_CONTACT_MODE.MULTIPLE"
      :title="t('conversation.menu.createGroup')"
      @update:show="createVisible = $event"
      @confirm="onCreateConfirm"
    >
      <template #panel-top>
        <view :class="ns.e('form')">
          <input
            :class="ns.e('name-input')"
            v-model="createName"
            :placeholder="t('group.createNamePlaceholder')"
            :maxlength="GROUP_NAME_MAX_LENGTH"
          />
          <view :class="ns.e('switch-row')" @click="createPublic = !createPublic">
            <text :class="ns.e('switch-label')">{{ t('group.createPublic') }}</text>
            <view :class="switchClass(createPublic)">
              <view :class="ns.e('switch-thumb')" />
            </view>
          </view>
          <view :class="ns.e('switch-row')" @click="createAllowInvites = !createAllowInvites">
            <text :class="ns.e('switch-label')">{{ t('group.createAllowInvites') }}</text>
            <view :class="switchClass(createAllowInvites)">
              <view :class="ns.e('switch-thumb')" />
            </view>
          </view>
        </view>
      </template>
    </em-select-contact>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import EmAvatar from '../../em-avatar/em-avatar.vue'
import EmEmpty from '../../em-empty/em-empty.vue'
import EmLoadMore from '../../em-load-more/em-load-more.vue'
import EmNavBar from '../../em-nav-bar/em-nav-bar.vue'
import EmSearchBar from '../../em-search-bar/em-search-bar.vue'
import EmSelectContact from '../../em-select-contact/em-select-contact.vue'
import EmSkeleton from '../../em-skeleton/em-skeleton.vue'
import EmText from '../../em-text/em-text.vue'
import { EmKit } from '../../../libs'
import { CONVERSATION_TYPE, GROUP_NAME_MAX_LENGTH, LOAD_MORE_STATE, SELECT_CONTACT_MODE } from '../../../libs/constants'
import { groupDisplayNameOf, groupStore } from '../../../libs/store/group'
import { contactDisplayNameOf, contactStore } from '../../../libs/store/contact'
import { primaryColorStyle } from '../../../libs/store/config'
import { avatarOf } from '../../../libs/store/user'
import { TEXT_STYLE_NAME } from '../../../libs/style/textStyles'
import type { LoadMoreStateValue } from '../../../libs/constants'
import type { EmGroup, EmSelectContactItem } from '../../../libs/types'
import { useNamespace } from '../../../libs/use/useNamespace'
import { useTheme } from '../../../libs/use/useTheme'
import { useLocale } from '../../../libs/use/useLocale'

defineOptions({ styleIsolation: 'app-and-page' })

const emit = defineEmits<{
  (e: 'click-group', groupId: string): void
  (e: 'back'): void
}>()

const ns = useNamespace('group-page')
const { themeClass } = useTheme()
const { t } = useLocale()

const nameTextStyle = TEXT_STYLE_NAME

const syncing = computed(() => groupStore.syncing)
const keyword = ref('')

// 群同步骨架：条数与行宽对齐 vue 版 group-list（8 条、35%/65% 两行）
const SKELETON_COUNT = 8
const SKELETON_LINE_WIDTHS = ['35%', '65%']

interface Entry {
  group: EmGroup
  name: string
  avatar: string
}

// 名称回落链：groupDisplayNameOf（infoByGroupId 响应式回填）> item.name > groupId；
// 群头像缺失走 em-avatar 文字占位（图标纪律禁 svg/png 默认群头像）；
// 搜索：本地过滤群名 / 群 ID（SDK 本地全量，无服务端搜索）
const items = computed<Entry[]>(() => {
  const kw = keyword.value.trim().toLowerCase()
  return groupStore.items
    .map((group) => {
      const displayName = groupDisplayNameOf(group.groupId)
      const name = displayName !== group.groupId ? displayName : (group.name !== '' ? group.name : group.groupId)
      return { group, name, avatar: group.avatar ?? '' }
    })
    .filter((entry) => {
      if (kw === '') return true
      return entry.name.toLowerCase().includes(kw) || entry.group.groupId.toLowerCase().includes(kw)
    })
})

// 触底加载契约预留：joined 群列表为 SDK 本地全量，hasMore 恒 false；
// 后续若接服务端分页，hasMore/loading 双锁在消费方（见 em-load-more 注释）
const hasMore = false
const loadingMore = ref(false)
const loadMoreState = computed<LoadMoreStateValue>(() => {
  if (loadingMore.value) return LOAD_MORE_STATE.LOADING
  return hasMore ? LOAD_MORE_STATE.BUTTON : LOAD_MORE_STATE.NO_MORE
})

function onScrollToLower(): void {
  if (!hasMore || loadingMore.value) return
  onLoadMore()
}

function onLoadMore(): void {
  // 预留：接入分页数据源时在此触发加载并维护 loadingMore/hasMore
}

// 进入页面刷新已加入群列表（store 驱动自动刷新，失败静默：列表仍展示内存快照）
onMounted(() => {
  EmKit.getJoinedGroups().catch(() => {})
})

// ===== 建群弹层 =====
const createVisible = ref(false)
const createName = ref('')
const createPublic = ref(false)
const createAllowInvites = ref(false)
const creating = ref(false)

// 选人数据源：联系人展示名走 remark > nickname > userId 回落链（与 em-conversation-page 同口径）
const contactItems = computed<EmSelectContactItem[]>(() =>
  contactStore.items.map((c) => ({
    userId: c.userId,
    name: contactDisplayNameOf(c.userId),
    avatar: c.avatarUrl !== '' ? c.avatarUrl : avatarOf(c.userId)
  }))
)

function switchClass(on: boolean): string {
  return [ns.e('switch'), on ? 'em-group-page__switch--on' : ''].join(' ').trim()
}

function onOpenCreate(): void {
  createName.value = ''
  createPublic.value = false
  createAllowInvites.value = false
  createVisible.value = true
}

// 建群确认：群名必填校验 → EmKit.createGroup（成功即 upsert 群 store，列表自动刷新）→
// 本地构造群会话（对齐 vue create-group-modal 的 addConversation）+ 成功 toast；
// confirm 不自动关窗，成功才关（失败保留已选与表单）
async function onCreateConfirm(userIds: string[]): Promise<void> {
  const name = createName.value.trim()
  if (name === '') {
    uni.showToast({ title: t('group.createNameRequired'), icon: 'none' })
    return
  }
  if (creating.value) return
  creating.value = true
  try {
    const groupId = await EmKit.createGroup({
      name,
      members: userIds,
      public: createPublic.value,
      allowInvites: createAllowInvites.value
    })
    EmKit.addConversation(groupId, CONVERSATION_TYPE.GROUP_CHAT)
    // 建群成功系统通知（本地灰条，不发服务端；对齐 vue groupCreated 通知时机）
    EmKit.insertGroupNotice(groupId, t('group.notice.groupCreated'))
    createVisible.value = false
    uni.showToast({ title: t('group.createSuccess'), icon: 'none' })
  } catch (e) {
    uni.showToast({ title: t('group.createFailed'), icon: 'none' })
  } finally {
    creating.value = false
  }
}
</script>

<style>
@import './em-group-page.css';
</style>
