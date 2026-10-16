<template>
  <view :class="[ns.b(), themeClass]" :style="primaryColorStyle()">
    <!-- 自绘导航栏（pages.json 配 navigationStyle:custom / App titleNView:false），胶囊避让内置于 em-nav-bar -->
    <em-nav-bar :title="t('chat.info.title')" @back="emit('back')" />

    <scroll-view :class="ns.e('scroll')" scroll-y>
      <!-- 单聊分支：对方信息条（对齐 vue 版成员 strip 的单聊形态：48px 头像 + 昵称 + userId） -->
      <view v-if="!isGroupChat" :class="ns.e('profile')">
        <em-avatar :src="avatar" :name="displayName" :size="48" />
        <view :class="ns.e('profile-main')">
          <text :class="ns.e('profile-name')">{{ displayName }}</text>
          <text :class="ns.e('profile-id')">{{ conversationId }}</text>
        </view>
      </view>

      <!-- 群分支：成员宫格 + 群名称 + 群公告字段行（纯展示子组件；编辑弹层在页面根级） -->
      <em-group-info-blocks
        v-else
        :group-id="conversationId"
        :is-owner="isOwner"
        :is-admin="isAdmin"
        :show-member-grid="showMemberGrid"
        :show-group-name="showGroupName"
        :show-announcement="showAnnouncement"
        @invite="onInvite"
        @remove="onRemove"
        @open-members="onOpenMembers"
        @edit-name="nameEditShow = true"
        @show-announcement="announcementShow = true"
      />

      <!-- 设置 cell 组（52px 行高 + 发丝分隔线，对齐 vue 版 EmCell compact） -->
      <view :class="ns.e('group')">
        <view :class="ns.e('cell')">
          <text :class="ns.e('cell-label')">{{ t('chat.info.conversationMute') }}</text>
          <switch :checked="muted" @change="onMuteChange" color="var(--em-primary-color)" />
        </view>
        <view :class="[ns.e('cell'), ns.m('cell-last')]">
          <text :class="ns.e('cell-label')">{{ t('chat.info.conversationPin') }}</text>
          <switch :checked="pinned" @change="onPinChange" color="var(--em-primary-color)" />
        </view>
      </view>

      <!-- footer 胶囊按钮（em-button pill+block，对齐 vue 版：42px 高、圆角 999、灰底、15px/500） -->
      <view :class="ns.e('footer')">
        <em-button :text="t('chat.info.clearHistory')" pill block :class="ns.e('footer-btn')" @click="onClearHistory" />
        <em-button :text="t('chat.info.deleteConversation')" pill block :class="ns.e('footer-btn')" @click="onDelete" />
        <!-- 群分支红色区：成员「退出群聊」/ owner「解散群聊」（danger = 灰底红字档） -->
        <em-button
          v-if="isGroupChat"
          :text="isOwner ? t('group.destroy') : t('group.leave')"
          type="danger"
          pill
          block
          :class="ns.e('footer-btn')"
          @click="onLeaveOrDestroy"
        />
      </view>
    </scroll-view>

    <!-- 群名称/群公告编辑弹层（弹层组件挂页面根级，不进 scroll-view） -->
    <em-group-field-dialog
      v-if="isGroupChat"
      :group-id="conversationId"
      :is-owner="isOwner"
      :is-admin="isAdmin"
      v-model:name-edit-show="nameEditShow"
      v-model:announcement-show="announcementShow"
    />

    <!-- 成员管理视图：页内全屏覆盖层（页内 view 切换，不碰路由），back 回主视图 -->
    <em-group-members-view
      v-if="isGroupChat && membersVisible"
      :group-id="conversationId"
      @back="membersVisible = false"
      @chat-member="emit('chat-member', $event)"
    />

    <!-- 邀请入群弹层（库内闭环）：multiple 选人，disabledIds = 已在群成员；成功 toast + 重拉成员首屏兜底 -->
    <em-select-contact
      v-if="isGroupChat"
      :items="inviteItems"
      :show="inviteVisible"
      :select-mode="SELECT_CONTACT_MODE.MULTIPLE"
      :disabled-ids="memberIds"
      :title="t('group.invite')"
      @update:show="inviteVisible = $event"
      @confirm="onInviteConfirm"
    />

    <!-- 移除成员弹层（库内闭环，对齐 vue member-remove-modal）：multiple 选人，候选 = 群成员（排除自己与群主） -->
    <em-select-contact
      v-if="isGroupChat"
      :items="removeItems"
      :show="removeVisible"
      :select-mode="SELECT_CONTACT_MODE.MULTIPLE"
      :title="t('group.memberList.remove')"
      @update:show="removeVisible = $event"
      @confirm="onRemoveConfirm"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import EmAvatar from '../../em-avatar/em-avatar.vue'
import EmButton from '../../em-button/em-button.vue'
import EmNavBar from '../../em-nav-bar/em-nav-bar.vue'
import EmGroupInfoBlocks from './em-group-info-blocks.vue'
import EmGroupFieldDialog from './em-group-field-dialog.vue'
import EmGroupMembersView from './em-group-members-view.vue'
import EmSelectContact from '../../em-select-contact/em-select-contact.vue'
import { EmKit } from '../../../libs'
import { CONVERSATION_TYPE, GROUP_MEMBER_ROLE, SELECT_CONTACT_MODE } from '../../../libs/constants'
import type { ConversationTypeValue } from '../../../libs/constants'
import { conversationStore } from '../../../libs/store/conversation'
import { primaryColorStyle } from '../../../libs/store/config'
import { connectionStore } from '../../../libs/store/connection'
import { groupDisplayNameOf, groupMemberDisplayNameOf, groupStore } from '../../../libs/store/group'
import { contactDisplayNameOf, contactStore } from '../../../libs/store/contact'
import { avatarOf, displayNameOf } from '../../../libs/store/user'
import type { EmSelectContactItem } from '../../../libs/types'
import { useNamespace } from '../../../libs/use/useNamespace'
import { useTheme } from '../../../libs/use/useTheme'
import { useLocale } from '../../../libs/use/useLocale'

defineOptions({ styleIsolation: 'app-and-page' })

interface Props {
  conversationId: string
  /** 会话类型（M2.9 Phase 2 起必传，breaking）：单聊/群聊分支分流 */
  chatType: ConversationTypeValue
  /** 群分支成员宫格显隐（仅群聊生效，伪装预留），默认 true */
  showMemberGrid?: boolean
  /** 群分支群名称字段行显隐（仅群聊生效，伪装预留），默认 true */
  showGroupName?: boolean
  /** 群分支群公告字段行显隐（仅群聊生效，伪装预留），默认 true */
  showAnnouncement?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showMemberGrid: true,
  showGroupName: true,
  showAnnouncement: true
})

const emit = defineEmits<{
  // 返回上一页（宿主页面负责 navigateBack，与 em-contact-list-page 同约定）
  (e: 'back'): void
  // 删除会话成功（宿主页面负责 navigateBack 退场）
  (e: 'deleted', conversationId: string): void
  // 退群/解散成功（内部已删会话清消息，宿主负责退场，与 deleted 同处理）
  (e: 'leaved', conversationId: string): void
  // 邀请入群（库内已闭环弹层 + 邀请写操作，事件仅通知宿主）
  (e: 'invite', groupId: string): void
  // 移除成员（库内已闭环选人弹层 + 移除写操作，事件仅通知宿主）
  (e: 'remove-members', groupId: string): void
  // 成员管理视图已打开（库内页内视图切换，事件仅通知宿主）
  (e: 'open-members', groupId: string): void
  // 成员私聊意图（宿主接线发起单聊：addConversation + 跳聊天页）
  (e: 'chat-member', userId: string): void
}>()

const ns = useNamespace('chat-info-page')
const { themeClass } = useTheme()
const { t } = useLocale()

const conv = computed(() => conversationStore.items.find((c) => c.conversationId === props.conversationId) ?? null)
// 会话类型以路由 prop 为准（与会话列表/聊天页同一来源）
const chatType = computed(() => props.chatType)
const isGroupChat = computed(() => props.chatType === CONVERSATION_TYPE.GROUP_CHAT)
const displayName = computed(() =>
  isGroupChat.value
    ? groupDisplayNameOf(props.conversationId)
    : displayNameOf(props.conversationId, conv.value?.name ?? '')
)
const avatar = computed(() => {
  if (isGroupChat.value) {
    return groupStore.infoByGroupId[props.conversationId]?.avatar ?? conv.value?.avatar ?? ''
  }
  const a = avatarOf(props.conversationId)
  return a !== '' ? a : (conv.value?.avatar ?? '')
})

// 开关本地态：初值取会话 store，切换走乐观更新 + 失败回滚
const muted = ref(false)
const pinned = ref(false)

// 群字段弹层显隐（编辑/保存逻辑在 em-group-field-dialog 内）
const nameEditShow = ref(false)
const announcementShow = ref(false)

// ========== 成员管理视图（页内 view 切换，不碰路由） ==========
const membersVisible = ref(false)

function onOpenMembers(groupId: string): void {
  membersVisible.value = true
  emit('open-members', groupId)
}

// ========== 邀请入群（库内闭环：em-select-contact multiple + EmKit.inviteUsersToGroup） ==========
const inviteVisible = ref(false)

function onInvite(groupId: string): void {
  inviteVisible.value = true
  emit('invite', groupId)
}

// 候选联系人：展示名走 remark > nickname > userId 回落链（与 em-group-page 建群弹层同口径）
const inviteItems = computed<EmSelectContactItem[]>(() =>
  contactStore.items.map((c) => ({
    userId: c.userId,
    name: contactDisplayNameOf(c.userId),
    avatar: c.avatarUrl !== '' ? c.avatarUrl : avatarOf(c.userId)
  }))
)

// 已在群成员置灰不可选（选中后入群成功的成员仍允许从已选区移除，见 em-select-contact onToggle）
const memberIds = computed<string[]>(() =>
  (groupStore.memberMapByGroupId[props.conversationId] ?? []).map((m) => m.userId)
)

// 邀请确认：confirm 不自动关窗，成功才关（失败保留已选）；成功 toast + 重拉成员首屏兜底
// （被邀请方接受/自动入群后 onMembersJoined 事件做计数增量，成员列表重拉保证即时可见）
function onInviteConfirm(userIds: string[]): void {
  EmKit.inviteUsersToGroup(props.conversationId, userIds)
    .then(() => {
      inviteVisible.value = false
      uni.showToast({ title: t('group.inviteSuccess'), icon: 'success' })
      EmKit.getGroupMemberList(props.conversationId).catch(() => {})
    })
    .catch(() => {
      uni.showToast({ title: t('group.inviteFailed'), icon: 'none' })
    })
}

// ========== 移除成员（库内闭环：em-select-contact multiple + EmKit.removeGroupMembers） ==========
const removeVisible = ref(false)

function onRemove(groupId: string): void {
  removeVisible.value = true
  emit('remove-members', groupId)
}

// 候选成员：排除自己与群主（群主不可被移除）；展示名/头像与成员视图同口径
const removeItems = computed<EmSelectContactItem[]>(() => {
  const ownerId = groupStore.infoByGroupId[props.conversationId]?.owner ?? ''
  const members = groupStore.memberMapByGroupId[props.conversationId] ?? []
  return members
    .filter((m) => m.userId !== connectionStore.userId && m.userId !== ownerId)
    .map((m) => ({
      userId: m.userId,
      name: groupMemberDisplayNameOf(props.conversationId, m.userId),
      avatar: m.avatar ?? avatarOf(m.userId)
    }))
})

// 移除确认：成功才关窗（失败保留已选）；成功 toast + 重拉成员首屏兜底（SDK 回写本地 store 见 group 域）
function onRemoveConfirm(userIds: string[]): void {
  EmKit.removeGroupMembers(props.conversationId, userIds)
    .then(() => {
      removeVisible.value = false
      uni.showToast({ title: t('group.memberRemoveSuccess'), icon: 'success' })
      EmKit.getGroupMemberList(props.conversationId).catch(() => {})
    })
    .catch(() => {
      uni.showToast({ title: t('group.memberRemoveFailed'), icon: 'none' })
    })
}

// 当前用户群角色：memberMap 为准，owner 字段兜底（成员首屏未回时 owner 判定仍可用）
const selfRole = computed(() => {
  if (!isGroupChat.value) return null
  const members = groupStore.memberMapByGroupId[props.conversationId] ?? []
  return members.find((m) => m.userId === connectionStore.userId)?.role ?? null
})
const isOwner = computed(() => {
  if (!isGroupChat.value || connectionStore.userId === '') return false
  if (selfRole.value === GROUP_MEMBER_ROLE.OWNER) return true
  return groupStore.infoByGroupId[props.conversationId]?.owner === connectionStore.userId
})
const isAdmin = computed(() => selfRole.value === GROUP_MEMBER_ROLE.ADMIN)

onMounted(() => {
  muted.value = conv.value?.isMuted ?? false
  pinned.value = conv.value?.isPinned ?? false
  if (!isGroupChat.value) {
    EmKit.ensureUserInfos([props.conversationId])
  } else {
    // 群分支预热：群详情 + 成员首屏（宫格/角色判定用），公告未拉则补拉（对齐 chat-page 预热口径）
    EmKit.enterGroup(props.conversationId).catch(() => {})
    if (groupStore.announcementByGroupId[props.conversationId] === undefined) {
      EmKit.getGroupAnnouncement(props.conversationId).catch(() => {})
    }
  }
})

async function onMuteChange(e: any): Promise<void> {
  const v = e.detail.value as boolean
  const prev = muted.value
  muted.value = v
  try {
    await EmKit.setConversationMuted(props.conversationId, chatType.value, v)
  } catch (err) {
    muted.value = prev
    uni.showToast({ title: t('error.unknown'), icon: 'none' })
  }
}

async function onPinChange(e: any): Promise<void> {
  const v = e.detail.value as boolean
  const prev = pinned.value
  pinned.value = v
  try {
    await EmKit.pinConversation(props.conversationId, chatType.value, v)
  } catch (err) {
    pinned.value = prev
    uni.showToast({ title: t('error.unknown'), icon: 'none' })
  }
}

function onClearHistory(): void {
  uni.showModal({
    title: t('chat.info.clearHistory'),
    content: t('chat.info.clearHistoryConfirm'),
    success: (res) => {
      if (!res.confirm) return
      EmKit.clearConversationMessages(props.conversationId, chatType.value)
        .then(() => {
          uni.showToast({ title: t('chat.info.clearHistory'), icon: 'success' })
        })
        .catch(() => {
          uni.showToast({ title: t('error.unknown'), icon: 'none' })
        })
    }
  })
}

function onDelete(): void {
  uni.showModal({
    title: t('chat.info.deleteConversation'),
    content: t('conversation.deleteConfirm'),
    success: (res) => {
      if (!res.confirm) return
      EmKit.deleteConversation(props.conversationId, chatType.value)
        .then(() => {
          emit('deleted', props.conversationId)
        })
        .catch(() => {
          uni.showToast({ title: t('error.unknown'), icon: 'none' })
        })
    }
  })
}

// 退群/解散：二次确认 → domain 退群/解散（内部清群缓存）→ 复用删除会话链路（清消息+删会话）→ emit leaved
function onLeaveOrDestroy(): void {
  const destroy = isOwner.value
  uni.showModal({
    title: destroy ? t('group.destroy') : t('group.leave'),
    content: destroy ? t('group.destroyConfirm') : t('group.leaveConfirm'),
    success: (res) => {
      if (!res.confirm) return
      const req = destroy ? EmKit.destroyGroup(props.conversationId) : EmKit.leaveGroup(props.conversationId)
      req
        .then(() => {
          // 会话删除失败不阻断退场（群已退/已散，会话快照随下次同步收敛）
          return EmKit.deleteConversation(props.conversationId, chatType.value).catch(() => {})
        })
        .then(() => {
          uni.showToast({ title: destroy ? t('group.destroySuccess') : t('group.leaveSuccess'), icon: 'success' })
          emit('leaved', props.conversationId)
        })
        .catch(() => {
          uni.showToast({ title: destroy ? t('group.destroyFailed') : t('group.leaveFailed'), icon: 'none' })
        })
    }
  })
}
</script>

<style>
@import './em-chat-info-page.css';
</style>
