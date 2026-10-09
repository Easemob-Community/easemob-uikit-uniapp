<template>
  <view :class="rootClass" :style="rootStyle">
    <image
      v-if="showImage"
      :class="imgClass"
      :src="src"
      mode="aspectFill"
      @error="onImageError"
    />
    <text v-else :class="ns.e('name')" :style="nameStyle">{{ displayName }}</text>
    <view v-if="hasBadge" :class="badgeClass" :style="badgeStyle">
      <text v-if="!badgeDot" :class="ns.e('badge-text')" :style="badgeTextStyle">{{ badgeText }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useNamespace } from '../../libs/use/useNamespace'

// 文字头像占位底色板（平移自 Web 版 avatar.vue）：按 name 首字符 hash 取色
const PLACEHOLDER_COLORS = ['#38bdf8', '#34d399', '#fbbf24', '#fb7185', '#a78bfa']

interface Props {
  src?: string
  name?: string
  size?: number
  shape?: 'circle' | 'square'
  badge?: number
  badgeDot?: boolean
  badgeMax?: number
}

const props = withDefaults(defineProps<Props>(), {
  src: '',
  name: '',
  size: 40,
  shape: 'circle',
  badge: 0,
  badgeDot: false,
  badgeMax: 99
})

defineOptions({ styleIsolation: 'app-and-page' })

const ns = useNamespace('avatar')

const loadFailed = ref(false)
const showImage = computed(() => props.src.length > 0 && !loadFailed.value)

const displayName = computed(() => props.name.slice(0, 2))

const placeholderColor = computed(() => {
  if (props.name.length === 0) return PLACEHOLDER_COLORS[0]
  return PLACEHOLDER_COLORS[props.name.charCodeAt(0) % PLACEHOLDER_COLORS.length]
})

const rootClass = computed(() => [ns.b(), ns.m(props.shape)])
const rootStyle = computed(() => {
  const base = `width: ${props.size}px; height: ${props.size}px;`
  if (showImage.value) return base
  return `${base} background-color: ${placeholderColor.value};`
})
const imgClass = computed(() => [ns.e('img'), ns.m(props.shape)])
const nameStyle = computed(() => `font-size: ${Math.round(props.size * 0.4)}px;`)

// 徽标内置（平移 Web 版规范）：数字徽标直径 = size×20/48，红点 = size×9/48，字号 = 直径×12/20
const hasBadge = computed(() => props.badgeDot || props.badge > 0)
const badgeDiameter = computed(() =>
  Math.round(props.size * (props.badgeDot ? 9 : 20) / 48)
)
const badgeText = computed(() =>
  props.badge > props.badgeMax ? `${props.badgeMax}+` : `${props.badge}`
)
const badgeClass = computed(() => [ns.e('badge'), props.badgeDot ? ns.m('dot') : ns.m('count')])
const badgeStyle = computed(() => {
  const d = badgeDiameter.value
  const offset = -Math.round(d / 4)
  const base = `min-width: ${d}px; height: ${d}px; top: ${offset}px; right: ${offset}px; border-radius: ${Math.round(d / 2)}px;`
  if (props.badgeDot) return `${base} width: ${d}px;`
  return `${base} padding-left: ${Math.round(d / 5)}px; padding-right: ${Math.round(d / 5)}px;`
})
const badgeTextStyle = computed(() => `font-size: ${Math.round(badgeDiameter.value * 12 / 20)}px;`)

function onImageError(): void {
  loadFailed.value = true
}
</script>

<style>
@import '../../libs/style/variables.css';

.em-avatar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.em-avatar--circle {
  border-radius: 999px;
}

.em-avatar--square {
  border-radius: var(--em-radius);
}

.em-avatar__img {
  width: 100%;
  height: 100%;
}

.em-avatar__name {
  color: #ffffff;
  font-weight: var(--em-font-weight-medium);
}

.em-avatar__badge {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--em-badge-bg);
}

.em-avatar__badge-text {
  color: var(--em-badge-text);
  line-height: 1;
}
</style>
