<template>
  <view :class="[ns.b(), themeClass]" :style="primaryColorStyle()">
    <scroll-view :class="ns.e('scroll')" scroll-y>
      <!-- 对方信息条（对齐 vue 版成员 strip 的单聊形态：48px 头像 + 昵称 + userId） -->
      <view :class="ns.e('profile')">
        <em-avatar :src="avatar" :name="displayName" :size="48" />
        <view :class="ns.e('profile-main')">
          <text :class="ns.e('profile-name')">{{ displayName }}</text>
          <text :class="ns.e('profile-id')">{{ conversationId }}</text>
        </view>
      </view>

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
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import EmAvatar from '../../em-avatar/em-avatar.vue'
import EmButton from '../../em-button/em-button.vue'
import { EmKit } from '../../../libs'
import { CONVERSATION_TYPE } from '../../../libs/constants'
import { conversationStore } from '../../../libs/store/conversation'
import { primaryColorStyle } from '../../../libs/store/config'
import { avatarOf, displayNameOf } from '../../../libs/store/user'
import { useNamespace } from '../../../libs/use/useNamespace'
import { useTheme } from '../../../libs/use/useTheme'
import { useLocale } from '../../../libs/use/useLocale'

defineOptions({ styleIsolation: 'app-and-page' })

interface Props {
  conversationId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  // 删除会话成功（宿主页面负责 navigateBack 退场）
  (e: 'deleted', conversationId: string): void
}>()

const ns = useNamespace('chat-info-page')
const { themeClass } = useTheme()
const { t } = useLocale()

const conv = computed(() => conversationStore.items.find((c) => c.conversationId === props.conversationId) ?? null)
// 会话类型以会话 store 为准（群会话由群数据层建联后即为 groupChat）；未同步到时兜底单聊（现状等价）
const chatType = computed(() => conv.value?.chatType ?? CONVERSATION_TYPE.SINGLE_CHAT)
const displayName = computed(() => displayNameOf(props.conversationId, conv.value?.name ?? ''))
const avatar = computed(() => {
  const a = avatarOf(props.conversationId)
  return a !== '' ? a : (conv.value?.avatar ?? '')
})

// 开关本地态：初值取会话 store，切换走乐观更新 + 失败回滚
const muted = ref(false)
const pinned = ref(false)

onMounted(() => {
  muted.value = conv.value?.isMuted ?? false
  pinned.value = conv.value?.isPinned ?? false
  EmKit.ensureUserInfos([props.conversationId])
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
</script>

<style>
@import './em-chat-info-page.css';
</style>
