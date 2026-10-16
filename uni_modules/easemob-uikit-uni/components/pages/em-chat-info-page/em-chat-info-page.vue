<template>
  <view :class="[ns.b(), themeClass]" :style="primaryColorStyle()">
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
        @invite="emit('invite', $event)"
        @open-members="emit('open-members', $event)"
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
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import EmAvatar from '../../em-avatar/em-avatar.vue'
import EmButton from '../../em-button/em-button.vue'
import EmGroupInfoBlocks from './em-group-info-blocks.vue'
import EmGroupFieldDialog from './em-group-field-dialog.vue'
import { EmKit } from '../../../libs'
import { CONVERSATION_TYPE, GROUP_MEMBER_ROLE } from '../../../libs/constants'
import type { ConversationTypeValue } from '../../../libs/constants'
import { conversationStore } from '../../../libs/store/conversation'
import { primaryColorStyle } from '../../../libs/store/config'
import { connectionStore } from '../../../libs/store/connection'
import { groupDisplayNameOf, groupStore } from '../../../libs/store/group'
import { avatarOf, displayNameOf } from '../../../libs/store/user'
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
  // 删除会话成功（宿主页面负责 navigateBack 退场）
  (e: 'deleted', conversationId: string): void
  // 退群/解散成功（内部已删会话清消息，宿主负责退场，与 deleted 同处理）
  (e: 'leaved', conversationId: string): void
  // 邀请入群占位（Task 9 接真）
  (e: 'invite', groupId: string): void
  // 成员管理视图占位（Task 9 接真）
  (e: 'open-members', groupId: string): void
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
