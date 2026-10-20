<template>
  <!-- Demo 宿主自绘卡片（不进 UIKit）：业务方可在自己项目里照抄这个组件，换成任意布局/样式/多语言文案。
       UIKit 只负责：custom 消息收发 + #custom-message 插槽。 -->
  <view v-if="hasCard" :class="ns.b()">
    <view :class="ns.e('head')">
      <view :class="[ns.e('icon'), iconKindClass]">
        <EmIcon :name="iconName" :size="18" :class="ns.e('icon-glyph')" />
      </view>
      <view :class="ns.e('head-main')">
        <em-text
          :lines="2"
          :text="card.title"
          :text-class="ns.e('title')"
          :text-style="TITLE_STYLE"
        />
        <em-text
          v-if="subtitle !== ''"
          :lines="2"
          :text="subtitle"
          :text-class="ns.e('subtitle')"
          :text-style="SUBTITLE_STYLE"
        />
        <view v-if="badge !== ''" :class="ns.e('badge')">
          <text :class="ns.e('badge-text')">{{ badge }}</text>
        </view>
      </view>
    </view>

    <view v-if="fields.length > 0" :class="ns.e('fields')">
      <view v-for="(field, index) in fields" :key="index" :class="ns.e('field')">
        <em-text
          :lines="1"
          :text="field.label"
          :text-class="ns.e('field-label')"
          :text-style="LABEL_STYLE"
          :class="ns.e('field-label-host')"
        />
        <em-text
          :lines="2"
          :text="field.value"
          :text-class="ns.e('field-value')"
          :text-style="VALUE_STYLE"
          :class="ns.e('field-value-host')"
        />
      </view>
    </view>

    <view v-if="showFoot" :class="ns.e('foot')">
      <text v-if="footer !== ''" :class="ns.e('foot-text')">{{ footer }}</text>
      <view v-if="actionText !== '' || secondaryText !== ''" :class="ns.e('actions')">
        <view v-if="secondaryText !== ''" :class="[ns.e('btn'), ns.e('btn-secondary')]" @click="onAction(secondaryKey)">
          <text :class="ns.e('btn-text-secondary')">{{ secondaryText }}</text>
        </view>
        <view v-if="actionText !== ''" :class="[ns.e('btn'), ns.e('btn-primary')]" @click="onAction(actionKey)">
          <text :class="ns.e('btn-text-primary')">{{ actionText }}</text>
        </view>
      </view>
    </view>
  </view>

  <view v-else :class="[ns.b(), ns.m('fallback')]">
    <text :class="ns.e('fallback-text')">{{ fallbackText }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import EmIcon from '@/uni_modules/easemob-uikit-uni/components/em-icon/em-icon.vue'
import EmText from '@/uni_modules/easemob-uikit-uni/components/em-text/em-text.vue'
import type { EmIconName } from '@/uni_modules/easemob-uikit-uni/components/em-icon/em-icons'
import type { EmMessageItem } from '@/uni_modules/easemob-uikit-uni/libs'
import { demoCardKindOf, demoCardOf, type DemoCardData, type DemoCardField } from '@/common/demo-card-data'

// 样式隔离与 UIKit 一致：独立 css + app-and-page，不写 scoped；宿主可在外层包 view 做单卡尺寸/间距定制
defineOptions({ styleIsolation: 'app-and-page' })

interface Props {
  /** custom 消息（customEvent 用于宿主侧事件分发，ext/customParams 为业务载荷） */
  message: EmMessageItem
  /** 未知 event / 无标题时的占位文案（宿主自己决定，Demo 传中文） */
  fallbackText: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'action', key: string, message: EmMessageItem): void
}>()

// Demo 自己的 BEM 前缀（不套用 UIKit 的 em- 命名；宿主项目可任意命名）
const ns = {
  b: (): string => 'demo-card',
  e: (element: string): string => `demo-card__${element}`,
  m: (modifier: string): string => `demo-card--${modifier}`
}

const TITLE_STYLE = 'font-family: var(--em-font-family); font-size: 14px; font-weight: var(--em-font-weight-medium); line-height: 20px; color: var(--em-text-primary);'
const SUBTITLE_STYLE = 'font-family: var(--em-font-family); font-size: 12px; line-height: 17px; color: var(--em-text-secondary);'
const VALUE_STYLE = 'font-family: var(--em-font-family); font-size: 13px; line-height: 18px; color: var(--em-text-primary);'
const LABEL_STYLE = 'font-family: var(--em-font-family); font-size: 11px; line-height: 18px; color: var(--em-text-tertiary); white-space: nowrap;'

const EMPTY_CARD: DemoCardData = { title: '' }

const resolved = computed(() => demoCardOf(props.message))
const hasCard = computed(() => resolved.value != null)
const card = computed<DemoCardData>(() => resolved.value != null ? resolved.value : EMPTY_CARD)
const kind = computed(() => demoCardKindOf(props.message.customEvent))

const KIND_ICONS: Record<string, string> = {
  order: 'cart-filled',
  profile: 'phone-filled',
  document: 'doc-filled',
  action: 'calendar-filled',
  default: 'doc-filled'
}

const iconName = computed<EmIconName>(() => {
  const custom = card.value.icon
  const fallback = KIND_ICONS[kind.value] != null ? KIND_ICONS[kind.value] : KIND_ICONS['default']
  return (custom != null && custom !== '' ? custom : fallback) as EmIconName
})

const iconKindClass = computed(() => `demo-card__icon--${kind.value}`)
const badge = computed(() => card.value.badge != null ? card.value.badge : '')
const subtitle = computed(() => card.value.subtitle != null ? card.value.subtitle : '')
const footer = computed(() => card.value.footer != null ? card.value.footer : '')
const actionText = computed(() => card.value.actionText != null ? card.value.actionText : '')
const actionKey = computed(() => card.value.actionKey != null ? card.value.actionKey : '')
const secondaryText = computed(() => card.value.secondaryText != null ? card.value.secondaryText : '')
const secondaryKey = computed(() => card.value.secondaryKey != null ? card.value.secondaryKey : '')

const fields = computed<DemoCardField[]>(() => {
  const rows = card.value.fields
  return rows != null ? rows.slice(0, 4) : []
})

const showFoot = computed(() => footer.value !== '' || actionText.value !== '' || secondaryText.value !== '')

function onAction(key: string): void {
  emit('action', key, props.message)
}
</script>

<style>
@import './demo-card.css';
</style>
