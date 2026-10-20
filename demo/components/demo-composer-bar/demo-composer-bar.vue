<template>
  <!-- Demo 宿主自绘「输入栏业务入口条」（不进 UIKit）：注入到 em-chat-page 的 #input-toolbar 插槽。
       业务方可在自己项目里照抄这个组件：入口项、图标、文案、点击行为全由宿主决定。 -->
  <view :class="ns.b()">
    <scroll-view scroll-x :show-scrollbar="false" :class="ns.e('scroll')">
      <view :class="ns.e('track')">
        <view
          v-for="item in items"
          :key="item.key"
          :class="ns.e('chip')"
          @click="onSelect(item.key)"
        >
          <view :class="ns.e('chip-icon')">
            <EmIcon :name="item.icon" :size="14" :color="accent" />
          </view>
          <text :class="ns.e('chip-text')">{{ item.label }}</text>
        </view>
        <view v-if="more" :class="[ns.e('chip'), ns.m('more')]" @click="onMore">
          <text :class="ns.e('more-text')">{{ moreText }}</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import EmIcon from '@/uni_modules/easemob-uikit-uni/components/em-icon/em-icon.vue'
import type { EmIconName } from '@/uni_modules/easemob-uikit-uni/components/em-icon/em-icons'

// 与 demo-card 同约定：独立 css + app-and-page 隔离，不写 scoped；前缀 demo- 由本地 ns 生成
defineOptions({ styleIsolation: 'app-and-page' })

interface DemoComposerItem {
  /** 业务 key（Demo 用卡片 event；宿主可换成任意 action id） */
  key: string
  /** 胶囊文案（宿主自定，可做多语言） */
  label: string
  icon: EmIconName
}

interface Props {
  items: DemoComposerItem[]
  /** 场景主色（只染图标，不写 UIKit token） */
  accent?: string
  /** 末尾「更多」胶囊文案；空串不渲染 */
  moreText?: string
}

const props = withDefaults(defineProps<Props>(), {
  accent: '',
  moreText: ''
})

const emit = defineEmits<{
  (e: 'select', key: string): void
  (e: 'more'): void
}>()

// 本地 BEM：UIKit 的 useNamespace 会加 em- 前缀，demo 组件必须自建
const ns = {
  b: () => 'demo-composer',
  e: (element: string) => `demo-composer__${element}`,
  m: (modifier: string) => `demo-composer--${modifier}`
}

const more = computed(() => props.moreText !== '')

function onSelect(key: string): void {
  emit('select', key)
}

function onMore(): void {
  emit('more')
}
</script>

<style>
@import '@/uni_modules/easemob-uikit-uni/libs/style/variables.css';

/* 位于消息列表与输入栏之间：底色与输入栏一致，上边一条分隔线 */
.demo-composer {
  display: flex;
  flex-direction: column;
  background-color: var(--em-input-bg);
  border-top-width: 1px;
  border-top-style: solid;
  border-top-color: var(--em-divider-color);
  flex-shrink: 0;
}

.demo-composer__scroll {
  display: flex;
  flex-direction: row;
  white-space: nowrap;
}

.demo-composer__track {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: var(--em-spacing-2) var(--em-spacing-3);
}

.demo-composer__chip {
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 30px;
  padding: 0 var(--em-spacing-3) 0 4px;
  margin-right: var(--em-spacing-2);
  border-radius: 999px;
  background-color: var(--em-bg-secondary);
  flex-shrink: 0;
}

.demo-composer__chip-icon {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background-color: var(--em-bg-elevated);
  margin-right: 6px;
}

.demo-composer__chip-text {
  font-family: var(--em-font-family);
  font-size: var(--em-font-size-13);
  line-height: 18px;
  color: var(--em-text-primary);
}

.demo-composer--more {
  padding: 0 var(--em-spacing-3);
  background-color: transparent;
  border-width: 1px;
  border-style: solid;
  border-color: var(--em-border-color);
}

.demo-composer__more-text {
  font-family: var(--em-font-family);
  font-size: var(--em-font-size-13);
  line-height: 18px;
  color: var(--em-text-secondary);
}
</style>
