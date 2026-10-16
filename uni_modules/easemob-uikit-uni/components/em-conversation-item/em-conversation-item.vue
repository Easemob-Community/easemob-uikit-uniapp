<template>
  <view
    :class="[ns.b(), item.isPinned ? ns.m('pinned') : '']"
    @click="emit('click', item.conversationId)"
    @longpress="emit('long-press', item.conversationId)"
  >
    <em-avatar :src="avatar" :name="name" :size="48" />
    <view :class="ns.e('body')">
      <view :class="ns.e('top')">
        <view :class="ns.e('name-wrap')">
          <!-- hasAtMe 时名字主色高亮（对齐 vue 版 conversation-item__name.is-at-me），text-class/text-style 双通道同步切档 -->
          <em-text :text="name" :text-class="ns.e('name') + (hasAtMe ? ' ' + ns.m('name-at-me') : '')" :text-style="hasAtMe ? nameAtMeTextStyle : nameTextStyle" :class="ns.e('name-host')" />
          <!-- 置顶/免打扰徽标：em-icons 无 pin/bell-slash 字形，置顶用 top、免打扰用 eye-slash（与长按菜单图标一致），弱化图标色 -->
          <EmIcon v-if="item.isPinned" name="top" :size="12" :class="ns.e('flag')" />
          <EmIcon v-if="item.isMuted" name="eye-slash" :size="12" :class="ns.e('flag')" />
        </view>
        <text :class="ns.e('time')">{{ timeText }}</text>
      </view>
      <view :class="ns.e('bottom')">
        <view :class="ns.e('message')">
          <!-- 群聊「有人@我」主色前缀（对齐 vue 版 conversation-item__at-me-prefix：primary + medium，atMe 期间优先于草稿态） -->
          <text v-if="hasAtMe" :class="ns.e('at-me')">{{ t('conversation.atMeInMessage') }}</text>
          <text v-else-if="draft != null" :class="ns.e('draft')">[{{ t('conversation.draft') }}]</text>
          <em-text :text="draft != null ? draft.text : item.lastMessageText" :text-class="ns.e('summary')" :text-style="summaryTextStyle" :class="ns.e('summary-host')" />
        </view>
        <!-- 免打扰未读降级为静默点，其余数字徽标（99+ 截断收口 em-badge） -->
        <em-badge v-if="item.unreadCount > 0 && item.isMuted" dot :class="ns.e('unread')" />
        <em-badge v-else-if="item.unreadCount > 0" :count="item.unreadCount" :class="ns.e('unread')" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import EmAvatar from '../em-avatar/em-avatar.vue'
import EmBadge from '../em-badge/em-badge.vue'
import EmIcon from '../em-icon/em-icon.vue'
import EmText from '../em-text/em-text.vue'
import { useNamespace } from '../../libs/use/useNamespace'
import { useLocale } from '../../libs/use/useLocale'
import { TEXT_STYLE_NAME, TEXT_STYLE_SUBTITLE } from '../../libs/style/textStyles'
import type { EmConversationItem } from '../../libs/types'

// 会话列表条目原子组件：页面已装配好的展示数据（名称/头像回落链、五档时间、草稿态）整体透传，
// 组件内不连 store（对齐 vue 版 conversation-item 的数据契约：conversation + 展示字段，裁剪 @我/typing/presence 等一期外能力）
interface Props {
  item: EmConversationItem                          // 会话数据（含置顶/免打扰/未读数/摘要）
  name: string                                      // 展示名（页面侧已走 nickname > conversation.name > id 回落链）
  avatar: string                                    // 头像 URL（已合并 userStore 与 conversation.avatar）
  timeText: string                                  // 五档格式化时间（formatConversationTime，草稿时间优先在页面侧已并入）
  draft: { text: string, time: number } | null      // 草稿态；null 展示最后消息摘要
  hasAtMe?: boolean                                 // 群聊「有人@我」未读标记（摘要主色前缀），默认 false
}

withDefaults(defineProps<Props>(), {
  hasAtMe: false
})

const emit = defineEmits<{
  (e: 'click', conversationId: string): void
  (e: 'long-press', conversationId: string): void
}>()

defineOptions({ styleIsolation: 'app-and-page' })

// 名称/摘要文字内联样式收口 libs/style/textStyles.ts（小程序样式隔离，须走 text-style；详见 em-text 注释）
const nameTextStyle = TEXT_STYLE_NAME
// hasAtMe 名字主色高亮档（对齐 vue 版 is-at-me）：与 TEXT_STYLE_NAME 同档仅换色，双通道的 text-style 侧
const nameAtMeTextStyle =
  'font-family: var(--em-font-family); font-size: var(--em-font-size-15); font-weight: var(--em-font-weight-semibold); line-height: 20px; color: var(--em-primary-color); white-space: nowrap;'
const summaryTextStyle = TEXT_STYLE_SUBTITLE

const ns = useNamespace('conversation-item')
const { t } = useLocale()
</script>

<style>
@import './em-conversation-item.css';
</style>
