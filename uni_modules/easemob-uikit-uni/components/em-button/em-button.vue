<template>
  <view :class="classes" @click="onClick">
    <text :class="textClasses">{{ text }}<slot /></text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNamespace } from '../../libs/use/useNamespace'

// 按钮原子组件（对齐 vue 版 uikit-core EmButton 的一期裁剪：type 四档 + 尺寸两档 + pill/block/disabled）
defineOptions({ styleIsolation: 'app-and-page' })

interface Props {
  text?: string
  type?: 'default' | 'primary' | 'danger' | 'outline'
  size?: 'large' | 'medium'
  pill?: boolean        // 全圆角胶囊（聊天详情页 footer 按钮形态）
  block?: boolean       // 通栏
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  text: '',
  type: 'default',
  size: 'large',
  pill: false,
  block: false,
  disabled: false
})

const emit = defineEmits<{ (e: 'click'): void }>()

const ns = useNamespace('button')

const classes = computed(() => [
  ns.b(),
  ns.m(props.type),
  ns.m(props.size),
  props.pill ? ns.m('pill') : '',
  props.block ? ns.m('block') : '',
  props.disabled ? ns.is('disabled') : ''
])

// ucss 只有类选择器（无后代选择器保障），文字色/字号走独立的元素修饰类
const textClasses = computed(() => [
  ns.e('text'),
  `${ns.e('text')}--${props.type}`,
  `${ns.e('text')}--${props.size}`
])

function onClick(): void {
  if (props.disabled) return
  emit('click')
}
</script>

<style>
@import '../../libs/style/variables.css';

.em-button {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

/* 尺寸（对齐 vue 版：large 为 42px 通栏胶囊档） */
.em-button--large {
  height: 42px;
  padding: 0 var(--em-spacing-4);
}

.em-button--medium {
  height: 32px;
  padding: 0 var(--em-spacing-3);
}

.em-button--pill {
  border-radius: 999px;
}

.em-button--block {
  width: 100%;
}

.em-button--default {
  background-color: var(--em-control-bg);
}

.em-button--primary {
  background-color: var(--em-primary-color);
}

.em-button--danger {
  background-color: var(--em-control-bg);
}

.em-button--outline {
  background-color: transparent;
  border-width: 1px;
  border-style: solid;
  border-color: var(--em-border-color);
}

.em-button.is-disabled {
  opacity: 0.4;
}

.em-button__text {
  font-family: var(--em-font-family);
  font-weight: var(--em-font-weight-medium);
}

.em-button__text--large {
  font-size: var(--em-font-size-15);
}

.em-button__text--medium {
  font-size: var(--em-font-size-14);
}

.em-button__text--default {
  color: var(--em-text-primary);
}

.em-button__text--primary {
  color: var(--em-text-inverse);
}

.em-button__text--danger {
  color: var(--em-danger-color);
}

.em-button__text--outline {
  color: var(--em-text-primary);
}
</style>
