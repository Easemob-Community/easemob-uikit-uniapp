<template>
  <view :class="[ns.b(), themeClass]">
    <!-- 自绘导航栏（宿主页面需配 navigationStyle:custom / App titleNView:false） -->
    <em-nav-bar :title="t('contact.newRequests')" @back="onBack" />

    <scroll-view :class="ns.e('scroll')" scroll-y>
      <view v-if="invites.length === 0" :class="ns.e('tip')">
        <text :class="ns.e('tip-text')">{{ t('contact.requests.empty') }}</text>
      </view>

      <view v-for="invite in invites" :key="invite.id" :class="ns.e('item')">
        <em-avatar :src="avatarOf(invite.from)" :name="displayNameOf(invite.from)" :size="48" />
        <view :class="ns.e('item-body')">
          <view :class="ns.e('item-main')">
            <em-text :text="displayNameOf(invite.from)" :text-class="ns.e('name')" :text-style="nameTextStyle" :class="ns.e('name-host')" />
            <em-text :text="subtitleOf(invite)" :text-class="ns.e('subtitle')" :text-style="subtitleTextStyle" :class="ns.e('subtitle-host')" />
          </view>
          <!-- pending 且收到的申请：接受/拒绝双胶囊按钮（对齐 vue 版 notice 条目操作区） -->
          <view v-if="isActionable(invite)" :class="ns.e('actions')">
            <em-button
              :text="t('contact.requests.accept')"
              type="primary"
              size="medium"
              pill
              :disabled="isProcessing(invite.id)"
              @click="onAccept(invite)"
            />
            <view :class="ns.e('action-gap')"></view>
            <em-button
              :text="t('contact.requests.decline')"
              type="outline"
              size="medium"
              pill
              :disabled="isProcessing(invite.id)"
              @click="onDecline(invite)"
            />
          </view>
          <text v-else :class="ns.e('status')">{{ statusTextOf(invite) }}</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import EmAvatar from '../em-avatar/em-avatar.vue'
import EmButton from '../em-button/em-button.vue'
import EmNavBar from '../em-nav-bar/em-nav-bar.vue'
import { EmKit } from '../../libs'
import { CONTACT_INVITE_STATUS } from '../../libs/constants'
import { contactStore } from '../../libs/store/contact'
import { avatarOf, displayNameOf } from '../../libs/store/user'
import type { EmContactInvite } from '../../libs/types'
import { useNamespace } from '../../libs/use/useNamespace'
import { useTheme } from '../../libs/use/useTheme'
import { useLocale } from '../../libs/use/useLocale'

// 好友申请列表页（对齐 vue 版 contact-notice-list 的好友申请部分）：
// 条目 = 48px 头像 + 名称 + 附言副标题；pending 态接受/拒绝双按钮，已处理态弱化状态文字
defineOptions({ styleIsolation: 'app-and-page' })

// 文字样式内联兜底（小程序样式隔离下父组件 wxss 够不到 em-text 内部 text，须走 text-style；详见 em-text 注释）
const nameTextStyle = 'font-family: var(--em-font-family); font-size: var(--em-font-size-15); font-weight: var(--em-font-weight-semibold); line-height: 20px; color: var(--em-text-primary); white-space: nowrap;'
const subtitleTextStyle = 'font-family: var(--em-font-family); font-size: var(--em-font-size-13); line-height: 18px; color: var(--em-text-secondary); white-space: nowrap;'

const ns = useNamespace('contact-requests-page')
const { themeClass } = useTheme()
const { t } = useLocale()

// 新申请 unshift 置顶，store 顺序即倒序时间序
const invites = computed<EmContactInvite[]>(() => contactStore.invites)

function subtitleOf(invite: EmContactInvite): string {
  if (invite.outgoing) return t('contact.requests.declinedByPeer')
  return invite.message !== '' ? invite.message : t('contact.requests.received')
}

function statusTextOf(invite: EmContactInvite): string {
  return invite.status === CONTACT_INVITE_STATUS.ACCEPTED
    ? t('contact.requests.accepted')
    : t('contact.requests.declined')
}

function isActionable(invite: EmContactInvite): boolean {
  return !invite.outgoing && invite.status === CONTACT_INVITE_STATUS.PENDING
}

// 处理中幂等防重（对齐 vue 版 processingIds）
const processingIds = ref<string[]>([])

function isProcessing(id: string): boolean {
  return processingIds.value.indexOf(id) >= 0
}

function onAccept(invite: EmContactInvite): void {
  if (isProcessing(invite.id)) return
  processingIds.value.push(invite.id)
  EmKit.acceptContactInvite(invite)
    .catch(() => {
      uni.showToast({ title: t('contact.requests.acceptFailed'), icon: 'none' })
    })
    .finally(() => {
      processingIds.value = processingIds.value.filter((id) => id !== invite.id)
    })
}

function onDecline(invite: EmContactInvite): void {
  if (isProcessing(invite.id)) return
  processingIds.value.push(invite.id)
  EmKit.declineContactInvite(invite)
    .catch(() => {
      uni.showToast({ title: t('contact.requests.declineFailed'), icon: 'none' })
    })
    .finally(() => {
      processingIds.value = processingIds.value.filter((id) => id !== invite.id)
    })
}

function onBack(): void {
  uni.navigateBack({ delta: 1 })
}
</script>

<style>
@import '../../libs/style/variables.css';

.em-contact-requests-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  background-color: var(--em-conversation-list-bg);
}

.em-contact-requests-page__scroll {
  flex: 1;
  height: 0;
}

.em-contact-requests-page__tip {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--em-spacing-7) var(--em-spacing-4);
}

.em-contact-requests-page__tip-text {
  font-size: var(--em-font-size-14);
  color: var(--em-empty-text-color);
}

/* 申请条目：有待处理操作的条目 min-height 96px（对齐 vue 版 actionable 行高） */
.em-contact-requests-page__item {
  display: flex;
  flex-direction: row;
  align-items: center;
  min-height: 96px;
  padding: var(--em-spacing-2) var(--em-spacing-4);
  background-color: var(--em-bg-base);
}

.em-contact-requests-page__item-body {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: 1;
  min-width: 0;
  align-self: stretch;
  margin-left: var(--em-spacing-3);
  border-bottom-width: 1px;
  border-bottom-style: solid;
  border-bottom-color: var(--em-divider-color);
}

.em-contact-requests-page__item-main {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 1;
  min-width: 0;
}

/* 名称/附言折叠由 em-text 收口；宿主节点补 min-width:0 保持 flex 约束链 */
.em-contact-requests-page__name-host {
  min-width: 0;
}

.em-contact-requests-page__name {
  font-family: var(--em-font-family);
  font-size: var(--em-font-size-15);
  font-weight: var(--em-font-weight-semibold);
  line-height: 20px;
  color: var(--em-text-primary);
}

.em-contact-requests-page__subtitle-host {
  min-width: 0;
  margin-top: var(--em-spacing-1);
}

.em-contact-requests-page__subtitle {
  font-family: var(--em-font-family);
  font-size: var(--em-font-size-13);
  line-height: 18px;
  color: var(--em-text-secondary);
}

.em-contact-requests-page__actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-left: var(--em-spacing-2);
  flex-shrink: 0;
}

.em-contact-requests-page__action-gap {
  width: var(--em-spacing-2);
  flex-shrink: 0;
}

.em-contact-requests-page__status {
  font-family: var(--em-font-family);
  font-size: var(--em-font-size-13);
  line-height: 18px;
  color: var(--em-text-tertiary);
  margin-left: var(--em-spacing-2);
  flex-shrink: 0;
}
</style>
