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
@import './em-button.css';
</style>
