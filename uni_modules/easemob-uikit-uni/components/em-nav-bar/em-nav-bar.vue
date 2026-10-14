<template>
  <!-- 自绘导航栏（页面需配 navigationStyle:custom / App titleNView:false）：系统栏右上角在小程序被
       胶囊独占，只能整体自绘；右侧 action 经 capsulePad 预留胶囊宽度落在其左侧（微信/TUIKit 通行做法） -->
  <view :class="ns.b()" :style="headerStyle">
    <view v-if="showBack" :class="ns.e('back')" @click="onBack">
      <EmIcon name="left" :size="22" :class="ns.e('back-icon')" />
    </view>
    <view :class="[ns.e('main'), showBack ? 'em-nav-bar__main--after-back' : '']">
      <text :class="ns.e('title')">{{ title }}</text>
      <text v-if="subtitle !== ''" :class="ns.e('subtitle')">{{ subtitle }}</text>
    </view>
    <view v-if="actionIcon !== ''" :class="ns.e('action')" @click="onAction">
      <EmIcon :name="actionIcon" :size="22" :class="ns.e('action-icon')" />
    </view>
  </view>
</template>

<script setup lang="ts">
import EmIcon from '../em-icon/em-icon.vue'
import type { EmIconName } from '../em-icon/em-icons'
import { useNamespace } from '../../libs/use/useNamespace'
import { getSafeAreaTop } from '../../libs/use/useSafeArea'

// 自绘导航栏原子组件：safe-top + 44px 内容行；小程序胶囊避让内置（#ifdef MP-WEIXIN 量胶囊矩形）
defineOptions({ styleIsolation: 'app-and-page' })

interface Props {
  title?: string
  subtitle?: string      // 副标题（如 typing 提示），空串不渲染
  showBack?: boolean     // 左侧返回箭头，默认 true
  actionIcon?: EmIconName | ''   // 右侧动作图标，空串不渲染
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  subtitle: '',
  showBack: true,
  actionIcon: ''
})

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'action'): void
}>()

const ns = useNamespace('nav-bar')

// 小程序端胶囊独占右上角：预留 胶囊左边距 + 胶囊宽 + 8px 间隔；其它端常规 12px
let capsuleRightPad = 12
// #ifdef MP-WEIXIN
const menuRect = uni.getMenuButtonBoundingClientRect()
capsuleRightPad = (uni.getWindowInfo().windowWidth - menuRect.right) + menuRect.width + 8
// #endif
const headerStyle = `padding-top: ${getSafeAreaTop()}px; padding-right: ${capsuleRightPad}px;`

function onBack(): void {
  emit('back')
}

function onAction(): void {
  emit('action')
}
</script>

<style>
@import '../../libs/style/variables.css';

/* safe-top 由 headerStyle 内联注入；44px 内容行（对齐 vue 版 header 口径）；
   左 padding 16px 与列表/搜索槽内容边距对齐 */
.em-nav-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 44px;
  padding-left: var(--em-spacing-4);
  box-sizing: content-box;
  border-bottom-width: 1px;
  border-bottom-style: solid;
  border-bottom-color: var(--em-divider-color);
  background-color: var(--em-bg-base);
}

.em-nav-bar__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.em-nav-bar__back-icon {
  color: var(--em-text-primary);
}

.em-nav-bar__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  min-width: 0;
}

/* 有返回键时标题与其留 4px 间隔；无返回键时标题顶格（与页面内容边距对齐） */
.em-nav-bar__main--after-back {
  margin-left: var(--em-spacing-1);
}

.em-nav-bar__title {
  font-family: var(--em-font-family);
  font-size: var(--em-font-size-16);
  font-weight: var(--em-font-weight-medium);
  line-height: 22px;
  color: var(--em-text-primary);
}

/* 副标题（对齐 vue 版 header 副标题区：11px 灰字） */
.em-nav-bar__subtitle {
  font-family: var(--em-font-family);
  font-size: var(--em-font-size-11);
  line-height: 16px;
  color: var(--em-text-tertiary);
}

.em-nav-bar__action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.em-nav-bar__action-icon {
  color: var(--em-text-primary);
}
</style>
