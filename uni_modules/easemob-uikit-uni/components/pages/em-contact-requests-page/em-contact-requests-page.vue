<template>
  <view :class="[ns.b(), themeClass]">
    <!-- 自绘导航栏（宿主页面需配 navigationStyle:custom / App titleNView:false）；返回动作以 back 事件透出，路由由宿主接线 -->
    <em-nav-bar :title="t('contact.newRequests')" @back="emit('back')" />

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
              @click="processInvite(invite, 'accept')"
            />
            <view :class="ns.e('action-gap')"></view>
            <em-button
              :text="t('contact.requests.decline')"
              type="outline"
              size="medium"
              pill
              :disabled="isProcessing(invite.id)"
              @click="processInvite(invite, 'decline')"
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
import EmAvatar from '../../em-avatar/em-avatar.vue'
import EmButton from '../../em-button/em-button.vue'
import EmNavBar from '../../em-nav-bar/em-nav-bar.vue'
import { EmKit } from '../../../libs'
import { CONTACT_INVITE_STATUS } from '../../../libs/constants'
import { contactStore } from '../../../libs/store/contact'
import { avatarOf, displayNameOf } from '../../../libs/store/user'
import type { EmContactInvite } from '../../../libs/types'
import { useNamespace } from '../../../libs/use/useNamespace'
import { useTheme } from '../../../libs/use/useTheme'
import { useLocale } from '../../../libs/use/useLocale'
import { TEXT_STYLE_NAME, TEXT_STYLE_SUBTITLE } from '../../../libs/style/textStyles'

// 好友申请列表页（对齐 vue 版 contact-notice-list 的好友申请部分）：
// 条目 = 48px 头像 + 名称 + 附言副标题；pending 态接受/拒绝双按钮，已处理态弱化状态文字
defineOptions({ styleIsolation: 'app-and-page' })

// 名称/附言文字内联样式收口 libs/style/textStyles.ts（小程序样式隔离，须走 text-style；详见 em-text 注释）
const nameTextStyle = TEXT_STYLE_NAME
const subtitleTextStyle = TEXT_STYLE_SUBTITLE

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

function processInvite(invite: EmContactInvite, kind: 'accept' | 'decline'): void {
  if (isProcessing(invite.id)) return
  processingIds.value.push(invite.id)
  const action = kind === 'accept' ? EmKit.acceptContactInvite(invite) : EmKit.declineContactInvite(invite)
  action
    .catch(() => {
      uni.showToast({ title: kind === 'accept' ? t('contact.requests.acceptFailed') : t('contact.requests.declineFailed'), icon: 'none' })
    })
    .finally(() => {
      processingIds.value = processingIds.value.filter((id) => id !== invite.id)
    })
}
</script>

<style>
@import './em-contact-requests-page.css';
</style>
