<template>
  <view :class="[ns.b(), themeClass]">
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
          <switch :checked="muted" @change="onMuteChange" color="#009EFF" />
        </view>
        <view :class="[ns.e('cell'), 'em-chat-info-page__cell--last']">
          <text :class="ns.e('cell-label')">{{ t('chat.info.conversationPin') }}</text>
          <switch :checked="pinned" @change="onPinChange" color="#009EFF" />
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
import EmAvatar from '../em-avatar/em-avatar.vue'
import EmButton from '../em-button/em-button.vue'
import { EmKit } from '../../libs'
import { conversationStore } from '../../libs/store/conversation'
import { avatarOf, displayNameOf } from '../../libs/store/user'
import { useNamespace } from '../../libs/use/useNamespace'
import { useTheme } from '../../libs/use/useTheme'
import { useLocale } from '../../libs/use/useLocale'

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

const conv = computed(() => conversationStore.list.find((c) => c.conversationId === props.conversationId) ?? null)
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
    await EmKit.setConversationMuted(props.conversationId, v)
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
    await EmKit.pinConversation(props.conversationId, v)
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
      EmKit.clearConversationMessages(props.conversationId)
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
      EmKit.deleteConversation(props.conversationId)
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
@import '../../libs/style/variables.css';

/* 页面白底（对齐 vue 版抽屉底色）：灰底胶囊按钮需要有对比度的承载面 */
.em-chat-info-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  background-color: var(--em-bg-base);
}

.em-chat-info-page__scroll {
  flex: 1;
  height: 0;
}

.em-chat-info-page__profile {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: var(--em-spacing-4);
  background-color: var(--em-bg-base);
  border-bottom-width: 1px;
  border-bottom-style: solid;
  border-bottom-color: var(--em-divider-color);
}

.em-chat-info-page__profile-main {
  display: flex;
  flex-direction: column;
  margin-left: var(--em-spacing-3);
  min-width: 0;
}

.em-chat-info-page__profile-name {
  font-family: var(--em-font-family);
  font-size: var(--em-font-size-16);
  font-weight: var(--em-font-weight-medium);
  line-height: 22px;
  color: var(--em-text-primary);
}

.em-chat-info-page__profile-id {
  font-family: var(--em-font-family);
  font-size: var(--em-font-size-12);
  line-height: 18px;
  color: var(--em-text-tertiary);
  margin-top: 2px;
}

.em-chat-info-page__group {
  display: flex;
  flex-direction: column;
  background-color: var(--em-bg-base);
  border-bottom-width: 1px;
  border-bottom-style: solid;
  border-bottom-color: var(--em-divider-color);
}

.em-chat-info-page__cell {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 var(--em-spacing-4);
  box-sizing: border-box;
  border-bottom-width: 1px;
  border-bottom-style: solid;
  border-bottom-color: var(--em-divider-color);
}

.em-chat-info-page__cell--last {
  border-bottom-width: 0;
}

.em-chat-info-page__cell-label {
  font-family: var(--em-font-family);
  font-size: var(--em-font-size-15);
  color: var(--em-text-primary);
}

.em-chat-info-page__footer {
  display: flex;
  flex-direction: column;
  padding: var(--em-spacing-3) var(--em-spacing-4);
}

/* 按钮间距落在宿主标签（em-button 为子组件，布局 class 走宿主外部类机制） */
.em-chat-info-page__footer-btn {
  margin-top: var(--em-spacing-2);
}
</style>
