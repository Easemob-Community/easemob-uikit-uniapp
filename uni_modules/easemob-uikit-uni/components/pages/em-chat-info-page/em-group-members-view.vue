<template>
  <!-- 成员管理视图：chat-info 页内全屏覆盖层（页内视图切换，不碰路由），back 回主视图；
       z-index 低于弹层基准 2000（action-sheet/select-contact 等 em-popup 族恒在其上） -->
  <view :class="ns.b()">
    <!-- 标题栏：复用 em-nav-bar（状态栏/胶囊避让内置），back 回主视图；覆盖层全屏盖住主视图导航栏，恒单 header -->
    <em-nav-bar :title="navTitle" @back="emit('back')" />

    <em-search-bar v-model="keyword" :placeholder="t('group.memberSearchPlaceholder')" />

    <scroll-view :class="ns.e('scroll')" scroll-y @scrolltolower="onScrollToLower">
      <em-empty
        v-if="!initialLoading && displayMembers.length === 0"
        :icon="keyword.trim() !== '' ? 'search' : 'person-double'"
        :description="keyword.trim() !== '' ? t('group.memberNoResult') : t('group.memberEmpty')"
      />

      <!-- 成员行：头像 + 展示名（单行省略）+ 角色角标（owner 蓝/admin 橙实底白字，对齐 vue member-list-item）；右侧更多开操作菜单 -->
      <view v-for="m in displayMembers" :key="m.userId" :class="ns.e('item')">
        <em-avatar :src="memberAvatar(m)" :name="memberName(m)" :size="40" />
        <view :class="ns.e('item-main')">
          <em-text :text="memberName(m)" :text-class="ns.e('name')" :text-style="nameTextStyle" :class="ns.e('name-host')" />
          <text v-if="m.role === GROUP_MEMBER_ROLE.OWNER" :class="[ns.e('role'), ns.m('role-owner')]">{{ t('group.role.owner') }}</text>
          <text v-else-if="m.role === GROUP_MEMBER_ROLE.ADMIN" :class="[ns.e('role'), ns.m('role-admin')]">{{ t('group.role.admin') }}</text>
        </view>
        <view v-if="hasActions(m)" :class="ns.e('more')" @click="onOpenActions(m)">
          <EmIcon name="vertical" :size="16" :class="ns.e('more-icon')" />
        </view>
      </view>

      <!-- 游标翻页：按钮式为主（对齐 vue group-member-list 自持 cursor 模式），scrolltolower 同入口兜底；搜索态隐藏 -->
      <em-load-more v-if="keyword.trim() === '' && displayMembers.length > 0" :state="loadMoreState" @load="onLoadMore" />
    </scroll-view>

    <!-- 成员操作菜单：按角色权限动态生成（页面根级弹层，不进 scroll-view） -->
    <em-action-sheet
      :visible="sheetVisible"
      :actions="memberActions"
      :title="activeMemberName"
      @select="onAction"
      @update:visible="sheetVisible = $event"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import EmActionSheet from '../../em-action-sheet/em-action-sheet.vue'
import EmAvatar from '../../em-avatar/em-avatar.vue'
import EmEmpty from '../../em-empty/em-empty.vue'
import EmIcon from '../../em-icon/em-icon.vue'
import EmLoadMore from '../../em-load-more/em-load-more.vue'
import EmNavBar from '../../em-nav-bar/em-nav-bar.vue'
import EmSearchBar from '../../em-search-bar/em-search-bar.vue'
import EmText from '../../em-text/em-text.vue'
import { EmKit } from '../../../libs'
import { GROUP_MEMBER_ACTION, GROUP_MEMBER_ROLE, LOAD_MORE_STATE } from '../../../libs/constants'
import type { LoadMoreStateValue } from '../../../libs/constants'
import { connectionStore } from '../../../libs/store/connection'
import { groupMemberDisplayNameOf, groupStore, sortGroupMembers } from '../../../libs/store/group'
import { avatarOf } from '../../../libs/store/user'
import { TEXT_STYLE_NAME } from '../../../libs/style/textStyles'
import type { EmActionSheetAction, EmGroupMember } from '../../../libs/types'
import { useNamespace } from '../../../libs/use/useNamespace'
import { useLocale } from '../../../libs/use/useLocale'

// chat-info 群分支成员管理视图（页面级内聚拆分，与 em-group-info-blocks 同目录显式 import）：
// 全量成员列表（owner>admin>joinedAt 排序 + 角色角标 + 搜索过滤）+ 按钮式游标翻页 +
// 成员操作菜单（私聊/设撤管理员/转让群主/移出群聊，按角色权限动态生成）。
// 数据直读 groupStore（与宿主页面同源），操作经 EmKit 群域写方法（成功内部回写 store）。
defineOptions({ styleIsolation: 'app-and-page' })

interface Props {
  groupId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  // 回主视图（页内视图切换，不碰路由）
  (e: 'back'): void
  // 私聊意图：宿主接线发起单聊（addConversation + 跳聊天页）
  (e: 'chat-member', userId: string): void
}>()

const ns = useNamespace('group-members-view')
const { t } = useLocale()

const nameTextStyle = TEXT_STYLE_NAME

// ========== 成员列表（排序 + 搜索过滤） ==========

const keyword = ref('')
const initialLoading = ref(false)

const members = computed(() => groupStore.memberMapByGroupId[props.groupId] ?? [])

const memberCount = computed(() => {
  const info = groupStore.infoByGroupId[props.groupId]
  if (info != null) return info.memberCount
  return members.value.length
})

// 导航标题：「群成员 (N)」（对齐 vue group-member-list header 的标题 + 计数语义）
const navTitle = computed(() => `${t('group.members')} (${memberCount.value})`)

// 展示序：owner > admin > joinedAt（复用 sortGroupMembers，不改 store 原顺序——分页 append 依赖原顺序）
const displayMembers = computed<EmGroupMember[]>(() => {
  const sorted = sortGroupMembers(members.value)
  const kw = keyword.value.trim().toLowerCase()
  if (kw === '') return sorted
  return sorted.filter((m) =>
    memberName(m).toLowerCase().includes(kw) || m.userId.toLowerCase().includes(kw)
  )
})

function memberName(m: EmGroupMember): string {
  return groupMemberDisplayNameOf(props.groupId, m.userId)
}

function memberAvatar(m: EmGroupMember): string {
  return m.avatar ?? avatarOf(m.userId)
}

// 首屏：无缓存时拉第一页（enterGroup 预热通常已就位，此处兜底）
onMounted(() => {
  if (groupStore.memberMapByGroupId[props.groupId] == null) {
    initialLoading.value = true
    EmKit.getGroupMemberList(props.groupId)
      .catch(() => {
        uni.showToast({ title: t('group.memberLoadFailed'), icon: 'none' })
      })
      .finally(() => {
        initialLoading.value = false
      })
  }
})

// ========== 游标翻页（domain 内部回写 store 游标/hasMore，这里只维护 loading 锁） ==========

const loadingMore = ref(false)
const hasMore = computed(() => groupStore.memberHasMoreByGroupId[props.groupId] === true)

const loadMoreState = computed<LoadMoreStateValue>(() => {
  if (loadingMore.value) return LOAD_MORE_STATE.LOADING
  return hasMore.value ? LOAD_MORE_STATE.BUTTON : LOAD_MORE_STATE.NO_MORE
})

function onScrollToLower(): void {
  onLoadMore()
}

function onLoadMore(): void {
  if (loadingMore.value || !hasMore.value) return
  loadingMore.value = true
  EmKit.getGroupMemberList(props.groupId, groupStore.memberCursorByGroupId[props.groupId])
    .catch(() => {
      uni.showToast({ title: t('group.memberLoadFailed'), icon: 'none' })
    })
    .finally(() => {
      loadingMore.value = false
    })
}

// ========== 角色判定（memberMap 为准，owner 字段兜底，与 chat-info-page 同口径） ==========

const selfRole = computed(() =>
  members.value.find((m) => m.userId === connectionStore.userId)?.role ?? null
)
const isOwner = computed(() => {
  if (connectionStore.userId === '') return false
  if (selfRole.value === GROUP_MEMBER_ROLE.OWNER) return true
  return groupStore.infoByGroupId[props.groupId]?.owner === connectionStore.userId
})
const isAdmin = computed(() => selfRole.value === GROUP_MEMBER_ROLE.ADMIN)

// ========== 成员操作菜单（em-action-sheet，按角色权限动态生成） ==========

const sheetVisible = ref(false)
const activeMember = ref<EmGroupMember | null>(null)

const activeMemberName = computed(() => (activeMember.value != null ? memberName(activeMember.value) : ''))

// 权限矩阵（对齐 vue group-member-list-item 裁剪：禁言/拉黑不在一期）：
// 任意角色对非自己可私聊；owner 对 admin/member 可设/撤管理员、转让群主、移出群聊；admin 对 member 可移出群聊
function actionsOf(m: EmGroupMember): EmActionSheetAction[] {
  if (m.userId === connectionStore.userId) return []
  const actions: EmActionSheetAction[] = [
    { key: GROUP_MEMBER_ACTION.CHAT, text: t('group.memberAction.chat'), icon: 'bubble-circle' }
  ]
  if (isOwner.value) {
    if (m.role === GROUP_MEMBER_ROLE.ADMIN) {
      actions.push({ key: GROUP_MEMBER_ACTION.REMOVE_ADMIN, text: t('group.memberAction.removeAdmin'), icon: 'shield-person' })
    } else {
      actions.push({ key: GROUP_MEMBER_ACTION.SET_ADMIN, text: t('group.memberAction.setAdmin'), icon: 'shield-person' })
    }
    actions.push({ key: GROUP_MEMBER_ACTION.TRANSFER_OWNER, text: t('group.memberAction.transferOwner'), icon: 'person-arrows' })
    // 转让/移除不标 danger（vue 设计稿警示色从严，红色区仅退群/解散）
    actions.push({ key: GROUP_MEMBER_ACTION.REMOVE, text: t('group.memberAction.remove'), icon: 'person-minus' })
  } else if (isAdmin.value && m.role === GROUP_MEMBER_ROLE.MEMBER) {
    actions.push({ key: GROUP_MEMBER_ACTION.REMOVE, text: t('group.memberAction.remove'), icon: 'person-minus' })
  }
  return actions
}

function hasActions(m: EmGroupMember): boolean {
  return m.userId !== connectionStore.userId
}

const memberActions = computed<EmActionSheetAction[]>(() =>
  activeMember.value != null ? actionsOf(activeMember.value) : []
)

function onOpenActions(m: EmGroupMember): void {
  if (actionsOf(m).length === 0) return
  activeMember.value = m
  sheetVisible.value = true
}

// 群域写方法成功即回写 store（角色修正/成员移除），列表自动刷新；失败 toast
function runOp(req: () => Promise<void>): void {
  req()
    .then(() => {
      uni.showToast({ title: t('group.updateSuccess'), icon: 'success' })
    })
    .catch(() => {
      uni.showToast({ title: t('group.updateFailed'), icon: 'none' })
    })
}

function onAction(action: EmActionSheetAction): void {
  const m = activeMember.value
  if (m == null) return
  if (action.key === GROUP_MEMBER_ACTION.CHAT) {
    emit('chat-member', m.userId)
    return
  }
  if (action.key === GROUP_MEMBER_ACTION.SET_ADMIN) {
    runOp(() => EmKit.addGroupAdmin(props.groupId, m.userId))
    return
  }
  if (action.key === GROUP_MEMBER_ACTION.REMOVE_ADMIN) {
    runOp(() => EmKit.removeGroupAdmin(props.groupId, m.userId))
    return
  }
  // 转让/移出二次确认（对齐 vue leave/destroy confirm 语义）
  if (action.key === GROUP_MEMBER_ACTION.TRANSFER_OWNER) {
    uni.showModal({
      title: t('group.memberAction.transferOwner'),
      content: t('group.memberAction.transferConfirm', { name: memberName(m) }),
      success: (res) => {
        if (!res.confirm) return
        runOp(() => EmKit.changeGroupOwner(props.groupId, m.userId))
      }
    })
    return
  }
  if (action.key === GROUP_MEMBER_ACTION.REMOVE) {
    uni.showModal({
      title: t('group.memberAction.remove'),
      content: t('group.memberAction.removeConfirm', { name: memberName(m) }),
      success: (res) => {
        if (!res.confirm) return
        runOp(() => EmKit.removeGroupMembers(props.groupId, [m.userId]))
      }
    })
  }
}
</script>

<style>
@import './em-group-members-view.css';
</style>
